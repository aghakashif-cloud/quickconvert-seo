import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

const CANDIDATE_MODELS = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-3.8-flash",
  "gemini-3.8-flash-lite",
  "gemini-3-flash-preview",
];

export interface CutRange {
  start: number;
  end: number;
  reason?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeAndMergeCuts(
  rawCuts: CutRange[],
  maxDuration: number
): CutRange[] {
  const valid = rawCuts
    .filter(
      (c) =>
        c &&
        typeof c.start === "number" &&
        typeof c.end === "number" &&
        Number.isFinite(c.start) &&
        Number.isFinite(c.end)
    )
    .map((c) => {
      const start = Math.max(0, Number(c.start.toFixed(2)));
      const end =
        maxDuration > 0
          ? Math.min(maxDuration, Number(c.end.toFixed(2)))
          : Number(c.end.toFixed(2));
      return {
        start,
        end,
        reason:
          typeof c.reason === "string" && c.reason.trim()
            ? c.reason.trim()
            : "silence / filler",
      };
    })
    .filter((c) => c.end - c.start >= 0.25)
    .sort((a, b) => a.start - b.start);

  if (valid.length === 0) return [];

  const merged: CutRange[] = [valid[0]];
  for (let i = 1; i < valid.length; i++) {
    const curr = valid[i];
    const prev = merged[merged.length - 1];
    if (curr.start <= prev.end + 0.15) {
      prev.end = Math.max(prev.end, curr.end);
      if (prev.reason && curr.reason && !prev.reason.includes(curr.reason)) {
        prev.reason = `${prev.reason} + ${curr.reason}`;
      }
    } else {
      merged.push(curr);
    }
  }

  return merged;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      timestampedTranscript,
      silenceHints = [],
      videoDurationSeconds = 0,
    } = body as {
      timestampedTranscript?: string;
      silenceHints?: Array<{ start: number; end: number }>;
      videoDurationSeconds?: number;
    };

    if (
      (!timestampedTranscript ||
        typeof timestampedTranscript !== "string" ||
        !timestampedTranscript.trim()) &&
      (!Array.isArray(silenceHints) || silenceHints.length === 0)
    ) {
      return NextResponse.json(
        {
          error:
            "Please provide a timestamped transcript or detected silence intervals to analyze for jump cuts.",
        },
        { status: 400 }
      );
    }

    const rawEnvKey =
      process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY !== "your_gemini_api_key_here"
        ? process.env.GEMINI_API_KEY
        : process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    const apiKey = rawEnvKey?.trim();

    if (!apiKey || apiKey === "your_gemini_api_key_here") {
      return NextResponse.json(
        {
          error:
            "Server configuration error: GEMINI_API_KEY is not configured in the server environment.",
        },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const duration =
      typeof videoDurationSeconds === "number" && videoDurationSeconds > 0
        ? Number(videoDurationSeconds.toFixed(2))
        : 0;

    const silenceContext =
      Array.isArray(silenceHints) && silenceHints.length > 0
        ? `\n\nDETECTED ACOUSTIC SILENCE GAPS FROM AUDIO WAVEFORM (in seconds):\n${JSON.stringify(
            silenceHints.slice(0, 80)
          )}\nUse these exact acoustic silence timestamps alongside the transcript to pinpoint dead air accurately.`
        : "";

    const promptText = `Analyze this timestamped transcript. Identify the start and end times of sections that contain only silence, long pauses, or filler words (um, uh, ah). Return a JSON array of time ranges to REMOVE: [{ start: 1.2, end: 2.5 }, ...].

RULES:
- Total video duration: ${duration > 0 ? `${duration} seconds` : "infer from transcript"}.
- All start and end values must be numbers in seconds (e.g., 1.2, 2.5) with 0 <= start < end${
      duration > 0 ? ` <= ${duration}` : ""
    }.
- Only mark sections that are genuine dead air, awkward pauses (>= 0.6s), or standalone filler words ("um", "uh", "ah", "er", "hmm", "uhh", "umm").
- NEVER cut out meaningful spoken words or full sentences—leave a tiny natural breath (~0.1s) around spoken words so speech sounds smooth, not robotic.
- Include a short "reason" label for each item (e.g., "Long pause", "Silence", or "Filler: um").

TIMESTAMPED TRANSCRIPT:
"""
${(timestampedTranscript || "").trim()}
"""${silenceContext}`;

    let lastError: unknown = null;

    for (const modelName of CANDIDATE_MODELS) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ text: promptText }],
            config: {
              temperature: 0.2,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    start: {
                      type: Type.NUMBER,
                      description: "Start time in seconds of the segment to remove.",
                    },
                    end: {
                      type: Type.NUMBER,
                      description: "End time in seconds of the segment to remove.",
                    },
                    reason: {
                      type: Type.STRING,
                      description:
                        "Short reason such as 'Silence', 'Long pause', or 'Filler: um'.",
                    },
                  },
                  required: ["start", "end"],
                },
              },
            },
          });

          const text = response.text;
          if (!text) throw new Error("Empty response from Gemini API.");

          const parsed = JSON.parse(text);
          const rawArray: CutRange[] = Array.isArray(parsed)
            ? parsed
            : Array.isArray(parsed?.cuts)
            ? parsed.cuts
            : [];

          const cuts = sanitizeAndMergeCuts(rawArray, duration);
          const totalRemovedSeconds = Number(
            cuts.reduce((sum, c) => sum + (c.end - c.start), 0).toFixed(2)
          );

          return NextResponse.json({
            cuts,
            totalRemovedSeconds,
            modelUsed: modelName,
          });
        } catch (err: unknown) {
          lastError = err;
          const errMsg = err instanceof Error ? err.message : String(err);
          const isOverloaded =
            errMsg.includes("503") ||
            errMsg.includes("UNAVAILABLE") ||
            errMsg.includes("high demand") ||
            errMsg.includes("429");
          const isNotFound =
            errMsg.includes("404") || errMsg.includes("NOT_FOUND");

          if (isNotFound) break;
          if (isOverloaded && attempt === 1) {
            await sleep(1200);
            continue;
          }
          break;
        }
      }
    }

    // Graceful fallback: if Gemini is temporarily overloaded but we have exact acoustic silence hints, return sanitized silence cuts
    if (Array.isArray(silenceHints) && silenceHints.length > 0) {
      const fallbackCuts = sanitizeAndMergeCuts(
        silenceHints.map((s) => ({
          start: s.start,
          end: s.end,
          reason: "Detected silence",
        })),
        duration
      );
      const totalRemovedSeconds = Number(
        fallbackCuts.reduce((sum, c) => sum + (c.end - c.start), 0).toFixed(2)
      );
      return NextResponse.json({
        cuts: fallbackCuts,
        totalRemovedSeconds,
        fallbackUsed: true,
      });
    }

    throw (
      lastError ||
      new Error("Gemini AI service is temporarily busy. Please try again.")
    );
  } catch (error: unknown) {
    console.error("Analyze Video Cuts API Error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to analyze video transcript for silence and filler cuts.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

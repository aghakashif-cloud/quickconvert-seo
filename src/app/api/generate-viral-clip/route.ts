import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

const CANDIDATE_MODELS = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-3.8-flash",
  "gemini-3.8-flash-lite",
  "gemini-3-flash-preview",
];

interface ViralClipResult {
  startTime: number;
  endTime: number;
  reason: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeViralSegment(
  rawStart: unknown,
  rawEnd: unknown,
  rawReason: unknown,
  maxDuration: number
): ViralClipResult {
  const safeMax = maxDuration > 0 ? Number(maxDuration.toFixed(2)) : 300;
  let start =
    typeof rawStart === "number" && Number.isFinite(rawStart)
      ? Math.max(0, rawStart)
      : 0;
  let end =
    typeof rawEnd === "number" && Number.isFinite(rawEnd)
      ? Math.min(safeMax, rawEnd)
      : Math.min(safeMax, start + 45);

  if (end <= start) {
    start = 0;
    end = Math.min(safeMax, 45);
  }

  // Enforce practical 30-60s viral clip bounds when the source video is long enough
  const segLen = end - start;
  if (safeMax >= 35) {
    if (segLen > 62) {
      end = Math.min(safeMax, start + 60);
    } else if (segLen < 25) {
      const targetLen = Math.min(45, safeMax);
      if (start + targetLen <= safeMax) {
        end = start + targetLen;
      } else {
        end = safeMax;
        start = Math.max(0, safeMax - targetLen);
      }
    }
  } else {
    // Video itself is shorter than 35s — clamp to valid video range
    start = Math.max(0, Math.min(start, Math.max(0, safeMax - 3)));
    end = Math.min(safeMax, Math.max(end, Math.min(safeMax, start + 15)));
  }

  const reason =
    typeof rawReason === "string" && rawReason.trim().length > 0
      ? rawReason.trim()
      : "High-energy spoken segment with a clear hook and strong standalone value for short-form viewers.";

  return {
    startTime: Number(start.toFixed(2)),
    endTime: Number(end.toFixed(2)),
    reason,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { timestampedTranscript, videoDurationSeconds = 0 } = body as {
      timestampedTranscript?: string;
      videoDurationSeconds?: number;
    };

    if (
      !timestampedTranscript ||
      typeof timestampedTranscript !== "string" ||
      !timestampedTranscript.trim()
    ) {
      return NextResponse.json(
        {
          error:
            "Please provide a timestamped transcript so AI can find the most engaging viral segment.",
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

    const promptText = `You are a viral content expert. Analyze this transcript and find the most engaging 30-60 second segment. Return ONLY a JSON object with startTime and endTime (in seconds) and a reason for choosing this part.

CONSTRAINTS:
- Analyzed video duration: ${duration > 0 ? `${duration} seconds` : "infer from timestamps"}.
- startTime and endTime MUST be numeric values in seconds with 0 <= startTime < endTime${
      duration > 0 ? ` <= ${duration}` : ""
    }.
- Target clip length: between 30 and 60 seconds (or the strongest complete highlight if the entire video is shorter than 35 seconds).
- Start cleanly at the beginning of a hook or sentence and end cleanly at a natural punchline or takeaway.
- Explain clearly in "reason" why this exact segment will hook viewers on YouTube Shorts, TikTok, or Instagram Reels.

TIMESTAMPED TRANSCRIPT:
"""
${timestampedTranscript.trim()}
"""`;

    let lastError: unknown = null;

    for (const modelName of CANDIDATE_MODELS) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: [{ text: promptText }],
            config: {
              temperature: 0.3,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  startTime: {
                    type: Type.NUMBER,
                    description:
                      "Start time in seconds of the most engaging 30-60 second viral segment.",
                  },
                  endTime: {
                    type: Type.NUMBER,
                    description:
                      "End time in seconds of the most engaging 30-60 second viral segment.",
                  },
                  reason: {
                    type: Type.STRING,
                    description:
                      "Clear explanation of why this segment makes a strong viral short-form clip.",
                  },
                },
                required: ["startTime", "endTime", "reason"],
              },
            },
          });

          const text = response.text;
          if (!text) throw new Error("Empty response from Gemini API.");

          const parsed = JSON.parse(text) as Partial<ViralClipResult>;
          const sanitized = sanitizeViralSegment(
            parsed.startTime,
            parsed.endTime,
            parsed.reason,
            duration
          );

          return NextResponse.json({
            ...sanitized,
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

    // Graceful fallback if Gemini is temporarily busy: select a clean opening 45s highlight
    if (duration > 0) {
      const fallback = sanitizeViralSegment(
        0,
        Math.min(duration, 45),
        "Selected the opening highlight segment because the AI analysis service was temporarily busy.",
        duration
      );
      return NextResponse.json({
        ...fallback,
        fallbackUsed: true,
      });
    }

    throw (
      lastError ||
      new Error("Gemini AI service is temporarily busy. Please try again.")
    );
  } catch (error: unknown) {
    console.error("Generate Viral Clip API Error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to analyze transcript for viral clip segment.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

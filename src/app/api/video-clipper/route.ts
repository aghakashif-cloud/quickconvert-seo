import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

const CANDIDATE_MODELS = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-3.8-flash",
  "gemini-3.8-flash-lite",
  "gemini-3-flash-preview",
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      transcript,
      audioBase64,
      audioMimeType = "audio/mp3",
      videoDurationSeconds,
      targetClipLength = "30-60 seconds",
    } = body;

    if (
      (!transcript || typeof transcript !== "string" || !transcript.trim()) &&
      (!audioBase64 || typeof audioBase64 !== "string")
    ) {
      return NextResponse.json(
        {
          error:
            "Please provide either a video transcript or extracted client-side audio to analyze for viral clips.",
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

    const durationContext = videoDurationSeconds
      ? `Total Video Duration: approximately ${Math.round(
          Number(videoDurationSeconds)
        )} seconds.`
      : "Total Video Duration: infer from the transcript or audio track.";

    const systemInstructionText = `You are an elite Viral Short-Form Video Editor (YouTube Shorts, TikTok, Instagram Reels).
Analyze the provided video transcript and/or extracted audio track to identify the 3 to 5 most engaging, high-retention segments (${targetClipLength} each).
${durationContext}

For each segment, return:
- "title": A punchy, curiosity-driven hook title for the clip.
- "startTime": Start timestamp in "MM:SS" format (e.g., "00:15") and "startSeconds" as an integer.
- "endTime": End timestamp in "MM:SS" format (e.g., "00:55") and "endSeconds" as an integer (clip length should ideally be between 30 and 60 seconds, or proportional if the source video is shorter than 60 seconds).
- "viralityScore": Integer from 1 to 100 indicating viral potential.
- "hookQuote": The exact opening line or key quote from that segment.
- "whyItWorks": 1-2 sentences explaining why this moment will hold viewer retention.
- "suggestedCaption": A ready-to-post social media caption with 3 hashtags.`;

    const contentsParts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    > = [{ text: systemInstructionText }];

    if (transcript && typeof transcript === "string" && transcript.trim()) {
      contentsParts.push({
        text: `VIDEO TRANSCRIPT / NOTES:\n"""\n${transcript.trim()}\n"""`,
      });
    }

    if (audioBase64 && typeof audioBase64 === "string") {
      contentsParts.push({
        inlineData: {
          mimeType: audioMimeType,
          data: audioBase64,
        },
      });
    }

    let lastError: unknown = null;

    for (const modelName of CANDIDATE_MODELS) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: contentsParts,
            config: {
              temperature: 0.7,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  summary: {
                    type: Type.STRING,
                    description: "Brief overview of the video's content and viral potential.",
                  },
                  detectedTranscriptSnippet: {
                    type: Type.STRING,
                    description:
                      "A clean summary or transcript excerpt of what was heard/read.",
                  },
                  clips: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        startTime: { type: Type.STRING },
                        endTime: { type: Type.STRING },
                        startSeconds: { type: Type.INTEGER },
                        endSeconds: { type: Type.INTEGER },
                        viralityScore: { type: Type.INTEGER },
                        hookQuote: { type: Type.STRING },
                        whyItWorks: { type: Type.STRING },
                        suggestedCaption: { type: Type.STRING },
                      },
                      required: [
                        "title",
                        "startTime",
                        "endTime",
                        "startSeconds",
                        "endSeconds",
                        "viralityScore",
                        "hookQuote",
                        "whyItWorks",
                        "suggestedCaption",
                      ],
                    },
                  },
                },
                required: ["summary", "detectedTranscriptSnippet", "clips"],
              },
            },
          });

          const text = response.text;
          if (!text) throw new Error("Empty response from Gemini API.");

          const parsed = JSON.parse(text);
          return NextResponse.json(parsed);
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

    throw (
      lastError ||
      new Error("Gemini AI service is temporarily busy. Please try again.")
    );
  } catch (error: unknown) {
    console.error("AI Video Clipper API Error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to analyze video for engaging segments.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

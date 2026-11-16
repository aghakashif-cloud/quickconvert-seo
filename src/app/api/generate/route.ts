import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

// Ordered list of Gemini models to try if the primary model experiences a temporary 503 high-demand spike
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
      topic,
      tone = "Engaging & High-CTR",
      targetAudience = "General YouTube Viewers",
      videoType = "Long-form Video",
      variationSeed,
    } = body;

    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return NextResponse.json(
        { error: "Please provide a video topic, script summary, or transcript." },
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
            "Server configuration error: GEMINI_API_KEY is not configured in the server environment (.env.local).",
        },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Pick a creative angle & entropy token so every single generation is fresh and distinct
    const creativeAngles = [
      "Curiosity Gap & Intrigue Hook",
      "Action-Oriented & Result-Driven",
      "Storytelling & Emotional Connection",
      "Contrarian / Myth-Busting Perspective",
      "Direct Value & Step-by-Step Authority",
      "Urgency & Trend-Forward Angle",
    ];
    const randomAngle =
      creativeAngles[Math.floor(Math.random() * creativeAngles.length)];
    const timestampEntropy = `${Date.now()}-${variationSeed || Math.random().toString(36).substring(2, 9)}`;

    const prompt = `You are an elite YouTube SEO Strategist and Viral Content Producer.
Generate completely fresh, original, high-converting YouTube metadata based on the user's input below.

USER INPUT (Topic / Transcript / Notes):
"""
${topic.trim()}
"""

PARAMETERS:
- Desired Tone: ${tone}
- Target Audience: ${targetAudience?.trim() ? targetAudience.trim() : "General YouTube Viewers"}
- Video Format: ${videoType}
- Creative Framing Angle for this run: ${randomAngle}
- Generation Entropy ID: ${timestampEntropy} (Ensure the phrasing, hooks, title choices, and tag combinations are uniquely crafted for this specific run and never repetitive).

REQUIREMENTS:
1. "primaryTitle": The single strongest, highest-CTR title (under 70 characters ideally) that balances curiosity and search intent.
2. "alternativeTitles": 4 distinct alternative titles using different psychological hooks (e.g., listicle, question, how-to, bold statement).
3. "description": A comprehensive, engaging, SEO-optimized YouTube video description including:
   - A compelling 2-line above-the-fold hook
   - Detailed overview of what viewers will learn/experience
   - Suggested timestamps/chapters breakdown
   - Call-to-action (subscribe, comment prompt)
   - 3-5 relevant hashtags at the very bottom
4. "tags": An array of 15 to 20 high-value SEO tags/keywords (mix of broad, medium-tail, and long-tail search terms, without '#' prefix).
5. "thumbnailHook": Short, punchy text overlay idea (2-5 words) + brief visual concept for the thumbnail.`;

    let lastError: unknown = null;

    for (const modelName of CANDIDATE_MODELS) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              temperature: 1.0,
              topP: 0.95,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  primaryTitle: {
                    type: Type.STRING,
                    description: "The top recommended high-CTR YouTube title.",
                  },
                  alternativeTitles: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "4 distinct alternative titles with different hooks.",
                  },
                  description: {
                    type: Type.STRING,
                    description:
                      "Full SEO-optimized YouTube description with hook, chapters, and hashtags.",
                  },
                  tags: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "15-20 SEO-friendly YouTube tags.",
                  },
                  thumbnailHook: {
                    type: Type.STRING,
                    description: "Suggested thumbnail text overlay and visual concept.",
                  },
                },
                required: [
                  "primaryTitle",
                  "alternativeTitles",
                  "description",
                  "tags",
                  "thumbnailHook",
                ],
              },
            },
          });

          const text = response.text;
          if (!text) {
            throw new Error("Empty response from Gemini API.");
          }

          const parsed = JSON.parse(text);
          return NextResponse.json({
            ...parsed,
            angleUsed: randomAngle,
            generatedAt: new Date().toISOString(),
          });
        } catch (err: unknown) {
          lastError = err;
          const errMsg = err instanceof Error ? err.message : String(err);
          const isOverloaded =
            errMsg.includes("503") ||
            errMsg.includes("UNAVAILABLE") ||
            errMsg.includes("high demand") ||
            errMsg.includes("overloaded") ||
            errMsg.includes("429");
          const isNotFound = errMsg.includes("404") || errMsg.includes("NOT_FOUND");

          if (isNotFound) {
            break;
          }

          if (isOverloaded && attempt === 1) {
            await sleep(1200);
            continue;
          }
          break;
        }
      }
    }

    throw lastError || new Error("Gemini AI service is temporarily busy. Please try again.");
  } catch (error: unknown) {
    console.error("Gemini API Error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate YouTube metadata.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

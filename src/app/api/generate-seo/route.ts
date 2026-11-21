import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CANDIDATE_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-3-flash-preview",
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface SeoPayload {
  title: string;
  description: string;
  tags: string[];
  hashtags: string[];
}

export async function POST(req: NextRequest) {
  try {
    let body: { transcript?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const rawTranscript =
      typeof body?.transcript === "string" ? body.transcript.trim() : "";

    if (!rawTranscript || rawTranscript.length < 5) {
      return NextResponse.json(
        {
          error:
            "Transcript text is empty or too short to generate YouTube SEO metadata.",
        },
        { status: 400 }
      );
    }

    const transcript = rawTranscript.slice(0, 30000);

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

    const prompt = `Act as a YouTube SEO expert. Based on this transcript, generate a high-CTR Title (under 60 chars), a detailed Description (with hashtags), and 15-20 SEO Tags. Return strictly as JSON: { title, description, tags (array), hashtags (array) }.

Guidelines:
- Match the primary language of the transcript (if Urdu/Hindi/non-English, provide natural SEO output appropriate for YouTube viewers of that video).
- "title": Must be punchy, curiosity-driven, and strictly under 60 characters.
- "description": Detailed, engaging SEO description with a strong opening hook, key takeaways, a subscribe CTA, and relevant hashtags at the bottom.
- "tags": Array of 15 to 20 high-value SEO tags/keywords (no '#' prefix).
- "hashtags": Array of 4 to 8 relevant hashtags (each starting with '#').

TRANSCRIPT:
"""
${transcript}
"""`;

    let lastError: unknown = null;

    for (const modelName of CANDIDATE_MODELS) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              temperature: 0.7,
              topP: 0.95,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: {
                    type: Type.STRING,
                    description: "High-CTR YouTube title strictly under 60 characters.",
                  },
                  description: {
                    type: Type.STRING,
                    description:
                      "Detailed SEO-optimized YouTube description including hashtags.",
                  },
                  tags: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "15 to 20 SEO tags/keywords without '#' prefix.",
                  },
                  hashtags: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "4 to 8 hashtags starting with '#'.",
                  },
                },
                required: ["title", "description", "tags", "hashtags"],
              },
            },
          });

          const text = response.text?.trim();
          if (!text) {
            throw new Error("Gemini returned an empty response.");
          }

          const cleanedText = text
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/```\s*$/i, "")
            .trim();

          const parsed = JSON.parse(cleanedText) as Partial<SeoPayload>;

          const title = (parsed.title || "").trim().slice(0, 100);
          const description = (parsed.description || "").trim();
          const tags = Array.isArray(parsed.tags)
            ? parsed.tags
                .map((t) => String(t).replace(/^#/, "").trim())
                .filter(Boolean)
                .slice(0, 25)
            : [];
          const hashtags = Array.isArray(parsed.hashtags)
            ? parsed.hashtags
                .map((h) => {
                  const clean = String(h).trim().replace(/\s+/g, "");
                  if (!clean) return "";
                  return clean.startsWith("#") ? clean : `#${clean}`;
                })
                .filter(Boolean)
                .slice(0, 12)
            : [];

          if (!title || !description) {
            throw new Error("Gemini JSON response was missing title or description.");
          }

          return NextResponse.json({
            title,
            description,
            tags,
            hashtags,
          });
        } catch (err: unknown) {
          lastError = err;
          const errStr = err instanceof Error ? err.message : String(err);
          const isRetryable =
            errStr.includes("503") ||
            errStr.includes("429") ||
            errStr.toLowerCase().includes("overloaded") ||
            errStr.toLowerCase().includes("rate limit");

          if (isRetryable && attempt < 2) {
            await sleep(900);
            continue;
          }
          break;
        }
      }
    }

    const fallbackMsg =
      lastError instanceof Error
        ? lastError.message
        : "Failed to generate YouTube SEO metadata with Gemini AI.";

    return NextResponse.json({ error: fallbackMsg }, { status: 502 });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Unexpected server error while generating SEO metadata.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

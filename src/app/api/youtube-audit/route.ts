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

function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(
      trimmed.startsWith("http") ? trimmed : `https://${trimmed}`
    );

    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.split("/").filter(Boolean)[0];
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    const vParam = url.searchParams.get("v");
    if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
      return vParam;
    }

    const pathParts = url.pathname.split("/").filter(Boolean);
    const markerIndex = pathParts.findIndex((p) =>
      ["shorts", "embed", "live", "v"].includes(p)
    );
    if (markerIndex !== -1 && pathParts[markerIndex + 1]) {
      const candidate = pathParts[markerIndex + 1].substring(0, 11);
      if (/^[a-zA-Z0-9_-]{11}$/.test(candidate)) return candidate;
    }
  } catch {
    // fallback regex
  }

  const regex =
    /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = trimmed.match(regex);
  return match ? match[1] : null;
}

interface ExtractedVideoMetadata {
  videoId: string;
  title: string;
  description: string;
  tags: string[];
  channelName: string;
  thumbnailUrl: string;
}

// Extract title, full description, and tags from YouTube watch page + youtube-sr + oEmbed fallback
async function fetchYouTubeVideoMetadata(
  videoId: string
): Promise<ExtractedVideoMetadata> {
  let title = "";
  let description = "";
  let tags: string[] = [];
  let channelName = "";
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  // 1. Try youtube-sr first if installed
  try {
    const YouTube = (await import("youtube-sr")).default;
    const video = await YouTube.getVideo(`https://www.youtube.com/watch?v=${videoId}`);
    if (video) {
      title = video.title || "";
      description = video.description || "";
      tags = Array.isArray(video.tags) ? video.tags : [];
      channelName = video.channel?.name || "";
    }
  } catch {
    // Continue to direct YouTube watch HTML parser
  }

  // 2. Fetch YouTube watch page directly to extract full ytInitialPlayerResponse (gives exact description & keywords/tags)
  if (!title || !description || tags.length === 0) {
    try {
      const watchRes = await fetch(
        `https://www.youtube.com/watch?v=${videoId}&hl=en`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
          },
        }
      );

      if (watchRes.ok) {
        const html = await watchRes.text();

        // Parse ytInitialPlayerResponse JSON block
        const playerMatch = html.match(
          /ytInitialPlayerResponse\s*=\s*(\{[\s\S]*?\});\s*(?:var\s+meta|<\/script>)/
        );
        if (playerMatch && playerMatch[1]) {
          try {
            const playerJson = JSON.parse(playerMatch[1]);
            const details = playerJson?.videoDetails;
            if (details) {
              title = title || details.title || "";
              description = description || details.shortDescription || "";
              channelName = channelName || details.author || "";
              if (
                tags.length === 0 &&
                Array.isArray(details.keywords)
              ) {
                tags = details.keywords;
              }
            }
          } catch {
            // fallback to meta tag regexes below
          }
        }

        // Meta tag fallbacks if player JSON was partial
        if (!title) {
          const titleMatch = html.match(
            /<meta\s+name="title"\s+content="([^"]*)"/i
          );
          if (titleMatch) title = titleMatch[1];
        }
        if (!description) {
          const descMatch = html.match(
            /<meta\s+name="description"\s+content="([^"]*)"/i
          );
          if (descMatch) description = descMatch[1];
        }
        if (tags.length === 0) {
          const kwMatch = html.match(
            /<meta\s+name="keywords"\s+content="([^"]*)"/i
          );
          if (kwMatch && kwMatch[1]) {
            tags = kwMatch[1]
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);
          }
        }
      }
    } catch {
      // Continue to oEmbed fallback
    }
  }

  // 3. Final fallback to official YouTube oEmbed endpoint for title & author
  if (!title) {
    try {
      const oembedRes = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
      );
      if (oembedRes.ok) {
        const oembed = await oembedRes.json();
        title = oembed.title || "";
        channelName = channelName || oembed.author_name || "";
      }
    } catch {
      // ignore
    }
  }

  return {
    videoId,
    title: title || `YouTube Video (${videoId})`,
    description: description || "(No description found on this video)",
    tags,
    channelName: channelName || "YouTube Creator",
    thumbnailUrl,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Please provide a valid YouTube video URL." },
        { status: 400 }
      );
    }

    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        {
          error:
            "Could not extract a valid 11-character YouTube Video ID from that URL.",
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

    // 1. Extract live video metadata from YouTube
    const videoData = await fetchYouTubeVideoMetadata(videoId);

    // 2. Analyze with Gemini AI
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are a senior YouTube SEO Auditor and Growth Strategist.
Analyze the following real YouTube video metadata and return a thorough, objective SEO Audit scorecard.

EXTRACTED YOUTUBE VIDEO DATA:
- Video ID: ${videoData.videoId}
- Channel: ${videoData.channelName}
- Title (${videoData.title.length} chars): "${videoData.title}"
- Description (${videoData.description.length} chars):
"""
${videoData.description.slice(0, 3500)}
"""
- Tags (${videoData.tags.length} tags): ${
      videoData.tags.length > 0 ? videoData.tags.join(", ") : "None found"
    }

AUDIT REQUIREMENTS:
1. "score": Overall SEO score from 0 to 100 based on title length/CTR hook, keyword placement, description depth, timestamps/links presence, and tag coverage.
2. "scoreSummary": A 1-2 sentence executive summary of the video's current SEO health.
3. "titleAnalysis":
   - "status": "good" | "warning" | "critical"
   - "feedback": Detailed analysis of the title (length, curiosity hook, keyword front-loading).
   - "strengths": Array of 1-3 positive points (green checks).
   - "warnings": Array of 1-3 issues or missing elements (red/amber warnings).
   - "improvedTitleSuggestion": A stronger, high-CTR suggested rewrite of the title.
4. "descriptionAnalysis":
   - "status": "good" | "warning" | "critical"
   - "feedback": Detailed analysis of the description (above-the-fold hook, word count, links, chapters/timestamps, hashtags).
   - "strengths": Array of 1-3 positive points.
   - "warnings": Array of 1-3 issues or missing elements.
5. "tagsAnalysis":
   - "status": "good" | "warning" | "critical"
   - "feedback": Detailed analysis of the tags count and keyword variety.
   - "strengths": Array of 1-3 positive points.
   - "warnings": Array of 1-3 issues or missing elements.
   - "recommendedTags": Array of 8-12 high-value SEO tags the creator should add.
6. "actionableTips": Array of 4 to 6 concrete, prioritized action items the creator can implement immediately to rank higher.`;

    let lastError: unknown = null;

    for (const modelName of CANDIDATE_MODELS) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              temperature: 0.7,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  score: { type: Type.INTEGER },
                  scoreSummary: { type: Type.STRING },
                  titleAnalysis: {
                    type: Type.OBJECT,
                    properties: {
                      status: { type: Type.STRING },
                      feedback: { type: Type.STRING },
                      strengths: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      warnings: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      improvedTitleSuggestion: { type: Type.STRING },
                    },
                    required: [
                      "status",
                      "feedback",
                      "strengths",
                      "warnings",
                      "improvedTitleSuggestion",
                    ],
                  },
                  descriptionAnalysis: {
                    type: Type.OBJECT,
                    properties: {
                      status: { type: Type.STRING },
                      feedback: { type: Type.STRING },
                      strengths: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      warnings: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                    },
                    required: ["status", "feedback", "strengths", "warnings"],
                  },
                  tagsAnalysis: {
                    type: Type.OBJECT,
                    properties: {
                      status: { type: Type.STRING },
                      feedback: { type: Type.STRING },
                      strengths: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      warnings: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      recommendedTags: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                    },
                    required: [
                      "status",
                      "feedback",
                      "strengths",
                      "warnings",
                      "recommendedTags",
                    ],
                  },
                  actionableTips: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: [
                  "score",
                  "scoreSummary",
                  "titleAnalysis",
                  "descriptionAnalysis",
                  "tagsAnalysis",
                  "actionableTips",
                ],
              },
            },
          });

          const text = response.text;
          if (!text) throw new Error("Empty response from Gemini API.");

          const audit = JSON.parse(text);
          return NextResponse.json({
            videoData,
            audit,
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

    throw (
      lastError ||
      new Error("Gemini AI service is temporarily busy. Please try again.")
    );
  } catch (error: unknown) {
    console.error("YouTube Audit Error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to audit YouTube video.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

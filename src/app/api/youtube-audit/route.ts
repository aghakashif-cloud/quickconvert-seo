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

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMessage)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 5000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function isPlaceholderYouTubeTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase();
  return (
    !normalized ||
    normalized === "youtube" ||
    normalized === "- youtube" ||
    normalized.includes("before you continue to youtube") ||
    normalized.includes("consent.youtube.com")
  );
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

class YouTubeFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YouTubeFetchError";
  }
}

async function fetchOembed(videoId: string): Promise<{
  title: string;
  channelName: string;
}> {
  const res = await fetchWithTimeout(
    `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
    {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      },
      cache: "no-store",
    },
    4500
  );

  if (!res.ok) {
    throw new Error(`oEmbed responded with status ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("oEmbed returned non-JSON response");
  }

  const data = await res.json();
  return {
    title: typeof data.title === "string" ? data.title.trim() : "",
    channelName:
      typeof data.author_name === "string" ? data.author_name.trim() : "",
  };
}

async function fetchWatchPageMetadata(videoId: string): Promise<{
  title: string;
  description: string;
  tags: string[];
  channelName: string;
}> {
  const res = await fetchWithTimeout(
    `https://www.youtube.com/watch?v=${videoId}&hl=en`,
    {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        Cookie: "CONSENT=YES+cb.20210328-17-p0.en+FX+667",
      },
      cache: "no-store",
    },
    5500
  );

  if (!res.ok) {
    throw new Error(`Watch page responded with status ${res.status}`);
  }

  const html = await res.text();
  let title = "";
  let description = "";
  let tags: string[] = [];
  let channelName = "";

  // Extract shortDescription from ytInitialPlayerResponse
  const shortDescMatch = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
  if (shortDescMatch && shortDescMatch[1]) {
    try {
      description = JSON.parse(`"${shortDescMatch[1]}"`);
    } catch {
      description = shortDescMatch[1].replace(/\\n/g, "\n");
    }
  }

  // Extract keywords array from videoDetails
  const keywordsMatch = html.match(/"keywords":(\[[^\]]*\])/);
  if (keywordsMatch && keywordsMatch[1]) {
    try {
      const parsedKw = JSON.parse(keywordsMatch[1]);
      if (Array.isArray(parsedKw)) {
        tags = parsedKw.map((k) => String(k).trim()).filter(Boolean);
      }
    } catch {
      // fallback to meta keywords
    }
  }

  // Extract video title from videoDetails JSON
  const videoTitleMatch = html.match(
    /"videoDetails":\{[^}]*?"title":"((?:[^"\\]|\\.)*)"/
  );
  if (videoTitleMatch && videoTitleMatch[1]) {
    try {
      title = JSON.parse(`"${videoTitleMatch[1]}"`);
    } catch {
      title = videoTitleMatch[1];
    }
  }

  // Extract channel author from videoDetails JSON
  const authorMatch = html.match(
    /"videoDetails":\{[^}]*?"author":"((?:[^"\\]|\\.)*)"/
  );
  if (authorMatch && authorMatch[1]) {
    try {
      channelName = JSON.parse(`"${authorMatch[1]}"`);
    } catch {
      channelName = authorMatch[1];
    }
  }

  // Meta tag fallbacks
  if (!title) {
    const titleMatch = html.match(/<meta\s+name="title"\s+content="([^"]*)"/i);
    if (titleMatch && titleMatch[1]) {
      title = decodeHtmlEntities(titleMatch[1]);
    }
  }

  if (!description) {
    const descMatch = html.match(
      /<meta\s+name="description"\s+content="([^"]*)"/i
    );
    if (descMatch && descMatch[1]) {
      description = decodeHtmlEntities(descMatch[1]);
    }
  }

  if (tags.length === 0) {
    const kwMatch = html.match(/<meta\s+name="keywords"\s+content="([^"]*)"/i);
    if (kwMatch && kwMatch[1]) {
      tags = decodeHtmlEntities(kwMatch[1])
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }

  if (isPlaceholderYouTubeTitle(title)) {
    title = "";
  }

  return { title, description, tags, channelName };
}

async function fetchNoembedFallback(videoId: string): Promise<{
  title: string;
  channelName: string;
}> {
  const res = await fetchWithTimeout(
    `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`,
    { cache: "no-store" },
    4000
  );
  if (!res.ok) {
    throw new Error(`Noembed responded with status ${res.status}`);
  }
  const data = await res.json();
  if (data.error) {
    throw new Error(String(data.error));
  }
  return {
    title: typeof data.title === "string" ? data.title.trim() : "",
    channelName:
      typeof data.author_name === "string" ? data.author_name.trim() : "",
  };
}

// Fast parallel extraction with strict timeouts to prevent Vercel serverless timeouts
async function fetchYouTubeVideoMetadata(
  videoId: string
): Promise<ExtractedVideoMetadata> {
  let title = "";
  let description = "";
  let tags: string[] = [];
  let channelName = "";
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  // 1. Run official oEmbed + Watch HTML in parallel with tight timeouts (~5.5s max combined)
  const [oembedResult, watchResult] = await Promise.allSettled([
    fetchOembed(videoId),
    fetchWatchPageMetadata(videoId),
  ]);

  if (oembedResult.status === "fulfilled") {
    title = oembedResult.value.title || title;
    channelName = oembedResult.value.channelName || channelName;
  }

  if (watchResult.status === "fulfilled") {
    title = title || watchResult.value.title;
    description = watchResult.value.description || description;
    tags = watchResult.value.tags.length > 0 ? watchResult.value.tags : tags;
    channelName = channelName || watchResult.value.channelName;
  }

  // 2. If primary YouTube endpoints were blocked or returned empty title, run fast fallbacks in parallel
  if (isPlaceholderYouTubeTitle(title)) {
    const [noembedResult, srResult] = await Promise.allSettled([
      fetchNoembedFallback(videoId),
      withTimeout(
        (async () => {
          const YouTube = (await import("youtube-sr")).default;
          return YouTube.getVideo(`https://www.youtube.com/watch?v=${videoId}`);
        })(),
        4000,
        "youtube-sr lookup timed out"
      ),
    ]);

    if (noembedResult.status === "fulfilled") {
      title = title || noembedResult.value.title;
      channelName = channelName || noembedResult.value.channelName;
    }

    if (srResult.status === "fulfilled" && srResult.value) {
      const video = srResult.value;
      title = title || video.title || "";
      description = description || video.description || "";
      if (tags.length === 0 && Array.isArray(video.tags)) {
        tags = video.tags;
      }
      channelName = channelName || video.channel?.name || "";
    }
  }

  // If we could not obtain even the video title, YouTube likely blocked the request or the video is unavailable
  if (isPlaceholderYouTubeTitle(title)) {
    throw new YouTubeFetchError(
      "Could not fetch video data. YouTube may be blocking the request, or the video may be private/unavailable."
    );
  }

  return {
    videoId,
    title: title.trim(),
    description:
      description.trim() ||
      "(No full description could be extracted from YouTube for this video.)",
    tags,
    channelName: channelName.trim() || "YouTube Creator",
    thumbnailUrl,
  };
}

export async function POST(req: NextRequest) {
  try {
    let body: { url?: string } = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload in request body." },
        { status: 400 }
      );
    }

    const { url } = body;

    if (!url || typeof url !== "string" || !url.trim()) {
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
            "Invalid YouTube URL. Please enter a valid watch link (e.g., https://www.youtube.com/watch?v=...) or Shorts link.",
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
            "Server configuration error: GEMINI_API_KEY is missing in environment variables.",
        },
        { status: 500 }
      );
    }

    // 1. Extract live video metadata from YouTube with strict timeouts & error handling
    let videoData: ExtractedVideoMetadata;
    try {
      videoData = await fetchYouTubeVideoMetadata(videoId);
    } catch (fetchErr: unknown) {
      console.error("YouTube Metadata Fetch Error:", fetchErr);
      const message =
        fetchErr instanceof YouTubeFetchError
          ? fetchErr.message
          : "Could not fetch video data. YouTube may be blocking the request.";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    // 2. Analyze and generate optimized SEO solutions with Gemini AI
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are a world-class YouTube SEO Expert, Auditor, and Growth Strategist.
Analyze the following real YouTube video metadata to return a thorough, objective SEO Audit scorecard AND generate ready-to-use, high-performing SEO solutions (an optimized title, a fully written description, and 15-20 optimized tags) that the creator can immediately copy and paste into YouTube Studio.

EXTRACTED YOUTUBE VIDEO DATA:
- Video ID: ${videoData.videoId}
- Channel: ${videoData.channelName}
- Title (${videoData.title.length} chars): "${videoData.title}"
- Description (${videoData.description.length} chars):
"""
${videoData.description.slice(0, 3000)}
"""
- Tags (${videoData.tags.length} tags): ${
      videoData.tags.length > 0 ? videoData.tags.join(", ") : "None found"
    }

AUDIT & SOLUTION REQUIREMENTS:
1. "score": Overall SEO score from 0 to 100 based on title length/CTR hook, keyword placement, description depth, timestamps/links presence, and tag coverage.
2. "scoreSummary": A 1-2 sentence executive summary of the video's current SEO health.
3. "titleAnalysis":
   - "status": "good" | "warning" | "critical"
   - "feedback": Detailed analysis of the title (length, curiosity hook, keyword front-loading).
   - "strengths": Array of 1-3 positive points (green checks).
   - "warnings": Array of 1-3 issues or missing elements (red/amber warnings).
   - "improvedTitleSuggestion": A stronger, high-CTR suggested rewrite of the title (under 60 characters).
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
6. "actionableTips": Array of 4 to 6 concrete, prioritized action items the creator can implement immediately to rank higher.
7. "optimizedTitle": A single high-CTR, SEO-friendly YouTube video title strictly under 60 characters, front-loaded with the primary keyword and engineered to maximize clicks.
8. "optimizedDescription": A complete, ready-to-paste YouTube video description tailored to this video's topic. Structure it cleanly with line breaks:
   - A compelling 2-sentence above-the-fold hook containing the primary keyword.
   - A concise, keyword-rich summary of what viewers will learn/see (using short paragraphs or bullet points).
   - A brief call-to-action (like, subscribe, comment).
   - 3 to 5 relevant YouTube hashtags at the very end (e.g., #YouTubeSEO #Tutorial).
9. "optimizedTags": An array of 15 to 20 highly relevant, high-search-volume SEO tags (mixing broad head terms, exact-match phrases, and long-tail keywords) tailored specifically to this video. Do not prefix tags with "#".`;

    let lastError: unknown = null;

    for (const modelName of CANDIDATE_MODELS) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await withTimeout(
            ai.models.generateContent({
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
                    optimizedTitle: { type: Type.STRING },
                    optimizedDescription: { type: Type.STRING },
                    optimizedTags: {
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
                    "optimizedTitle",
                    "optimizedDescription",
                    "optimizedTags",
                  ],
                },
              },
            }),
            25000,
            `Gemini API (${modelName}) timed out after 25 seconds.`
          );

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
          const isTimeout = errMsg.toLowerCase().includes("timed out");

          if (isNotFound || isTimeout) break;
          if (isOverloaded && attempt === 1) {
            await sleep(1000);
            continue;
          }
          break;
        }
      }
    }

    const finalErrMessage =
      lastError instanceof Error
        ? lastError.message
        : "Gemini AI service is temporarily busy. Please try again.";
    return NextResponse.json(
      { error: `AI audit failed: ${finalErrMessage}` },
      { status: 500 }
    );
  } catch (error: unknown) {
    console.error("YouTube Audit API Error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to audit YouTube video. Please check the URL and try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

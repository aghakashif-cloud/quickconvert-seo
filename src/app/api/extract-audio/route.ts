import { NextRequest, NextResponse } from "next/server";
import type { Readable } from "node:stream";
import {
  Ytdl,
  chooseFormat,
  Quality,
  parseVideoId,
  YtdlError,
} from "@distube/ytdl-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Stay safely beneath Vercel's 60-second serverless timeout
const EXTRACTION_TIMEOUT_MS = 50_000;
// Limit link-based transcription to videos under 10 minutes
const MAX_DURATION_SECONDS = 600;
// Hard cap on downloaded stream size (25 MB) to protect server memory
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

let ytdlInstance: Ytdl | null = null;

function getYtdl(): Ytdl {
  if (!ytdlInstance) {
    ytdlInstance = new Ytdl({ timeoutMs: 25_000 });
  }
  return ytdlInstance;
}

type SupportedPlatform = "youtube" | "facebook";

function detectPlatform(rawUrl: string): {
  platform: SupportedPlatform;
  parsedUrl: URL;
} | null {
  try {
    const parsedUrl = new URL(rawUrl.trim());
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return null;
    }

    const host = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");

    if (
      host === "youtube.com" ||
      host === "youtu.be" ||
      host === "m.youtube.com" ||
      host === "music.youtube.com" ||
      host.endsWith(".youtube.com")
    ) {
      return { platform: "youtube", parsedUrl };
    }

    if (
      host === "facebook.com" ||
      host === "m.facebook.com" ||
      host === "mbasic.facebook.com" ||
      host === "web.facebook.com" ||
      host === "fb.watch" ||
      host.endsWith(".facebook.com")
    ) {
      return { platform: "facebook", parsedUrl };
    }

    return null;
  } catch {
    return null;
  }
}

function formatDurationLabel(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function sanitizeHeaderValue(value: string): string {
  return encodeURIComponent(value.slice(0, 140));
}

function resolveMimeAndExt(
  mimeType: string | undefined,
  container: string | undefined
): { contentType: string; extension: string } {
  const baseMime = (mimeType || "").split(";")[0].trim().toLowerCase();
  if (baseMime === "audio/webm" || container === "webm") {
    return { contentType: "audio/webm", extension: "webm" };
  }
  if (baseMime === "audio/mpeg" || baseMime === "audio/mp3" || container === "mp3") {
    return { contentType: "audio/mpeg", extension: "mp3" };
  }
  if (baseMime === "audio/mp4" || baseMime === "audio/m4a" || container === "m4a") {
    return { contentType: "audio/mp4", extension: "m4a" };
  }
  if (baseMime === "video/mp4" || container === "mp4") {
    return { contentType: "audio/mp4", extension: "mp4" };
  }
  if (baseMime.startsWith("audio/")) {
    return { contentType: baseMime, extension: container || "webm" };
  }
  return { contentType: "audio/webm", extension: container || "webm" };
}

/**
 * Waits for the first non-empty chunk from a Node Readable stream so upstream
 * errors (403, unavailable stream, timeout) can be returned as JSON before
 * sending an HTTP 200 streaming response.
 */
async function primeNodeReadable(
  nodeStream: Readable,
  signal: AbortSignal
): Promise<{
  firstChunk: Uint8Array;
  iterator: AsyncIterator<Buffer | Uint8Array>;
}> {
  const iterator = nodeStream[Symbol.asyncIterator]();

  const onAbort = () => {
    nodeStream.destroy(new Error("Audio extraction timed out after 50 seconds."));
  };

  if (signal.aborted) {
    onAbort();
    throw new Error("Audio extraction timed out after 50 seconds.");
  }

  signal.addEventListener("abort", onAbort, { once: true });

  try {
    while (true) {
      const next = await iterator.next();
      if (next.done) {
        throw new Error("The upstream audio stream returned no data.");
      }
      const chunk =
        next.value instanceof Uint8Array
          ? next.value
          : new Uint8Array(Buffer.from(next.value));
      if (chunk.byteLength > 0) {
        return { firstChunk: chunk, iterator };
      }
    }
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

function createCappedWebStream(
  firstChunk: Uint8Array,
  iterator: AsyncIterator<Buffer | Uint8Array>,
  nodeStream: Readable,
  signal: AbortSignal,
  clearDeadline: () => void
): ReadableStream<Uint8Array> {
  let bytesSent = 0;
  let firstChunkQueued = false;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (!firstChunkQueued) {
          firstChunkQueued = true;
          bytesSent += firstChunk.byteLength;
          controller.enqueue(firstChunk);
          return;
        }

        if (signal.aborted) {
          nodeStream.destroy();
          clearDeadline();
          controller.error(
            new Error("Audio extraction exceeded the 50-second server timeout.")
          );
          return;
        }

        const next = await iterator.next();
        if (next.done) {
          clearDeadline();
          controller.close();
          return;
        }

        const chunk =
          next.value instanceof Uint8Array
            ? next.value
            : new Uint8Array(Buffer.from(next.value));

        bytesSent += chunk.byteLength;
        if (bytesSent > MAX_AUDIO_BYTES) {
          nodeStream.destroy();
          clearDeadline();
          controller.error(
            new Error(
              "Audio stream exceeded the 25 MB server limit. Please download and upload the file directly."
            )
          );
          return;
        }

        controller.enqueue(chunk);
      } catch (err) {
        nodeStream.destroy();
        clearDeadline();
        controller.error(err);
      }
    },
    cancel() {
      nodeStream.destroy();
      clearDeadline();
    },
  });
}

function decodeFacebookJsonString(raw: string): string {
  try {
    return JSON.parse(`"${raw}"`);
  } catch {
    return raw
      .replace(/\\\//g, "/")
      .replace(/\\u0025/g, "%")
      .replace(/\\u0026/g, "&")
      .replace(/&amp;/g, "&");
  }
}

function isAllowedFacebookCdnUrl(mediaUrl: string): boolean {
  try {
    const parsed = new URL(mediaUrl);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host.endsWith(".fbcdn.net") ||
      host === "fbcdn.net" ||
      host.endsWith(".facebook.com") ||
      host === "facebook.com"
    );
  } catch {
    return false;
  }
}

async function extractYouTubeAudio(
  url: string,
  signal: AbortSignal,
  clearDeadline: () => void
): Promise<Response> {
  const videoId = parseVideoId(url);
  if (!videoId) {
    clearDeadline();
    return NextResponse.json(
      { error: "Could not find a valid YouTube video ID in that URL." },
      { status: 400 }
    );
  }

  const ytdl = getYtdl();
  const info = await ytdl.getInfo(videoId, { signal });
  const details = info.videoDetails;

  if (details.isLive || details.isUpcoming) {
    clearDeadline();
    return NextResponse.json(
      {
        error:
          "Live streams and upcoming premieres cannot be transcribed directly from a link. Please upload a recorded file instead.",
      },
      { status: 400 }
    );
  }

  const durationSec = Number(details.lengthSeconds || 0);
  if (durationSec > MAX_DURATION_SECONDS) {
    clearDeadline();
    return NextResponse.json(
      {
        error: `This YouTube video is ${formatDurationLabel(durationSec)} long. Transcribing from links is limited to videos under 10 minutes due to server limits. Please download and upload the file directly.`,
      },
      { status: 400 }
    );
  }

  const format = chooseFormat(info.formats, {
    quality: Quality.HighestAudio,
    filter: [
      { hasAudio: true, hasVideo: false, isLive: false },
      { hasAudio: true, isLive: false },
    ],
  });

  if (format.contentLength && format.contentLength > MAX_AUDIO_BYTES) {
    clearDeadline();
    return NextResponse.json(
      {
        error:
          "The audio stream for this video exceeds the 25 MB server transfer limit. Please download and upload the file directly.",
      },
      { status: 413 }
    );
  }

  const { contentType, extension } = resolveMimeAndExt(
    format.mimeType,
    format.container
  );

  const nodeStream = ytdl.download(info, {
    format,
    signal,
    highWaterMark: 1 << 18, // 256 KB chunks
  });

  const { firstChunk, iterator } = await primeNodeReadable(nodeStream, signal);
  const webStream = createCappedWebStream(
    firstChunk,
    iterator,
    nodeStream,
    signal,
    clearDeadline
  );

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Media-Title": sanitizeHeaderValue(details.title || `youtube-${videoId}`),
    "X-Media-Duration": String(durationSec),
    "X-Media-Extension": extension,
    "X-Media-Platform": "youtube",
  };

  if (format.contentLength && format.contentLength > 0) {
    headers["Content-Length"] = String(format.contentLength);
  }

  return new Response(webStream, { status: 200, headers });
}

async function extractFacebookAudio(
  url: string,
  signal: AbortSignal,
  clearDeadline: () => void
): Promise<Response> {
  const pageResponse = await fetch(url, {
    method: "GET",
    redirect: "follow",
    signal,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Dest": "document",
    },
  });

  if (!pageResponse.ok) {
    clearDeadline();
    return NextResponse.json(
      {
        error:
          "Unable to load that Facebook URL. Make sure the video is public, or download and upload it directly.",
      },
      { status: 422 }
    );
  }

  const html = await pageResponse.text();

  // Check duration if exposed in Facebook's embedded JSON
  const durationMatch = html.match(/"playable_duration_in_ms"\s*:\s*(\d+)/);
  const durationSec = durationMatch
    ? Math.round(Number(durationMatch[1]) / 1000)
    : 0;

  if (durationSec > MAX_DURATION_SECONDS) {
    clearDeadline();
    return NextResponse.json(
      {
        error: `This Facebook video is ${formatDurationLabel(durationSec)} long. Transcribing from links is limited to videos under 10 minutes due to server limits. Please download and upload the file directly.`,
      },
      { status: 400 }
    );
  }

  // Extract a clean video title if available
  const ogTitleMatch =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
    html.match(/<title>([^<]+)<\/title>/i);
  const title = ogTitleMatch?.[1]?.trim() || "facebook-video";

  // Try audio-only DASH representation first, then SD/HD playable URLs, then og:video
  const candidatePatterns: RegExp[] = [
    /"mime_type":"audio\\\/mp4"[^}]*?"base_url":"(https:[^"]+)"/,
    /"audio_url":"(https:[^"]+)"/,
    /"browser_native_sd_url":"(https:[^"]+)"/,
    /"playable_url":"(https:[^"]+)"/,
    /"browser_native_hd_url":"(https:[^"]+)"/,
    /"playable_url_quality_hd":"(https:[^"]+)"/,
    /<meta[^>]+property=["']og:video(?::secure_url)?["'][^>]+content=["'](https:[^"']+)["']/i,
  ];

  let mediaUrl: string | null = null;
  for (const pattern of candidatePatterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const decoded = decodeFacebookJsonString(match[1]);
      if (isAllowedFacebookCdnUrl(decoded)) {
        mediaUrl = decoded;
        break;
      }
    }
  }

  if (!mediaUrl) {
    clearDeadline();
    return NextResponse.json(
      {
        error:
          "Could not extract an audio stream from this Facebook link. Facebook often restricts private videos or login-protected posts—please make sure the video is public or download and upload it directly.",
      },
      { status: 422 }
    );
  }

  const mediaResponse = await fetch(mediaUrl, {
    method: "GET",
    redirect: "follow",
    signal,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Referer: "https://www.facebook.com/",
    },
  });

  if (!mediaResponse.ok || !mediaResponse.body) {
    clearDeadline();
    return NextResponse.json(
      {
        error:
          "Facebook refused the media stream request. Please download the video and upload it directly.",
      },
      { status: 422 }
    );
  }

  const contentLengthHeader = mediaResponse.headers.get("content-length");
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : 0;
  if (contentLength > MAX_AUDIO_BYTES) {
    clearDeadline();
    return NextResponse.json(
      {
        error:
          "This Facebook video file exceeds the 25 MB server limit. Please download and upload it directly.",
      },
      { status: 413 }
    );
  }

  const upstreamType = (mediaResponse.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  const isAudioMime = upstreamType.startsWith("audio/");
  const contentType = isAudioMime ? upstreamType : "audio/mp4";
  const extension = upstreamType.includes("webm")
    ? "webm"
    : upstreamType.includes("mpeg")
    ? "mp3"
    : "mp4";

  const reader = mediaResponse.body.getReader();
  const firstRead = await reader.read();
  if (firstRead.done || !firstRead.value || firstRead.value.byteLength === 0) {
    reader.releaseLock();
    clearDeadline();
    return NextResponse.json(
      {
        error:
          "The Facebook media stream returned no audio data. Please download and upload the file directly.",
      },
      { status: 422 }
    );
  }

  let bytesSent = 0;
  let sentFirst = false;
  const firstChunk = firstRead.value;

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (!sentFirst) {
          sentFirst = true;
          bytesSent += firstChunk.byteLength;
          controller.enqueue(firstChunk);
          return;
        }

        if (signal.aborted) {
          await reader.cancel().catch(() => {});
          clearDeadline();
          controller.error(
            new Error("Audio extraction exceeded the 50-second server timeout.")
          );
          return;
        }

        const { done, value } = await reader.read();
        if (done) {
          clearDeadline();
          controller.close();
          return;
        }

        bytesSent += value.byteLength;
        if (bytesSent > MAX_AUDIO_BYTES) {
          await reader.cancel().catch(() => {});
          clearDeadline();
          controller.error(
            new Error(
              "Video stream exceeded the 25 MB server limit. Please download and upload the file directly."
            )
          );
          return;
        }

        controller.enqueue(value);
      } catch (err) {
        await reader.cancel().catch(() => {});
        clearDeadline();
        controller.error(err);
      }
    },
    cancel() {
      void reader.cancel().catch(() => {});
      clearDeadline();
    },
  });

  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "X-Media-Title": sanitizeHeaderValue(title),
    "X-Media-Duration": String(durationSec),
    "X-Media-Extension": extension,
    "X-Media-Platform": "facebook",
  };

  if (contentLength > 0) {
    headers["Content-Length"] = String(contentLength);
  }

  return new Response(stream, { status: 200, headers });
}

export async function POST(request: NextRequest) {
  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body. Please provide a video URL." },
      { status: 400 }
    );
  }

  const rawUrl = typeof body?.url === "string" ? body.url.trim() : "";
  if (!rawUrl) {
    return NextResponse.json(
      { error: "Please paste a valid YouTube or Facebook video URL." },
      { status: 400 }
    );
  }

  const detected = detectPlatform(rawUrl);
  if (!detected) {
    return NextResponse.json(
      {
        error:
          "Unsupported URL. Please enter a valid public YouTube (youtube.com / youtu.be) or Facebook (facebook.com / fb.watch) video link.",
      },
      { status: 400 }
    );
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort(
      new Error("Server audio extraction timed out after 50 seconds.")
    );
  }, EXTRACTION_TIMEOUT_MS);

  const clearDeadline = () => {
    clearTimeout(timeoutId);
  };

  try {
    if (detected.platform === "youtube") {
      return await extractYouTubeAudio(
        detected.parsedUrl.toString(),
        abortController.signal,
        clearDeadline
      );
    }

    return await extractFacebookAudio(
      detected.parsedUrl.toString(),
      abortController.signal,
      clearDeadline
    );
  } catch (err: unknown) {
    clearDeadline();

    if (abortController.signal.aborted) {
      return NextResponse.json(
        {
          error:
            "Audio extraction timed out after 50 seconds. Try a shorter video (under 10 minutes), or download and upload the file directly.",
        },
        { status: 504 }
      );
    }

    if (err instanceof YtdlError) {
      return NextResponse.json(
        {
          error:
            err.message ||
            "YouTube blocked or could not resolve this video stream. Try another public link or upload the file directly.",
        },
        { status: 422 }
      );
    }

    const message =
      err instanceof Error
        ? err.message
        : "Failed to extract audio from the provided link.";

    return NextResponse.json(
      {
        error: `${message} If the video is private, age-restricted, or region-locked, please download and upload it directly.`,
      },
      { status: 500 }
    );
  }
}

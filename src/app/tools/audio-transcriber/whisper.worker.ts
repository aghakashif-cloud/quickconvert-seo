import {
  pipeline,
  env,
  type AutomaticSpeechRecognitionPipeline,
  type AutomaticSpeechRecognitionOutput,
} from "@xenova/transformers";

// Configure Transformers.js to run strictly in the browser and cache models in IndexedDB/Cache API
env.allowLocalModels = false;
env.useBrowserCache = true;

let cachedPipeline: AutomaticSpeechRecognitionPipeline | null = null;
let cachedModelId: string | null = null;

interface TranscribeRequest {
  type: "transcribe";
  audio: Float32Array;
  model: string;
  durationSeconds: number;
}

interface ProgressCallbackPayload {
  status?: string;
  name?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

async function getTranscriber(
  modelId: string
): Promise<AutomaticSpeechRecognitionPipeline> {
  if (cachedPipeline && cachedModelId === modelId) {
    self.postMessage({
      type: "model-ready",
      model: modelId,
      fromCache: true,
    });
    return cachedPipeline;
  }

  // Dispose previous pipeline if switching models to free browser RAM
  if (cachedPipeline) {
    try {
      await cachedPipeline.dispose();
    } catch {
      // ignore disposal error
    }
    cachedPipeline = null;
    cachedModelId = null;
  }

  const transcriber = await pipeline("automatic-speech-recognition", modelId, {
    quantized: true,
    progress_callback: (data: ProgressCallbackPayload) => {
      self.postMessage({
        type: "model-progress",
        status: data.status || "progress",
        file: data.file || "",
        progress: typeof data.progress === "number" ? data.progress : undefined,
        loaded: typeof data.loaded === "number" ? data.loaded : undefined,
        total: typeof data.total === "number" ? data.total : undefined,
      });
    },
  });

  cachedPipeline = transcriber;
  cachedModelId = modelId;

  self.postMessage({
    type: "model-ready",
    model: modelId,
    fromCache: false,
  });

  return transcriber;
}

self.addEventListener("message", async (event: MessageEvent<TranscribeRequest>) => {
  const message = event.data;
  if (!message || message.type !== "transcribe") return;

  const { audio, model, durationSeconds } = message;

  try {
    const transcriber = await getTranscriber(model);

    const chunkLengthS = 30;
    const strideLengthS = 5;
    const effectiveStep = chunkLengthS - strideLengthS;
    const estimatedChunks = Math.max(
      1,
      Math.ceil(Math.max(1, durationSeconds) / effectiveStep)
    );

    let chunksProcessed = 0;

    self.postMessage({
      type: "transcribe-progress",
      progress: 5,
      chunksProcessed: 0,
      estimatedChunks,
    });

    const rawResult = await transcriber(audio, {
      chunk_length_s: chunkLengthS,
      stride_length_s: strideLengthS,
      return_timestamps: true,
      chunk_callback: () => {
        chunksProcessed += 1;
        const pct = Math.min(
          95,
          Math.max(10, Math.round((chunksProcessed / estimatedChunks) * 95))
        );
        self.postMessage({
          type: "transcribe-progress",
          progress: pct,
          chunksProcessed,
          estimatedChunks,
        });
      },
    });

    const result: AutomaticSpeechRecognitionOutput = Array.isArray(rawResult)
      ? rawResult[0]
      : rawResult;

    self.postMessage({
      type: "complete",
      text: (result?.text || "").trim(),
      chunks: Array.isArray(result?.chunks) ? result.chunks : [],
    });
  } catch (err: unknown) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : "An unexpected error occurred during local Whisper transcription.";
    self.postMessage({
      type: "error",
      message: errorMessage,
    });
  }
});

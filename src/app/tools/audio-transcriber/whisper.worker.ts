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
  language?: string;
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

/**
 * Multilingual Whisper models in Transformers.js default to English when no
 * `language` is passed because of the model's `forced_decoder_ids`.
 * This runs a single 1-token decoder step on the first 30 seconds of audio
 * with `forced_decoder_ids: null` so Whisper predicts the <|lang|> token directly.
 */
async function detectLanguageFromFirst30Seconds(
  transcriber: AutomaticSpeechRecognitionPipeline,
  audio: Float32Array
): Promise<string | null> {
  try {
    const sampleRate = 16000;
    const maxSamples = sampleRate * 30;
    const audioSample =
      audio.length > maxSamples ? audio.subarray(0, maxSamples) : audio;

    const processorFn = transcriber.processor as unknown as (
      input: Float32Array
    ) => Promise<{ input_features: unknown }>;
    const features = await processorFn(audioSample);

    const whisperModel = transcriber.model as unknown as {
      generate: (
        inputs: unknown,
        config: Record<string, unknown>
      ) => Promise<number[][] | { sequences?: number[][] }>;
    };

    const generated = await whisperModel.generate(features.input_features, {
      forced_decoder_ids: null,
      max_new_tokens: 1,
      return_timestamps: false,
    });

    const seq = Array.isArray(generated)
      ? generated[0]
      : generated?.sequences?.[0];
    if (!seq || seq.length < 2) {
      return null;
    }

    const predictedTokenId = seq[1];
    const tokenText = transcriber.tokenizer
      .decode([predictedTokenId], { skip_special_tokens: false })
      .trim();

    const match = tokenText.match(/^<\|([a-z]{2,3})\|>$/);
    if (!match) {
      return null;
    }

    const candidateCode = match[1].toLowerCase();

    // Verify the detected code is accepted by WhisperTokenizer before using it
    const whisperTokenizer = transcriber.tokenizer as unknown as {
      get_decoder_prompt_ids?: (opts: {
        language?: string;
        task?: string;
        no_timestamps?: boolean;
      }) => number[][];
    };
    if (typeof whisperTokenizer.get_decoder_prompt_ids === "function") {
      whisperTokenizer.get_decoder_prompt_ids({
        language: candidateCode,
        task: "transcribe",
        no_timestamps: false,
      });
    }

    return candidateCode;
  } catch {
    return null;
  }
}

type ExtendedASRConfig = Parameters<AutomaticSpeechRecognitionPipeline>[1] & {
  condition_on_previous_text?: boolean;
};

/**
 * Collapses consecutive hallucinated duplicate chunks (e.g., identical sentences
 * repeated 3+ times across silence boundaries) while preserving natural speech.
 */
function deduplicateRepeatedChunks(
  chunks: Array<{ timestamp: [number, number | null]; text: string }>
): {
  chunks: Array<{ timestamp: [number, number | null]; text: string }>;
  text: string;
} {
  const cleaned: Array<{ timestamp: [number, number | null]; text: string }> = [];
  let lastNormalized = "";
  let repeatCount = 0;

  for (const chunk of chunks) {
    const trimmed = (chunk.text || "").trim();
    if (!trimmed) continue;

    const normalized = trimmed.toLowerCase().replace(/\s+/g, " ");
    if (normalized === lastNormalized) {
      repeatCount += 1;
      // Drop consecutive duplicate hallucinations
      if (repeatCount >= 1) continue;
    } else {
      lastNormalized = normalized;
      repeatCount = 0;
    }
    cleaned.push({ ...chunk, text: trimmed });
  }

  return {
    chunks: cleaned,
    text: cleaned.map((c) => c.text).join(" ").trim(),
  };
}

self.addEventListener("message", async (event: MessageEvent<TranscribeRequest>) => {
  const message = event.data;
  if (!message || message.type !== "transcribe") return;

  const { audio, model, language = "auto", durationSeconds } = message;

  try {
    const transcriber = await getTranscriber(model);

    let resolvedLanguage: string;
    let wasAutoDetected = false;

    // Strictly force 'ur' when Urdu is selected (never run auto-detect for explicit languages)
    if (language === "ur") {
      resolvedLanguage = "ur";
      wasAutoDetected = false;
    } else if (!language || language === "auto") {
      self.postMessage({
        type: "detecting-language",
      });

      const detected = await detectLanguageFromFirst30Seconds(
        transcriber,
        audio
      );
      resolvedLanguage = detected || "en";
      wasAutoDetected = Boolean(detected);

      self.postMessage({
        type: "language-detected",
        language: resolvedLanguage,
        autoDetected: wasAutoDetected,
        fallback: !detected,
      });
    } else {
      resolvedLanguage = language;
      wasAutoDetected = false;
    }

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
      language: resolvedLanguage,
    });

    const inferenceOptions: ExtendedASRConfig = {
      language: resolvedLanguage,
      task: "transcribe",
      chunk_length_s: chunkLengthS,
      stride_length_s: strideLengthS,
      condition_on_previous_text: false,
      no_repeat_ngram_size: 3,
      repetition_penalty: 1.15,
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
          language: resolvedLanguage,
        });
      },
    };

    const rawResult = await transcriber(audio, inferenceOptions);

    const result: AutomaticSpeechRecognitionOutput = Array.isArray(rawResult)
      ? rawResult[0]
      : rawResult;

    const rawChunks = Array.isArray(result?.chunks) ? result.chunks : [];
    const cleaned =
      rawChunks.length > 0
        ? deduplicateRepeatedChunks(rawChunks)
        : { chunks: [], text: (result?.text || "").trim() };

    self.postMessage({
      type: "complete",
      text: cleaned.text || (result?.text || "").trim(),
      chunks: cleaned.chunks,
      language: resolvedLanguage,
      autoDetected: wasAutoDetected,
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

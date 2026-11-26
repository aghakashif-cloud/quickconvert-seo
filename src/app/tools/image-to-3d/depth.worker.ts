import { pipeline, env } from "@xenova/transformers";

// Run strictly inside the browser and cache ONNX weights in Cache API / IndexedDB
env.allowLocalModels = false;
env.useBrowserCache = true;

const DEPTH_MODEL_ID = "Xenova/depth-anything-small-hf";

type DepthPipelineFn = (
  input: string
) => Promise<DepthEstimationOutput | DepthEstimationOutput[]>;

interface RawImageLike {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
  channels: number;
}

interface TensorLike {
  data: Float32Array | number[];
  dims: number[];
}

interface DepthEstimationOutput {
  depth?: RawImageLike;
  predicted_depth?: TensorLike;
}

interface ProgressCallbackPayload {
  status?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

interface DepthRequestMessage {
  type: "estimate-depth";
  imageDataUrl: string;
}

let cachedEstimator: DepthPipelineFn | null = null;

async function getDepthEstimator(): Promise<DepthPipelineFn> {
  if (cachedEstimator) {
    self.postMessage({
      type: "model-ready",
      model: DEPTH_MODEL_ID,
      fromCache: true,
    });
    return cachedEstimator;
  }

  const estimator = (await pipeline("depth-estimation", DEPTH_MODEL_ID, {
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
  })) as unknown as DepthPipelineFn;

  cachedEstimator = estimator;

  self.postMessage({
    type: "model-ready",
    model: DEPTH_MODEL_ID,
    fromCache: false,
  });

  return estimator;
}

self.addEventListener(
  "message",
  async (event: MessageEvent<DepthRequestMessage>) => {
    const message = event.data;
    if (!message || message.type !== "estimate-depth") return;

    try {
      const estimator = await getDepthEstimator();

      self.postMessage({
        type: "inferring",
      });

      const rawOutput = await estimator(message.imageDataUrl);
      const output = Array.isArray(rawOutput) ? rawOutput[0] : rawOutput;

      if (output?.depth?.data && output.depth.width && output.depth.height) {
        const { width, height, channels, data } = output.depth;
        const pixelCount = width * height;
        const rgba = new Uint8ClampedArray(pixelCount * 4);

        if (channels === 1) {
          for (let i = 0; i < pixelCount; i++) {
            const v = data[i];
            const idx = i * 4;
            rgba[idx] = v;
            rgba[idx + 1] = v;
            rgba[idx + 2] = v;
            rgba[idx + 3] = 255;
          }
        } else if (channels === 3) {
          for (let i = 0; i < pixelCount; i++) {
            const v = data[i * 3];
            const idx = i * 4;
            rgba[idx] = v;
            rgba[idx + 1] = v;
            rgba[idx + 2] = v;
            rgba[idx + 3] = 255;
          }
        } else {
          for (let i = 0; i < pixelCount; i++) {
            const v = data[i * channels];
            const idx = i * 4;
            rgba[idx] = v;
            rgba[idx + 1] = v;
            rgba[idx + 2] = v;
            rgba[idx + 3] = 255;
          }
        }

        self.postMessage(
          {
            type: "complete",
            width,
            height,
            rgbaBuffer: rgba.buffer,
          },
          { transfer: [rgba.buffer] }
        );
        return;
      }

      // Fallback: normalize predicted_depth tensor to grayscale RGBA
      if (output?.predicted_depth?.data && output.predicted_depth.dims) {
        const dims = output.predicted_depth.dims;
        const height = dims[dims.length - 2];
        const width = dims[dims.length - 1];
        const values = output.predicted_depth.data;

        let minVal = Infinity;
        let maxVal = -Infinity;
        for (let i = 0; i < values.length; i++) {
          const val = values[i];
          if (val < minVal) minVal = val;
          if (val > maxVal) maxVal = val;
        }
        const range = maxVal - minVal || 1;
        const pixelCount = width * height;
        const rgba = new Uint8ClampedArray(pixelCount * 4);

        for (let i = 0; i < pixelCount; i++) {
          const normalized = Math.round(((values[i] - minVal) / range) * 255);
          const idx = i * 4;
          rgba[idx] = normalized;
          rgba[idx + 1] = normalized;
          rgba[idx + 2] = normalized;
          rgba[idx + 3] = 255;
        }

        self.postMessage(
          {
            type: "complete",
            width,
            height,
            rgbaBuffer: rgba.buffer,
          },
          { transfer: [rgba.buffer] }
        );
        return;
      }

      throw new Error("Depth model did not return a valid depth map.");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while generating the 3D depth map.";
      self.postMessage({
        type: "error",
        message: errorMessage,
      });
    }
  }
);

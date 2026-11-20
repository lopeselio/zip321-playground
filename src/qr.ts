// QR code drawing and reading. The libraries are loaded on first use to keep the first load small.

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorConstructor {
  new (options?: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats(): Promise<string[]>;
}

const loadQrcode = () => import('qrcode');
const loadJsQR = () => import('jsqr').then((m) => m.default);

/** Starts fetching the QR libraries in the background, so they also work offline later. */
export function preloadQrLibraries(): void {
  void loadQrcode().catch(() => {});
  void loadJsQR().catch(() => {});
}

/** An SVG QR code of `text`, always dark on light so any camera can read it. */
export async function qrSvg(text: string): Promise<string> {
  const QRCode = await loadQrcode();
  return QRCode.toString(text, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 2,
    color: { dark: '#000000ff', light: '#ffffffff' },
  });
}

let detector: Promise<BarcodeDetectorLike | undefined> | undefined;

/** The native QR detector when the browser has one (Chrome on Android/macOS, Safari 17+ behind flags, …). */
function nativeDetector(): Promise<BarcodeDetectorLike | undefined> {
  detector ??= (async () => {
    const Ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!Ctor) return undefined;
    try {
      const formats = await Ctor.getSupportedFormats();
      return formats.includes('qr_code') ? new Ctor({ formats: ['qr_code'] }) : undefined;
    } catch {
      return undefined;
    }
  })();
  return detector;
}

export const cameraAvailable = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';

function pixels(source: CanvasImageSource, width: number, height: number, maxSide: number): ImageData {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

/** Reads a QR code from an image file. Resolves to `undefined` when none is found. */
export async function decodeImageFile(file: Blob): Promise<string | undefined> {
  const bitmap = await createImageBitmap(file);
  try {
    const native = await nativeDetector();
    if (native) {
      const found = await native.detect(bitmap).catch(() => []);
      if (found[0]) return found[0].rawValue;
    }
    const jsQR = await loadJsQR();
    // Try a moderate size first (fast, works for screenshots), then full resolution for photos.
    for (const maxSide of [1000, 2400]) {
      const data = pixels(bitmap, bitmap.width, bitmap.height, maxSide);
      const code = jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' });
      if (code) return code.data;
      if (Math.max(bitmap.width, bitmap.height) <= maxSide) break;
    }
    return undefined;
  } finally {
    bitmap.close();
  }
}

export interface Scanner {
  stop(): void;
}

/**
 * Opens the rear camera in `video` and calls `onResult` with the first QR code it sees,
 * then stops. Uses the native BarcodeDetector when present, jsQR otherwise.
 * Rejects with the getUserMedia error (e.g. `NotAllowedError`) if the camera cannot be opened.
 */
export async function startScanner(video: HTMLVideoElement, onResult: (text: string) => void): Promise<Scanner> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false,
  });
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    for (const track of stream.getTracks()) track.stop();
    video.srcObject = null;
  };
  video.srcObject = stream;
  try {
    await video.play();
  } catch (err) {
    stop();
    throw err;
  }

  const native = await nativeDetector();
  const jsQR = native ? undefined : await loadJsQR();
  const tick = async () => {
    if (stopped) return;
    if (video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth) {
      let text: string | undefined;
      if (native) {
        text = (await native.detect(video).catch(() => []))[0]?.rawValue;
      } else if (jsQR) {
        const data = pixels(video, video.videoWidth, video.videoHeight, 720);
        text = jsQR(data.data, data.width, data.height, { inversionAttempts: 'dontInvert' })?.data;
      }
      if (text && !stopped) {
        stop();
        onResult(text);
        return;
      }
    }
    timer = setTimeout(tick, 120);
  };
  void tick();
  return { stop };
}

/** A sentence explaining why the camera could not be used. */
export function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException || err instanceof Error ? err.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera access was blocked. Allow it in the browser settings, or upload an image of the QR code instead.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found. Upload an image of the QR code instead.';
    case 'NotReadableError':
      return 'The camera is in use by another app. Close it and try again, or upload an image.';
    default:
      return 'The camera could not be started. Upload an image of the QR code instead.';
  }
}

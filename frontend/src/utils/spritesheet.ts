export interface VideoInfo {
  width: number;
  height: number;
  duration: number;
}

interface SpritesheetOptions {
  fps: number;
  start: number;
  end: number;
  frameSize: number;
  sheetSize: number;
}

export function planSpritesheet(video: VideoInfo, options: SpritesheetOptions) {
  const { fps, start, end, frameSize, sheetSize } = options;
  if (!Number.isInteger(fps) || fps < 1 || fps > 30) {
    throw new Error('FPS harus berupa angka bulat dari 1 sampai 30.');
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > video.duration || start >= end) {
    throw new Error('Pilih waktu mulai dan akhir yang berada di dalam durasi video.');
  }

  const scale = Math.min(1, frameSize / Math.max(video.width, video.height));
  const frameWidth = Math.max(1, Math.round(video.width * scale));
  const frameHeight = Math.max(1, Math.round(video.height * scale));
  // Sample from start inclusive to end exclusive, avoiding an extra frame from rounding.
  const frameCount = Math.max(1, Math.ceil((end - start) * fps - 1e-8));
  if (frameCount > 600 || frameCount * frameWidth * frameHeight > 32_000_000) {
    throw new Error('Klip terlalu besar untuk satu konversi. Pendekkan durasi, turunkan FPS, atau pilih ukuran frame yang lebih kecil.');
  }

  const columns = Math.floor(sheetSize / frameWidth);
  const framesPerSheet = columns * Math.floor(sheetSize / frameHeight);
  return {
    fps, start, end, frameWidth, frameHeight, frameCount, columns, framesPerSheet,
    sheetCount: Math.ceil(frameCount / framesPerSheet),
  };
}

type SpritesheetPlan = ReturnType<typeof planSpritesheet>;

export interface SpritesheetPage {
  file: string;
  width: number;
  height: number;
  columns: number;
  rows: number;
  firstFrame: number;
  frameCount: number;
  blob: Blob;
}

function waitForVideo(video: HTMLVideoElement, event: 'loadeddata' | 'seeked', signal: AbortSignal, begin: () => void) {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    function cleanup() {
      clearTimeout(timer);
      video.removeEventListener(event, ready);
      video.removeEventListener('error', failed);
      signal.removeEventListener('abort', cancelled);
    }
    function ready() {
      cleanup();
      resolve();
    }
    function failed() {
      cleanup();
      reject(new Error('Browser gagal membaca MP4 ini. Coba ekspor ulang video sebagai MP4 H.264.'));
    }
    function cancelled() {
      cleanup();
      reject(signal.reason);
    }

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('Browser terlalu lama membaca frame. Coba lagi dengan klip yang lebih pendek.'));
    }, 20_000);
    video.addEventListener(event, ready, { once: true });
    video.addEventListener('error', failed, { once: true });
    signal.addEventListener('abort', cancelled, { once: true });
    try {
      begin();
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}

function encodePng(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Browser gagal membuat PNG. Coba turunkan ukuran sheet.'));
    }, 'image/png');
  });
}

export async function generateSpritesheets(
  videoUrl: string,
  baseName: string,
  plan: SpritesheetPlan,
  signal: AbortSignal,
  onProgress: (frames: number) => void,
): Promise<SpritesheetPage[]> {
  const video = document.createElement('video');
  video.preload = 'auto';
  video.muted = true;
  video.playsInline = true;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Browser ini tidak bisa membuat gambar.');

  const { frameCount, framesPerSheet, frameWidth, frameHeight, fps, start } = plan;
  const pages: SpritesheetPage[] = [];
  try {
    await waitForVideo(video, 'loadeddata', signal, () => { video.src = videoUrl; });
    for (let firstFrame = 0; firstFrame < frameCount; firstFrame += framesPerSheet) {
      const count = Math.min(framesPerSheet, frameCount - firstFrame);
      const columns = Math.min(plan.columns, count);
      const rows = Math.ceil(count / columns);
      canvas.width = columns * frameWidth;
      canvas.height = rows * frameHeight;
      context.imageSmoothingQuality = 'high';

      for (let cell = 0; cell < count; cell++) {
        signal.throwIfAborted();
        const time = start + (firstFrame + cell) / fps;
        if (video.currentTime !== time || video.seeking) {
          await waitForVideo(video, 'seeked', signal, () => { video.currentTime = time; });
        }
        if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          throw new Error('Browser belum berhasil membaca frame video.');
        }
        const x = (cell % columns) * frameWidth;
        const y = Math.floor(cell / columns) * frameHeight;
        context.drawImage(video, x, y, frameWidth, frameHeight);
        onProgress(firstFrame + cell + 1);
      }

      const blob = await encodePng(canvas);
      signal.throwIfAborted();
      const number = String(pages.length + 1).padStart(2, '0');
      pages.push({
        file: `${baseName}-spritesheet-${number}.png`,
        width: canvas.width,
        height: canvas.height,
        columns,
        rows,
        firstFrame,
        frameCount: count,
        blob,
      });
    }
    return pages;
  } finally {
    video.removeAttribute('src');
    video.load();
    canvas.width = 0;
    canvas.height = 0;
  }
}

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Download, Film, Grid3X3, Upload } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { generateSpritesheets, planSpritesheet } from '@/utils/spritesheet';
import type { SpritesheetPage, VideoInfo } from '@/utils/spritesheet';

interface ConversionResult {
  baseName: string;
  plan: ReturnType<typeof planSpritesheet>;
  pages: SpritesheetPage[];
}

const fieldClass = 'h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-slate-100';
const primaryButton = 'bg-cyan-400 font-bold text-slate-950 hover:bg-cyan-300';

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export default function Spritesheet() {
  const [source, setSource] = useState<{ file: File; url: string } | null>(null);
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [fps, setFps] = useState('12');
  const [start, setStart] = useState('0');
  const [end, setEnd] = useState('');
  const [frameSize, setFrameSize] = useState(128);
  const [sheetSize, setSheetSize] = useState(1024);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const job = useRef<AbortController | null>(null);
  const previewVideo = useRef<HTMLVideoElement>(null);
  const file = source?.file;
  const videoUrl = source?.url;
  const page = result?.pages[pageIndex];
  const previewBlob = page?.blob;
  const busy = progress !== null;

  const attachImage = useCallback((image: HTMLImageElement | null) => {
    if (!image || !previewBlob) return;
    const url = URL.createObjectURL(previewBlob);
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [previewBlob]);

  useEffect(() => {
    if (videoUrl) return () => URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  useEffect(() => () => {
    job.current?.abort();
    job.current = null;
  }, []);

  let plan: ReturnType<typeof planSpritesheet> | undefined;
  let planError = '';
  if (video) {
    try {
      plan = planSpritesheet(video, {
        fps: Number(fps),
        start: start === '' ? NaN : Number(start),
        end: end === '' ? video.duration : Number(end),
        frameSize,
        sheetSize,
      });
    } catch (failure) {
      planError = (failure as Error).message;
    }
  }

  function pickFile(nextFile: File) {
    if (job.current) return;
    if (!/\.mp4$/i.test(nextFile.name) || nextFile.size === 0) {
      setError('Pilih file .mp4 yang berisi video.');
      return;
    }
    if (nextFile === file) return;
    setSource({ file: nextFile, url: URL.createObjectURL(nextFile) });
    setVideo(null);
    setResult(null);
    setError('');
    setStart('0');
    setEnd('');
  }

  async function convert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || !videoUrl || !plan || job.current) return;
    const controller = new AbortController();
    job.current = controller;
    previewVideo.current?.pause();
    setError('');
    setResult(null);
    setPageIndex(0);
    const total = plan.frameCount;
    setProgress({ done: 0, total });
    const baseName = file.name.slice(0, -4).replace(/[^\p{L}\p{N}._-]+/gu, '-').slice(0, 80) || 'video';
    try {
      const pages = await generateSpritesheets(videoUrl, baseName, plan, controller.signal, done => {
        setProgress({ done, total });
      });
      setResult({ baseName, plan, pages });
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure instanceof Error ? failure.message : 'Konversi gagal. Coba lagi.');
      }
    } finally {
      if (job.current === controller) {
        job.current = null;
        setProgress(null);
      }
    }
  }

  function downloadMetadata() {
    if (!result) return;
    const { fps, start, end, frameWidth, frameHeight, frameCount } = result.plan;
    const metadata = {
      fps, start, end, frameWidth, frameHeight, frameCount,
      frameOrder: 'left-to-right, top-to-bottom',
      frameIndexBase: 0,
      sheets: result.pages.map(({ file, width, height, columns, rows, firstFrame, frameCount }) =>
        ({ file, width, height, columns, rows, firstFrame, frameCount })),
    };
    download(new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' }), `${result.baseName}-spritesheet.json`);
  }

  return (
    <div className="space-y-6">
      <Helmet><title>MP4 to Spritesheet | Disperser Studio</title></Helmet>
      <header className="page-header">
        <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
          <Grid3X3 className="shrink-0 text-cyan-400" aria-hidden="true" /> MP4 to Spritesheet
        </h1>
        <p className="page-desc mt-2">Ubah potongan video menjadi grid PNG. Video diproses langsung di browser.</p>
      </header>

      <form onSubmit={convert} noValidate className="grid min-w-0 gap-5 lg:grid-cols-2">
        <section className="glass-panel min-w-0 space-y-4 rounded-2xl p-4 sm:p-6" aria-labelledby="spritesheet-source">
          <h2 id="spritesheet-source" className="flex items-center gap-2 text-lg font-bold text-white">
            <Film size={19} className="text-cyan-400" aria-hidden="true" /> Video MP4
          </h2>
          {videoUrl && (
            <video
              key={videoUrl}
              ref={previewVideo}
              src={videoUrl}
              preload="metadata"
              controls
              playsInline
              aria-label="Preview video sumber"
              className="max-h-72 w-full rounded-xl bg-slate-950"
              onLoadedMetadata={event => {
                const { videoWidth: width, videoHeight: height, duration } = event.currentTarget;
                if (width && height && Number.isFinite(duration) && duration > 0) {
                  setVideo({ width, height, duration });
                } else {
                  setError('File ini tidak memiliki durasi atau gambar video yang valid.');
                }
              }}
              onError={() => {
                setVideo(null);
                setError('MP4 ini tidak bisa dibuka di browser. Coba ekspor ulang sebagai MP4 H.264.');
              }}
            />
          )}
          <label
            className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-cyan-400/40 bg-cyan-400/5 p-4 text-center text-sm font-semibold text-cyan-200 hover:bg-cyan-400/10 focus-within:ring-2 focus-within:ring-cyan-400/60 has-[:disabled]:cursor-default has-[:disabled]:opacity-50"
            onDragOver={event => event.preventDefault()}
            onDrop={event => {
              event.preventDefault();
              const incoming = event.dataTransfer.files[0];
              if (incoming) pickFile(incoming);
            }}
          >
            <Upload size={18} aria-hidden="true" />
            {file ? 'Ganti video MP4' : 'Pilih atau tarik video MP4 ke sini'}
            <input
              type="file"
              accept=".mp4,video/mp4"
              className="sr-only"
              disabled={busy}
              onChange={event => {
                const incoming = event.currentTarget.files?.[0];
                if (incoming) pickFile(incoming);
                event.currentTarget.value = '';
              }}
            />
          </label>
          {file && (
            <p className="break-all text-sm text-slate-300">
              {file.name}
              {video && <span className="ml-2 text-slate-400">{video.width} × {video.height} · {video.duration.toFixed(2)} detik</span>}
            </p>
          )}
        </section>

        <section className="glass-panel min-w-0 space-y-4 rounded-2xl p-4 sm:p-6" aria-labelledby="spritesheet-settings">
          <h2 id="spritesheet-settings" className="text-lg font-bold text-white">Pengaturan output</h2>
          <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="sprite-start">Mulai (detik)</Label>
                <Input id="sprite-start" className={fieldClass} type="number" min="0" step="any" value={start} onChange={event => setStart(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sprite-end">Akhir (detik)</Label>
                <Input id="sprite-end" className={fieldClass} type="number" min="0" step="any" value={end} placeholder="Akhir video" onChange={event => setEnd(event.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="sprite-fps">FPS</Label>
                <Input id="sprite-fps" className={fieldClass} type="number" min="1" max="30" value={fps} onChange={event => setFps(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sprite-frame-size">Batas sisi frame</Label>
                <select id="sprite-frame-size" className={fieldClass} value={frameSize} onChange={event => setFrameSize(Number(event.target.value))}>
                  {[64, 128, 256, 512].map(size => <option key={size} value={size}>{size} px</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sprite-sheet-size">Batas sisi sheet</Label>
                <select id="sprite-sheet-size" className={fieldClass} value={sheetSize} onChange={event => setSheetSize(Number(event.target.value))}>
                  {[512, 1024, 2048].map(size => <option key={size} value={size}>{size} px</option>)}
                </select>
              </div>
            </div>
          </fieldset>

          {plan && (
            <p className="text-sm text-slate-300">
              {plan.frameCount} frame · {plan.frameWidth} × {plan.frameHeight} px per frame · {plan.sheetCount} PNG
            </p>
          )}
          {(error || planError) && <p role="alert" className="text-sm text-rose-300">{error || planError}</p>}
          {progress ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-300">
                  {progress.done === progress.total ? 'Menyimpan PNG…' : `Memproses ${progress.done} / ${progress.total} frame`}
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => job.current?.abort()}>Batal</Button>
              </div>
              <progress className="h-2 w-full accent-cyan-400" aria-label="Progres konversi" value={progress.done} max={progress.total} />
            </div>
          ) : (
            <Button type="submit" disabled={!plan} className={`w-full ${primaryButton}`}>
              <Grid3X3 aria-hidden="true" /> Buat Spritesheet
            </Button>
          )}
        </section>
      </form>

      {result && page && (
        <section className="glass-panel min-w-0 space-y-4 rounded-2xl p-4 sm:p-6" aria-labelledby="spritesheet-result">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="spritesheet-result" className="text-lg font-bold text-white">Hasil spritesheet</h2>
              {result.pages.length > 1 && (
                <p className="mt-1 text-sm text-slate-300" role="status">
                  {result.plan.frameCount} frame total · {result.pages.length} PNG
                </p>
              )}
            </div>
            <Button type="button" variant="outline" onClick={downloadMetadata}><Download aria-hidden="true" /> Unduh JSON</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {result.pages.length > 1 && (
              <label className="flex flex-wrap items-center gap-2 text-sm">
                Lembar
                <select className={`${fieldClass} !w-auto`} value={pageIndex} onChange={event => setPageIndex(Number(event.target.value))}>
                  {result.pages.map((sheet, index) => <option key={sheet.file} value={index}>{index + 1} / {result.pages.length}</option>)}
                </select>
              </label>
            )}
            <Button type="button" className={primaryButton} onClick={() => download(page.blob, page.file)}>
              <Download aria-hidden="true" /> Unduh PNG
            </Button>
            <span className="text-sm text-slate-300">{page.width} × {page.height} px · {page.rows} baris</span>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-200">Analisis hasil</h3>
            <dl className="grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] gap-2" aria-live="polite">
              <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                <dt className="text-xs text-slate-300">FPS output</dt>
                <dd className="mt-1 font-mono text-lg font-bold text-cyan-200">{result.plan.fps}</dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                <dt className="font-mono text-xs text-slate-300">framesPerRow</dt>
                <dd className="mt-1 font-mono text-lg font-bold text-cyan-200">{page.columns}</dd>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3">
                <dt className="text-xs text-slate-300">
                  <code>frames</code>{result.pages.length > 1 && ' (lembar ini)'}
                </dt>
                <dd className="mt-1 font-mono text-lg font-bold text-cyan-200">{page.frameCount}</dd>
              </div>
            </dl>
          </div>
          <img
            ref={attachImage}
            alt={`Preview spritesheet lembar ${pageIndex + 1} dengan ${page.frameCount} frame`}
            width={page.width}
            height={page.height}
            className="h-auto max-w-full rounded-lg border border-white/10 bg-slate-950"
          />
        </section>
      )}
    </div>
  );
}

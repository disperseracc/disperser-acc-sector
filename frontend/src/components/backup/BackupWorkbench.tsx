import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Database, Download, FileUp, LoaderCircle, Pause, Play, Plus, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react';
import { backupApi, BackupApiError } from '@/api/backup';
import type { BackupHandle, BackupJobView, BackupStore, CreateBackup } from '@/api/backup';

type Experience = { id: number; name: string };
type StoreChoice = BackupStore & { selected: boolean };
type Suggestion = Experience & { selectedAt: number };
const field = 'w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-cyan-400/60 disabled:opacity-50';
const button = 'inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40';
const primary = button + ' border-cyan-500/40 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25';
const modeLabels = { backup: 'Backup', migrate: 'Migrasi A → B', restore: 'Restore' };
const statusLabels = { queued: 'Dalam antrean', running: 'Berjalan', paused: 'Dijeda', failed: 'Perlu diperiksa', completed: 'Selesai' };
function historyKey() {
  try { return 'disperser-backup-jobs:' + (JSON.parse(localStorage.getItem('disperser_user') || '{}').id || 'local'); }
  catch { return 'disperser-backup-jobs:local'; }
}
function readHistory(key: string): BackupHandle[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter(h => /^[a-f0-9-]{36}$/.test(h.id) && /^[a-f0-9]{64}$/.test(h.token) && h.job?.id === h.id) : [];
  } catch { return []; }
}
function duration(seconds: number | null) {
  if (seconds === null) return 'Menghitung dari kecepatan proses';
  if (seconds < 60) return seconds + ' detik';
  return Math.ceil(seconds / 60) + ' menit';
}
export default function BackupWorkbench({ experiences, suggestion, initialKey }: { experiences: Experience[]; suggestion: Suggestion | null; initialKey: string }) {
  const [storageKey] = useState(historyKey);
  const [mode, setMode] = useState<BackupJobView['mode']>('backup');
  const [sourceUniverse, setSourceUniverse] = useState('');
  const [targetUniverse, setTargetUniverse] = useState('');
  const [sourceKeyDraft, setSourceKey] = useState<string | null>(null);
  const [targetKeyDraft, setTargetKey] = useState<string | null>(null);
  const sourceKey = sourceKeyDraft ?? initialKey;
  const targetKey = targetKeyDraft ?? initialKey;
  const [reuseKey, setReuseKey] = useState(true);
  const [choices, setChoices] = useState<StoreChoice[]>([]);
  const [manualKind, setManualKind] = useState<BackupStore['kind']>('ordered');
  const [manualName, setManualName] = useState('');
  const [manualScope, setManualScope] = useState('global');
  const [conflict, setConflict] = useState<'skip' | 'overwrite'>('skip');
  const [skipUnchanged, setSkipUnchanged] = useState(true);
  const [readback, setReadback] = useState(false);
  const [seenSuggestion, setSeenSuggestion] = useState(suggestion);
  const [handles, setHandles] = useState<BackupHandle[]>(() => readHistory(storageKey));
  const [restoreId, setRestoreId] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [tested, setTested] = useState('');
  const [jobErrors, setJobErrors] = useState<Record<string, string>>({});
  const [missingIds, setMissingIds] = useState<string[]>([]);
  const handlesRef = useRef(handles);
  const missingJobs = useRef(new Set<string>());
  const generation = useRef(0);
  const uploadInput = useRef<HTMLInputElement>(null);
  const selectedStores = choices.filter(s => s.selected).map(({ kind, name, scope }) => ({ kind, name, scope }));
  const signature = JSON.stringify([sourceUniverse, sourceKey, selectedStores]);
  const completed = handles.filter(h => h.job.captureComplete && !missingIds.includes(h.id));
  const restoreSource = completed.find(h => h.id === (restoreId || completed[0]?.id));
  const selected = handles.find(h => h.id === selectedId) || handles[0];
  const experienceName = (id?: string, saved?: string) => saved || experiences.find(e => String(e.id) === id)?.name || (id ? 'Universe ' + id : 'Experience tidak diketahui');
  const effectiveTargetKey = mode === 'migrate' && reuseKey ? sourceKey : targetKey;

  useEffect(() => { handlesRef.current = handles; }, [handles]);
  useEffect(() => {
    // Debounce browser persistence so rapid progress updates do not block rendering.
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify(handles)); }
      catch { setError('Riwayat proses tidak dapat disimpan di browser. Simpan file backup dan biarkan halaman ini terbuka.'); }
    }, 50);
    return () => window.clearTimeout(timer);
  }, [handles, storageKey]);
  useEffect(() => { generation.current++; }, [sourceUniverse, sourceKey]);
  if (suggestion !== seenSuggestion) {
    setSeenSuggestion(suggestion);
    if (suggestion) {
      if (String(suggestion.id) !== sourceUniverse) { setChoices([]); setTested(''); setSourceUniverse(String(suggestion.id)); }
      if (mode === 'restore') setMode('backup');
    }
  }

  const updateJob = (job: BackupJobView) => setHandles(current => current.map(h => h.id === job.id ? { ...h, job } : h));
  function forget(handle: BackupHandle) {
    const remaining = handlesRef.current.filter(item => item.id !== handle.id);
    handlesRef.current = remaining;
    missingJobs.current.delete(handle.id);
    setMissingIds(current => current.filter(id => id !== handle.id));
    setHandles(remaining);
    setSelectedId(current => current === handle.id ? remaining[0]?.id || '' : current);
    setRestoreId(current => current === handle.id ? '' : current);
    setJobErrors(current => { const next = { ...current }; delete next[handle.id]; return next; });
    try { localStorage.setItem(storageKey, JSON.stringify(remaining)); }
    catch { setError('Riwayat lokal gagal disimpan. Coba lagi setelah penyimpanan browser tersedia.'); }
  }
  async function deleteSelected(handle: BackupHandle) {
    const name = experienceName(handle.job.sourceUniverseId, handle.sourceName);
    if (!window.confirm(`Hapus ${modeLabels[handle.job.mode]} untuk ${name}? Data backup dan checkpoint di server akan dihapus permanen.`)) return;
    await perform('delete', async () => { await backupApi.delete(handle); forget(handle); });
  }
  useEffect(() => {
    let stopped = false;
    let refreshing = false;
    async function refresh(all: boolean) {
      if (refreshing) return;
      refreshing = true;
      try {
        await Promise.all(handlesRef.current.filter(h => !missingJobs.current.has(h.id) && (all || ['running', 'queued'].includes(h.job.status))).map(async handle => {
          try {
            const result = await backupApi.status(handle);
            if (!stopped) {
              missingJobs.current.delete(handle.id);
              setMissingIds(current => current.filter(id => id !== handle.id));
              setHandles(current => current.map(h => h.id === handle.id ? { ...h, job: result.job } : h));
              setJobErrors(current => { const next = { ...current }; delete next[handle.id]; return next; });
            }
          } catch (err) {
            if (!stopped) {
              if (err instanceof BackupApiError && err.status === 404) { missingJobs.current.add(handle.id); setMissingIds(current => current.includes(handle.id) ? current : [...current, handle.id]); }
              setJobErrors(current => ({ ...current, [handle.id]: err instanceof BackupApiError && err.status === 404 ? 'Proses ini tidak ditemukan di server. File backup/checkpoint mungkin hilang saat deploy lama. Hapus riwayat lokal ini dan buat backup baru setelah Volume Railway aktif.' : err instanceof Error ? err.message : 'Status belum dapat diperbarui.' }));
            }
          }
        }));
      } finally { refreshing = false; }
    }
    void refresh(true);
    const timer = window.setInterval(() => { void refresh(false); }, 2000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [storageKey]);

  async function perform(label: string, action: () => Promise<void>) {
    setBusy(label); setError('');
    try { await action(); } catch (err) { setError(err instanceof Error ? err.message : 'Proses gagal.'); }
    finally { setBusy(''); }
  }
  function remember(result: { job: BackupJobView; token: string }, names?: { sourceName?: string; targetName?: string }) {
    const handle: BackupHandle = { id: result.job.id, token: result.token, job: result.job, ...names };
    const history = [handle, ...handlesRef.current.filter(h => h.id !== handle.id)];
    try { localStorage.setItem(storageKey, JSON.stringify(history)); }
    catch { setError('Simpan file backup sebelum menutup halaman: riwayat browser tidak dapat ditulis.'); }
    handlesRef.current = history;
    setHandles(history);
    setSelectedId(handle.id);
    return handle;
  }
  async function loadStores() {
    const version = generation.current;
    await perform('stores', async () => {
      const result = await backupApi.stores(sourceUniverse.trim(), sourceKey.trim());
      if (generation.current !== version) return;
      setChoices(current => [
        ...result.stores.map(s => {
          const existing = current.find(c => c.kind === 'standard' && c.name === s.name);
          return existing || { kind: 'standard' as const, name: s.name, scope: '*', selected: true };
        }),
        ...current.filter(s => s.kind === 'ordered' || !result.stores.some(r => r.name === s.name))
      ]);
      if (!result.stores.length) setError('Tidak ada Standard DataStore yang ditemukan. Tambahkan OrderedDataStore atau nama store secara manual.');
    });
  }
  function addStore() {
    const name = manualName.trim();
    const scope = manualScope.trim() || 'global';
    if (!name) { setError('Isi nama store terlebih dahulu.'); return; }
    if (manualKind === 'ordered' && scope === '*') { setError('Isi scope OrderedDataStore, misalnya global.'); return; }
    setChoices(current => current.some(s => s.kind === manualKind && s.name === name && s.scope === scope)
      ? current.map(s => s.kind === manualKind && s.name === name && s.scope === scope ? { ...s, selected: true } : s)
      : [...current, { kind: manualKind, name, scope, selected: true }]);
    setManualName(''); setError('');
  }
  async function testSource() {
    const version = generation.current;
    const testedSignature = signature;
    await perform('inspect', async () => {
      for (let offset = 0; offset < selectedStores.length; offset += 10) {
        await backupApi.inspect(sourceUniverse.trim(), sourceKey.trim(), selectedStores.slice(offset, offset + 10));
      }
      if (generation.current === version) setTested(testedSignature);
    });
  }
  async function start() {
    await perform('start', async () => {
      const input: CreateBackup = {
        mode, conflict, skipUnchanged, verifyReadback: readback,
        ...(mode === 'restore'
          ? { backupJobId: restoreSource?.id, backupToken: restoreSource?.token }
          : { sourceUniverseId: sourceUniverse.trim(), sourceKey: sourceKey.trim(), stores: selectedStores }),
        ...(mode === 'backup' ? {} : { targetUniverseId: targetUniverse.trim(), targetKey: effectiveTargetKey.trim(), confirmedTarget: targetUniverse.trim() })
      };
      const result = await backupApi.create(input);
      if (mode !== 'backup') setTargetKey(effectiveTargetKey);
      remember(result, { sourceName: mode === 'restore' ? restoreSource?.sourceName : experiences.find(e => String(e.id) === sourceUniverse)?.name, targetName: experiences.find(e => String(e.id) === targetUniverse)?.name });
    });
  }
  const canStart = !busy && (mode === 'restore' ? !!restoreSource : /^[1-9]\d*$/.test(sourceUniverse.trim()) && !!sourceKey.trim() && selectedStores.length > 0)
    && (mode === 'backup' || (/^[1-9]\d*$/.test(targetUniverse.trim()) && !!effectiveTargetKey.trim()
      && (mode !== 'migrate' || targetUniverse.trim() !== sourceUniverse.trim())));
  const job = selected?.job;
  const progress = job?.status === 'completed' ? 100 : job?.captureComplete && job.total ? Math.min(100, Math.round(job.processed / job.total * 100)) : null;
  function changeSource(id: string) {
    if (id !== sourceUniverse) { setChoices([]); setTested(''); }
    setSourceUniverse(id);
  }
  const chooseExperience = (id: string, target: boolean) => target ? setTargetUniverse(id) : changeSource(id);

  return (
    <section id="backup-workbench" translate="no" className="notranslate scroll-mt-6 space-y-5 rounded-3xl border border-cyan-500/20 bg-slate-950/50 p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-white"><ShieldCheck size={22} className="text-cyan-400" /> Data backup & recovery</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">Simpan data pemain, salin ke experience lain, atau pulihkan file backup.</p>
        </div>
        <div className="grid w-full gap-2 sm:grid-cols-3" role="tablist" aria-label="Pilih tindakan backup">
          {([['backup', 'Simpan backup', 'Simpan data experience'], ['migrate', 'Pindahkan data', 'Dari experience A ke B'], ['restore', 'Pulihkan backup', 'Dari backup tersimpan']] as const).map(([value, title, description]) => (
            <button key={value} role="tab" aria-selected={mode === value} onClick={() => setMode(value)} className={'rounded-2xl border p-3 text-left transition ' + (mode === value ? 'border-cyan-400 bg-cyan-500/20 text-white shadow-lg shadow-cyan-500/10' : 'border-white/10 bg-slate-900/60 text-slate-300 hover:border-cyan-500/40')}>
              <span className="block text-sm font-bold">{title}</span><span className="mt-1 block text-[11px] opacity-70">{description}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>}

      <div className={'grid gap-5 ' + (mode === 'backup' ? '' : 'lg:grid-cols-2')}>
        {mode !== 'restore' ? (
          <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
            <h3 className="text-sm font-bold text-white">A · Experience sumber</h3>
            <label className="block space-y-1.5 text-xs text-slate-400">
              <span>Pilih experience</span>
              <select aria-label="Pilih experience sumber" className={field} value={experiences.some(e => String(e.id) === sourceUniverse) ? sourceUniverse : ''} onChange={e => chooseExperience(e.target.value, false)}>
                <option value="">Pilih experience atau masukkan Universe ID di bawah</option>
                {experiences.map(e => <option key={e.id} value={e.id}>{e.name} · {e.id}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5 text-xs text-slate-400">
              <span>Universe ID sumber</span>
              <input className={field} aria-label="Universe ID sumber" inputMode="numeric" placeholder="Universe ID, bukan Place ID" value={sourceUniverse} onChange={e => changeSource(e.target.value)} />
              <span className="block leading-relaxed">Experience yang disuspend atau tidak muncul di daftar tetap bisa diuji menggunakan Universe ID.</span>
            </label>
            <label className="block space-y-1.5 text-xs text-slate-400">
              <span>Open Cloud API key sumber</span>
              <input className={field} aria-label="API key sumber" type="password" autoComplete="off" value={sourceKey} onChange={e => { setSourceKey(e.target.value); }} placeholder="Izin list + read DataStore" />
            </label>
            <button className={primary} disabled={!!busy || !sourceUniverse || !sourceKey} onClick={loadStores}>{busy === 'stores' ? <LoaderCircle size={15} className="animate-spin" /> : <Database size={15} />} Pilih data otomatis</button><p className="text-[11px] text-slate-400">{selectedStores.length ? `${selectedStores.length} store dipilih. ` : ''}DataStore standar ditemukan otomatis. OrderedDataStore ditambahkan lewat pengaturan lanjutan.</p>

            <details className="space-y-2 border-t border-white/10 pt-4"><summary className="cursor-pointer text-xs font-bold text-cyan-300">Pengaturan lanjutan · pilih store dan scope</summary>
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200">Store terpilih ({selectedStores.length})</span>
                {choices.length > 0 && <button className="text-cyan-300" onClick={() => setChoices(current => current.map(s => ({ ...s, selected: !current.every(c => c.selected) })))}>Pilih / batalkan semua</button>}
              </div>
              <div className="max-h-52 space-y-2 overflow-y-auto">
                {choices.map((store, index) => (
                  <div key={[store.kind, store.name, index].join(':')} className="flex items-center gap-2 rounded-xl border border-white/5 bg-slate-950/50 p-2.5">
                    <input aria-label={'Pilih ' + store.kind + ' ' + store.name} type="checkbox" className="accent-cyan-400" checked={store.selected} onChange={e => setChoices(current => current.map((s, i) => i === index ? { ...s, selected: e.target.checked } : s))} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-200" title={store.name}>{store.name}</p>
                      <p className="text-[10px] text-slate-500">{store.kind === 'ordered' ? 'OrderedDataStore' : 'Standard DataStore'}</p>
                    </div>
                    <input className={field + ' max-w-28 !py-1.5 !text-xs'} aria-label={'Scope ' + store.name} title="Scope; * untuk semua scope Standard" value={store.scope} onChange={e => setChoices(current => current.map((s, i) => i === index ? { ...s, scope: e.target.value } : s))} />
                    <button className="p-1 text-slate-500 hover:text-red-300" aria-label={'Hapus ' + store.name + ' dari pilihan'} onClick={() => setChoices(current => current.filter((_, i) => i !== index))}><X size={14} /></button>
                  </div>
                ))}
                {!choices.length && <p className="rounded-xl border border-dashed border-white/10 p-4 text-xs text-slate-500">Muat daftar Standard DataStore atau tambahkan nama store di bawah.</p>}
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">Scope * mencakup semua scope Standard. Untuk OrderedDataStore, masukkan nama persis dari script dan scope yang digunakan, satu per baris pilihan.</p>

            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_1fr] gap-2 sm:grid-cols-[1fr_1.3fr_0.8fr_auto]">
                <select className={field + ' !text-xs'} aria-label="Jenis store manual" value={manualKind} onChange={e => { setManualKind(e.target.value as BackupStore['kind']); setManualScope('global'); }}>
                  <option value="ordered">Ordered</option><option value="standard">Standard</option>
                </select>
                <input className={field + ' !text-xs'} aria-label="Nama store manual" placeholder="Nama store" value={manualName} onChange={e => setManualName(e.target.value)} />
                <input className={field + ' !text-xs'} aria-label="Scope store manual" placeholder="global" value={manualScope} onChange={e => setManualScope(e.target.value)} />
                <button className={button} aria-label="Tambahkan store" onClick={addStore}><Plus size={16} /></button>
              </div>
              <button className={button} disabled={!!busy || !selectedStores.length || !sourceKey || !sourceUniverse} onClick={testSource}>
                {busy === 'inspect' ? <LoaderCircle className="animate-spin" size={14} /> : tested === signature ? <Check size={14} /> : <ShieldCheck size={14} />}
                {tested === signature ? 'Sampel akses sumber berhasil' : 'Uji akses sumber'}
              </button>
            </div>
            </details>
          </div>
        ) : (
          <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
            <h3 className="text-sm font-bold text-white">Backup sumber</h3>
            <p className="text-xs leading-relaxed text-slate-400">Gunakan backup lengkap yang tersimpan di backend atau upload file backup Disperser.</p>
            <select className={field} aria-label="Pilih backup untuk restore" value={restoreSource?.id || ''} onChange={e => setRestoreId(e.target.value)}>
              {!completed.length && <option value="">Belum ada backup lengkap</option>}
              {completed.map(h => <option key={h.id} value={h.id}>{experienceName(h.job.sourceUniverseId, h.sourceName)} · {h.job.captured.toLocaleString()} key · {new Date(h.job.createdAt).toLocaleString('id-ID')}</option>)}
            </select>
            {restoreSource && <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-cyan-200">
              <p className="font-bold">{restoreSource.job.captured.toLocaleString()} key tersedia</p>
              <p className="mt-1 text-xs text-slate-400">{restoreSource.job.stores.length} pilihan store/scope · sumber {experienceName(restoreSource.job.sourceUniverseId, restoreSource.sourceName)} ({restoreSource.job.sourceUniverseId})</p>
            </div>}
            <input ref={uploadInput} type="file" accept=".gz,.jsonl,application/gzip,application/x-ndjson" className="hidden" aria-label="Upload file backup" onChange={e => {
              const file = e.target.files?.[0]; e.target.value = '';
              if (!file) return;
              if (file.size > 256 * 1024 * 1024) { setError('Ukuran upload maksimal 256 MB.'); return; }
              void perform('import', async () => { const handle = remember(await backupApi.importFile(file)); setRestoreId(handle.id); });
            }} />
            <button className={button} disabled={!!busy} onClick={() => uploadInput.current?.click()}>{busy === 'import' ? <LoaderCircle size={15} className="animate-spin" /> : <FileUp size={15} />} Upload backup .jsonl.gz</button>
            <p className="text-[11px] text-slate-500">Checksum dan jumlah key diperiksa sebelum file dapat dipakai untuk restore. Batas upload 256 MB, hasil dekompresi 512 MB.</p>
          </div>
        )}

        {mode !== 'backup' && (
          <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-4">
            <h3 className="text-sm font-bold text-white">B · Experience tujuan</h3>
            <label className="block space-y-1.5 text-xs text-slate-400">
              <span>Pilih experience</span>
              <select aria-label="Pilih experience tujuan" className={field} value={experiences.some(e => String(e.id) === targetUniverse) ? targetUniverse : ''} onChange={e => chooseExperience(e.target.value, true)}>
                <option value="">Pilih experience atau masukkan Universe ID di bawah</option>
                {experiences.map(e => <option key={e.id} value={e.id}>{e.name} · {e.id}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5 text-xs text-slate-400"><span>Universe ID tujuan</span><input className={field} aria-label="Universe ID tujuan" inputMode="numeric" value={targetUniverse} onChange={e => setTargetUniverse(e.target.value)} /></label>
            {mode === 'migrate' && <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" className="accent-cyan-400" checked={reuseKey} onChange={e => setReuseKey(e.target.checked)} /> Gunakan API key sumber untuk tujuan</label>}
            <label className="block space-y-1.5 text-xs text-slate-400">
              <span>Open Cloud API key tujuan · create + read{conflict === 'overwrite' ? ' + update' : ''}</span>
              <input className={field} aria-label="API key tujuan" type="password" autoComplete="off" disabled={mode === 'migrate' && reuseKey} value={effectiveTargetKey} onChange={e => setTargetKey(e.target.value)} />
              <span className="block leading-relaxed">API key harus punya akses ke Universe B. Gunakan key berbeda jika sumber dan tujuan berada di pemilik/group berbeda.</span>
            </label>
            <details className="space-y-3 border-t border-white/10 pt-3"><summary className="cursor-pointer text-xs font-bold text-cyan-300">Pengaturan lanjutan · data yang sudah ada dan verifikasi</summary>
            <label className="block space-y-1.5 text-xs text-slate-400">
              <span>Jika key sudah ada di tujuan</span>
              <select className={field} aria-label="Kebijakan key yang sudah ada" value={conflict} onChange={e => setConflict(e.target.value as 'skip' | 'overwrite')}>
                <option value="skip">Lewati · pertahankan data tujuan</option>
                <option value="overwrite">Timpa · gunakan nilai dari backup/sumber</option>
              </select>
            </label>
            {conflict === 'overwrite' && <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" className="accent-cyan-400" checked={skipUnchanged} onChange={e => setSkipUnchanged(e.target.checked)} /> Lewati penulisan jika nilai dan metadata sudah sama</label>}
            <label className="flex items-start gap-2 text-xs leading-relaxed text-slate-300"><input type="checkbox" className="mt-0.5 accent-cyan-400" checked={readback} onChange={e => setReadback(e.target.checked)} /><span>Verifikasi tambahan dengan baca ulang. Memerlukan request ekstra; respons setiap penulisan selalu diperiksa.</span></label>
            {conflict === 'overwrite' && <p className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-200">Key yang cocok akan ditimpa dengan data sumber. Pastikan penulisan dari game di tujuan sudah dihentikan selama pemulihan.</p>}</details>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
        <div className="w-full"><p className="text-xs font-bold uppercase tracking-wide text-cyan-300">Ringkasan</p><p className="mt-1 text-sm font-semibold text-white">{mode === 'backup' ? `Simpan backup ${experienceName(sourceUniverse)}` : mode === 'migrate' ? `${experienceName(sourceUniverse)} → ${experienceName(targetUniverse)}` : `${experienceName(restoreSource?.job.sourceUniverseId, restoreSource?.sourceName)} → ${experienceName(targetUniverse)}`}</p><p className="mt-1 text-xs text-slate-300">{mode === 'backup' ? `${selectedStores.length} store dipilih` : `Data yang sudah ada di tujuan akan ${conflict === 'skip' ? 'dilewati' : 'ditimpa'}.`}</p></div>
        <p className="max-w-2xl text-xs leading-relaxed text-slate-400">Yang disalin adalah nilai terkini dan metadata yang didukung, termasuk nilai leaderboard. Hentikan penulisan sumber untuk hasil konsisten; backup ini bukan snapshot atomik seluruh experience.</p>
        <button className={'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-extrabold transition shadow-lg disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ' + (canStart ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-slate-950 shadow-cyan-500/25 hover:from-cyan-300 hover:to-blue-400' : 'bg-slate-700 text-slate-300')} disabled={!canStart} onClick={start}>{busy === 'start' ? <LoaderCircle className="animate-spin" size={16} /> : <ArrowRight size={16} />} {mode === 'backup' ? 'Mulai backup' : mode === 'migrate' ? 'Mulai migrasi' : 'Mulai restore'}</button>
      </div>

      {!!handles.length && (
        <div className="space-y-4 border-t border-white/10 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold text-white">Proses backup & backup tersimpan</h3><p className="text-[11px] text-slate-500">Proses berjalan di backend meski halaman ditutup.</p></div>
          <div className="grid gap-3 lg:grid-cols-[minmax(180px,0.7fr)_minmax(0,1.5fr)]">
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {handles.map(handle => <button key={handle.id} onClick={() => setSelectedId(handle.id)} className={'w-full rounded-xl border p-3 text-left ' + (selected?.id === handle.id ? 'border-cyan-500/40 bg-cyan-500/10' : 'border-white/10 bg-slate-950/30')}>
                <div className="flex items-center justify-between gap-2 text-xs font-bold text-slate-200"><span>{modeLabels[handle.job.mode]}</span><span className={handle.job.status === 'completed' ? 'text-emerald-300' : 'text-cyan-300'}>{statusLabels[handle.job.status]}</span></div>
                <span className={'mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ' + (handle.job.captureComplete ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300')}>{handle.job.captureComplete ? 'Backup tersimpan' : 'Proses backup'}</span>
                <p className="mt-2 truncate text-xs font-semibold text-slate-100" title={experienceName(handle.job.sourceUniverseId, handle.sourceName)}>{experienceName(handle.job.sourceUniverseId, handle.sourceName)}</p>
                {handle.job.targetUniverseId && <p className="mt-0.5 truncate text-[11px] text-slate-300" title={experienceName(handle.job.targetUniverseId, handle.targetName)}>→ {experienceName(handle.job.targetUniverseId, handle.targetName)}</p>}
                <p className="mt-1 truncate font-mono text-[10px] text-slate-500">{handle.job.sourceUniverseId}{handle.job.targetUniverseId ? ' → ' + handle.job.targetUniverseId : ''}</p>
                <p className="mt-1 text-[10px] text-slate-500">{new Date(handle.job.createdAt).toLocaleString('id-ID')}</p>
              </button>)}
            </div>

            {selected && job && <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/40 p-4" aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-white">{modeLabels[job.mode]} · {statusLabels[job.status]}</h4>
                <button className="text-slate-400 hover:text-cyan-200" aria-label="Perbarui status proses" onClick={() => { void perform('refresh', async () => { updateJob((await backupApi.status(selected)).job); setJobErrors(current => { const next = { ...current }; delete next[selected.id]; return next; }); }); }}><RefreshCw size={14} /></button>
              </div>
              <p className="text-sm font-semibold text-slate-100">{experienceName(job.sourceUniverseId, selected.sourceName)}{job.targetUniverseId ? ' → ' + experienceName(job.targetUniverseId, selected.targetName) : ''}</p><p className="break-all font-mono text-xs text-slate-400">{job.sourceUniverseId}{job.targetUniverseId ? ' → ' + job.targetUniverseId : ''}</p>
              <div className="h-2 overflow-hidden rounded-full bg-white/5" role="progressbar" aria-label="Progres backup" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress ?? undefined}>
                <div className={'h-full rounded-full bg-cyan-400 transition-all ' + (progress === null && job.status === 'running' ? 'w-1/3 animate-pulse' : '')} style={progress === null ? undefined : { width: progress + '%' }} />
              </div>
              <p className="text-xs text-slate-400">{job.currentStore ? 'Memproses ' + job.currentStore : job.status === 'completed' ? 'Seluruh pilihan selesai diproses.' : 'Checkpoint tersimpan.'}{progress !== null ? ' · ' + progress + '%' : ' · Jumlah total masih dipindai'}</p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[['Dibackup', job.captured], ['Ditulis', job.written], ['Sudah sama', job.unchanged], ['Dilewati', job.skipped]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-950/60 p-3"><p className="text-[10px] text-slate-500">{label}</p><p className="mt-1 text-lg font-bold text-slate-100">{Number(value).toLocaleString()}</p></div>)}
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">{job.perMinute} key/menit · Retry {job.retries}{job.mode !== 'backup' && job.status === 'running' ? ' · Estimasi sisa: ' + duration(job.estimatedSeconds) : ''}{job.disappeared > 0 ? ' · ' + job.disappeared + ' key tidak lagi ada saat dibaca' : ''}</p>
              {(job.error || jobErrors[job.id]) && <p role="alert" className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-200">{jobErrors[job.id] || job.error}</p>}
              {['paused', 'failed'].includes(job.status) && <div className="space-y-2 border-t border-white/10 pt-3">
                <p className="text-xs text-slate-400">Isi ulang API key untuk melanjutkan. Key tidak disimpan di file backup/checkpoint.</p>
                {!job.captureComplete && <input className={field} aria-label="API key sumber untuk melanjutkan" type="password" autoComplete="off" placeholder="API key sumber" value={sourceKey} onChange={e => setSourceKey(e.target.value)} />}
                {job.mode !== 'backup' && <input className={field} aria-label="API key tujuan untuk melanjutkan" type="password" autoComplete="off" placeholder="API key tujuan" value={targetKey} onChange={e => setTargetKey(e.target.value)} />}
              </div>}
              <div className="flex flex-wrap gap-2">
                {missingIds.includes(job.id) ? <button className={button + ' border-amber-400/30 text-amber-200'} onClick={() => forget(selected)}><Trash2 size={14} /> Hapus riwayat lokal</button> : <>
                {['running', 'queued'].includes(job.status) && <button className={button} disabled={!!busy || job.pauseRequested} onClick={() => { void perform('pause', async () => updateJob((await backupApi.pause(selected)).job)); }}><Pause size={14} /> {job.pauseRequested ? 'Menyelesaikan request aktif…' : 'Jeda'}</button>}
                {['paused', 'failed'].includes(job.status) && <button className={primary} disabled={!!busy || (!job.captureComplete && !sourceKey) || (job.mode !== 'backup' && !targetKey)} onClick={() => { void perform('resume', async () => updateJob((await backupApi.resume(selected, { sourceKey: sourceKey.trim(), targetKey: targetKey.trim() })).job)); }}><Play size={14} /> Lanjutkan checkpoint</button>}
                {job.captureComplete && <button className={button} disabled={!!busy} onClick={() => { void perform('download', () => backupApi.download(selected)); }}><Download size={14} /> {busy === 'download' ? 'Mengunduh…' : 'Unduh backup'}</button>}
                {job.captureComplete && <button className={button} onClick={() => { setMode('restore'); setRestoreId(selected.id); }}><ArrowRight size={14} /> Gunakan untuk restore</button>}
                <button className={button + ' hover:border-red-400/40 hover:text-red-300'} disabled={!!busy || ['running', 'queued'].includes(job.status)} onClick={() => { void deleteSelected(selected); }} title={['running', 'queued'].includes(job.status) ? 'Jeda proses terlebih dahulu' : 'Hapus backup dan checkpoint dari server'}><Trash2 size={14} /> Hapus</button>
                </>}
              </div>
              {job.status === 'completed' && job.skipped > 0 && <p className="text-[11px] leading-relaxed text-amber-200">{job.skipped} key tujuan dipertahankan sesuai pilihan “Lewati”. Selesai tidak berarti data kedua experience identik.</p>}
            </div>}
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">Riwayat akses tersimpan di browser ini; payload backup tersimpan di backend. Unduh backup agar tetap tersedia jika penyimpanan server dihapus atau diganti.</p>
        </div>
      )}
    </section>
  );
}

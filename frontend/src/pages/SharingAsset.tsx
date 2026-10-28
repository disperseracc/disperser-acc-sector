import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2, Music2, Share2, XCircle } from 'lucide-react';
import { api, BASE_URL } from '../api/api';

type LibraryAudio = { id: string; name: string; assetId: string };
type GrantResult = {
  targetType: 'Group' | 'Universe';
  targetId: string;
  granted: number;
  total: number;
  results: Array<{ assetId: string; status: 'success' | 'error'; error?: string }>;
};

const validId = (value: string) => /^[1-9]\d*$/.test(value.trim());

export default function SharingAsset() {
  const [sourceGroupId, setSourceGroupId] = useState(localStorage.getItem('disperser_group_id') || '');
  const [targetGroupId, setTargetGroupId] = useState('');
  const [targetUniverseId, setTargetUniverseId] = useState('');
  const [pastedIds, setPastedIds] = useState('');
  const [library, setLibrary] = useState<LibraryAudio[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<GrantResult[]>([]);

  useEffect(() => {
    let active = true;
    api.getQueue().then(items => {
      if (!active) return;
      setLibrary(items.filter((item: any) => validId(String(item.assetId || '')))
        .map((item: any) => ({ id: String(item.id), name: String(item.name || 'Audio'), assetId: String(item.assetId) })));
    }).finally(() => { if (active) setLoadingLibrary(false); });
    return () => { active = false; };
  }, []);

  const assetIds = useMemo(() => [...new Set([
    ...(pastedIds.match(/\d+/g) || []),
    ...selected,
  ])], [pastedIds, selected]);

  const toggle = (id: string) => setSelected(previous => previous.includes(id)
    ? previous.filter(item => item !== id) : [...previous, id]);

  async function grant(targetType: 'Group' | 'Universe', targetId: string, apiKey: string): Promise<GrantResult> {
    const response = await fetch(`${BASE_URL.replace(/\/+$/, '')}/api/asset-sharing/grant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, sourceGroupId: sourceGroupId.trim(), targetType, targetId, assetIds }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Gagal memberi akses (${response.status}).`);
    return data;
  }

  async function handleShare() {
    const apiKey = localStorage.getItem('disperser_key')?.trim() || '';
    if (!apiKey) return setError('Simpan Roblox Open Cloud API key di Settings dulu.');
    if (!validId(sourceGroupId) || !validId(targetGroupId)) return setError('Isi Group ID Community A dan B yang valid.');
    if (sourceGroupId.trim() === targetGroupId.trim()) return setError('Community A dan B harus berbeda.');
    if (targetUniverseId.trim() && !validId(targetUniverseId)) return setError('Universe ID tujuan harus berupa angka positif.');
    if (assetIds.length < 1 || assetIds.length > 100) return setError('Pilih 1–100 audio per proses.');

    setError('');
    setResults([]);
    setSharing(true);
    try {
      const next: GrantResult[] = [];
      const groupResult = await grant('Group', targetGroupId.trim(), apiKey);
      next.push(groupResult);
      setResults([...next]);
      if (targetUniverseId.trim()) {
        // The universe needs its own grant to play restricted audio at runtime.
        const universeResult = await grant('Universe', targetUniverseId.trim(), apiKey);
        next.push(universeResult);
        setResults([...next]);
      }
    } catch (caught: any) {
      setError(caught?.message || 'Gagal menghubungi Roblox.');
    } finally {
      setSharing(false);
    }
  }

  const field = 'w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/60';
  const card = 'rounded-2xl border border-white/10 bg-white/[0.035] p-5';

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-cyan-400"><Share2 size={15} /> Development Items</div>
        <h1 className="text-3xl font-black text-white">Sharing Asset</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">Bagikan izin pakai audio Community A ke Community B tanpa upload ulang. Audio tetap dimiliki Community A.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={card}>
          <div className="mb-4 flex items-center gap-2 text-white"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-sm font-bold text-cyan-300">1</span><h2 className="font-bold">Pilih audio dari Community A</h2></div>
          <label className="mb-1 block text-xs font-semibold text-slate-300">Group ID Community A</label>
          <input className={field} inputMode="numeric" value={sourceGroupId} onChange={event => setSourceGroupId(event.target.value)} placeholder="Contoh: 1234567" />
          <label className="mb-1 mt-4 block text-xs font-semibold text-slate-300">Asset ID audio</label>
          <textarea className={`${field} min-h-32 resize-y`} value={pastedIds} onChange={event => setPastedIds(event.target.value)} placeholder="Paste ID atau link audio dari Development Items. Pisahkan dengan baris baru, koma, atau spasi." />
          <p className="mt-2 text-xs text-slate-500">Roblox belum menyediakan daftar lengkap audio grup lewat API key. Salin ID dari Development Items, atau pilih audio yang pernah diupload lewat Disperser di bawah.</p>
        </section>

        <section className={card}>
          <div className="mb-4 flex items-center gap-2 text-white"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20 text-sm font-bold text-indigo-300">2</span><h2 className="font-bold">Tentukan tujuan</h2></div>
          <label className="mb-1 block text-xs font-semibold text-slate-300">Group ID Community B</label>
          <input className={field} inputMode="numeric" value={targetGroupId} onChange={event => setTargetGroupId(event.target.value)} placeholder="Community yang diberi akses" />
          <label className="mb-1 mt-4 block text-xs font-semibold text-slate-300">Universe ID experience B <span className="font-normal text-slate-500">(opsional)</span></label>
          <input className={field} inputMode="numeric" value={targetUniverseId} onChange={event => setTargetUniverseId(event.target.value)} placeholder="Agar audio dapat diputar dalam experience" />
          <p className="mt-2 text-xs text-slate-500">Izin ke Community B membantu kolaborator menggunakan audio. Jika audio dipakai di game, isi Universe ID agar experience juga mendapat izin pakai.</p>
          <div className="mt-5 flex items-center gap-3 rounded-xl bg-cyan-500/10 px-4 py-3 text-xs text-cyan-200"><Music2 size={18} className="shrink-0" /> Backend memeriksa jenis Audio dan pemilik Community A sebelum membagikan tiap ID.</div>
        </section>
      </div>

      <section className={card}>
        <div className="mb-3 flex items-center justify-between gap-3"><h2 className="font-bold text-white">Audio dari Library Disperser</h2><span className="text-xs text-slate-500">{selected.length} dipilih</span></div>
        {loadingLibrary ? <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> Memuat library...</div>
          : library.length === 0 ? <p className="text-sm text-slate-500">Belum ada audio dengan Asset ID di library. Kamu bisa paste ID di atas.</p>
          : <div className="max-h-64 space-y-2 overflow-y-auto pr-1">{library.map(item => (
            <label key={item.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2.5 hover:border-cyan-500/30">
              <input type="checkbox" checked={selected.includes(item.assetId)} onChange={() => toggle(item.assetId)} className="accent-cyan-400" />
              <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{item.name}</span><span className="font-mono text-xs text-slate-500">{item.assetId}</span>
            </label>
          ))}</div>}
      </section>

      <section className={`${card} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between`}>
        <div><div className="text-sm font-bold text-white">{assetIds.length} audio siap diperiksa dan dibagikan</div><p className="mt-1 text-xs text-slate-500">Maksimal 100 audio sekali jalan. Izin ke experience bersifat permanen di Roblox.</p></div>
        <button type="button" onClick={handleShare} disabled={sharing || assetIds.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50">
          {sharing ? <Loader2 size={17} className="animate-spin" /> : <Share2 size={17} />}{sharing ? 'Membagikan...' : 'Bagikan akses'}{!sharing && <ArrowRight size={16} />}
        </button>
      </section>

      {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>}
      {results.map(result => (
        <section key={result.targetType} className={card}>
          <h2 className="font-bold text-white">{result.targetType === 'Group' ? 'Community B' : 'Experience B'}: {result.granted}/{result.total} berhasil</h2>
          <div className="mt-3 max-h-64 space-y-1 overflow-y-auto">{result.results.map(item => (
            <div key={item.assetId} className="flex items-start gap-2 text-xs">{item.status === 'success' ? <CheckCircle2 size={15} className="shrink-0 text-emerald-400" /> : <XCircle size={15} className="shrink-0 text-red-400" />}<span className="font-mono text-slate-300">{item.assetId}</span>{item.error && <span className="text-red-300">{item.error}</span>}</div>
          ))}</div>
        </section>
      ))}
    </div>
  );
}

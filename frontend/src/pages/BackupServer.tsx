import { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Database, LoaderCircle, RefreshCw } from 'lucide-react';
import { api } from '@/api/api';
import { useConfigStore } from '@/store/useConfigStore';
import BackupWorkbench from '@/components/backup/BackupWorkbench';

type Experience = { id: number; name: string };
function cleanId(value: unknown) {
  return value && value !== 'undefined' && value !== 'null' ? String(value).trim() : '';
}

export default function BackupServer() {
  const { groupId, userId, apiKey } = useConfigStore();
  const [ownerType, setOwnerType] = useState<'group' | 'user'>(() => cleanId(userId || localStorage.getItem('disperser_user_id')) && !cleanId(groupId || localStorage.getItem('disperser_group_id')) ? 'user' : 'group');
  const [ownerId, setOwnerId] = useState(() => cleanId(groupId || localStorage.getItem('disperser_group_id')) || cleanId(userId || localStorage.getItem('disperser_user_id')));
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ownerName, setOwnerName] = useState('');

  const loadExperiences = useCallback(async (type: 'group' | 'user', id: string) => {
    if (!id.trim()) { setError('Isi Group ID atau User ID terlebih dahulu.'); return; }
    setLoading(true); setError('');
    try {
      const result = type === 'group' ? await api.getCommunityExperiences(id.trim()) : await api.getUserExperiences(id.trim());
      const found: Experience[] = result.experiences || [];
      setExperiences(current => [...new Map([...current, ...found].map(item => [item.id, item])).values()]);
      setOwnerName(type === 'group' ? result.community?.name || '' : result.creator?.displayName || result.creator?.name || '');
      if (!found.length) setError('Tidak ada experience yang tampil untuk ID ini. Kamu tetap bisa memasukkan Universe ID secara manual.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Experience gagal dimuat. Coba gunakan Universe ID manual.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const savedGroup = cleanId(groupId || localStorage.getItem('disperser_group_id'));
    const savedUser = cleanId(userId || localStorage.getItem('disperser_user_id'));
    const timer = window.setTimeout(() => {
      if (savedGroup) void loadExperiences('group', savedGroup);
      else if (savedUser) void loadExperiences('user', savedUser);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [groupId, userId, loadExperiences]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-16">
      <Helmet><title>Backup Server | Disperser Studio</title></Helmet>
      <div className="page-header">
        <h1 className="flex items-center gap-3 text-3xl font-black text-white sm:text-4xl"><Database className="text-cyan-400" size={32} /> Backup Server</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">Simpan data experience, pindahkan ke experience lain, atau pulihkan backup.</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-36 flex-1 space-y-1 text-xs text-slate-400"><span>Milik siapa?</span>
            <select className="w-full rounded-xl border border-white/10 bg-slate-950 p-2.5 text-sm text-white" value={ownerType} onChange={event => { setOwnerType(event.target.value as 'group' | 'user'); setOwnerId(''); setOwnerName(''); }}>
              <option value="group">Group</option><option value="user">User</option>
            </select>
          </label>
          <label className="min-w-48 flex-[2] space-y-1 text-xs text-slate-400"><span>{ownerType === 'group' ? 'Group ID' : 'User ID'}</span>
            <input className="w-full rounded-xl border border-white/10 bg-slate-950 p-2.5 text-sm text-white" inputMode="numeric" value={ownerId} onChange={event => setOwnerId(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void loadExperiences(ownerType, ownerId); }} placeholder={ownerType === 'group' ? 'Masukkan Group ID' : 'Masukkan User ID'} />
          </label>
          <button className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50" disabled={loading} onClick={() => void loadExperiences(ownerType, ownerId)}>{loading ? <LoaderCircle className="animate-spin" size={16} /> : <RefreshCw size={16} />} Tampilkan experience</button>
        </div>
        <p className="mt-2 text-xs text-slate-400">{ownerName ? `${ownerName} · ${experiences.length} experience tersedia` : 'Experience privat atau disuspend bisa diisi dengan Universe ID langsung di bawah.'}</p>
        {error && <p role="alert" className="mt-2 text-xs text-amber-300">{error}</p>}
      </div>
      <BackupWorkbench experiences={experiences} suggestion={null} initialKey={apiKey || localStorage.getItem('disperser_key') || ''} />
    </div>
  );
}
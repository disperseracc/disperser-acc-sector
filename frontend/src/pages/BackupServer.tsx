import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { 
  Database, 
  Search, 
  RefreshCw, 
  ExternalLink, 
  Copy, 
  Check, 
  Users, 
  Eye, 
  Calendar, 
  Sparkles, 
  ShieldCheck, 
  Server, 
  AlertCircle, 
  Layers, 
  Flame,
  ArrowUpDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/api/api';
import { useConfigStore } from '@/store/useConfigStore';
import BackupWorkbench from '@/components/backup/BackupWorkbench';

interface CommunityInfo {
  id: number | string;
  name: string;
  description: string;
  memberCount: number;
  iconUrl?: string;
  owner?: {
    username: string;
    displayName: string;
    userId: number;
  };
  communityTier?: {
    currentTier: number;
  };
}

interface RobloxExperience {
  id: number;
  name: string;
  description: string;
  rootPlaceId: number | null;
  created: string;
  updated: string;
  placeVisits: number;
  iconUrl: string | null;
}

export default function BackupServer() {
  const { groupId: savedGroupId, userId: savedUserId, apiKey: savedApiKey } = useConfigStore();
  
  // Tab: 'community' | 'creator'
  const [targetType, setTargetType] = useState<'community' | 'creator'>('community');
  const cleanVal = (v: any) => {
    if (!v || v === 'undefined' || v === 'null') return '';
    return String(v).trim();
  };

  const [groupIdInput, setGroupIdInput] = useState(cleanVal(savedGroupId || localStorage.getItem('disperser_group_id')));
  const [userIdInput, setUserIdInput] = useState(cleanVal(savedUserId || localStorage.getItem('disperser_user_id')));
  
  // Data states
  const [community, setCommunity] = useState<CommunityInfo | null>(null);
  const [experiences, setExperiences] = useState<RobloxExperience[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'visits' | 'updated' | 'name'>('visits');
  
  // Copy helper
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [backupSource, setBackupSource] = useState<(RobloxExperience & { selectedAt: number }) | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchExperiences = async (overrideGroupId?: string, overrideUserId?: string) => {
    setLoading(true);
    setError(null);
    try {
      if (overrideGroupId !== undefined || (overrideUserId === undefined && targetType === 'community')) {
        const targetGid = overrideGroupId ?? groupIdInput.trim();
        if (!targetGid) {
          throw new Error('Please enter a Community / Group ID first');
        }
        const data = await api.getCommunityExperiences(targetGid);
        setCommunity(data.community);
        setExperiences(data.experiences || []);
      } else {
        const targetUid = overrideUserId ?? userIdInput.trim();
        if (!targetUid) {
          throw new Error('Please enter a Roblox User ID first');
        }
        const data = await api.getUserExperiences(targetUid);
        setCommunity({
          id: data.creator.id,
          name: data.creator.displayName || data.creator.name,
          description: `@${data.creator.name}'s Experiences`,
          memberCount: 1,
          iconUrl: data.creator.iconUrl
        });
        setExperiences(data.experiences || []);
      }
    } catch (err: any) {
      console.error('Failed to load experiences:', err);
      setError(err.message || 'Failed to fetch experiences');
      setExperiences([]);
    } finally {
      setLoading(false);
    }
  };

  // Initial load if configured
  useEffect(() => {
    const cleanGid = cleanVal(groupIdInput);
    const cleanUid = cleanVal(userIdInput);
    if (cleanGid) {
      fetchExperiences(cleanGid);
    } else if (cleanUid) {
      setTargetType('creator');
      fetchExperiences(undefined, cleanUid);
    }
  }, []);

  // Filtered and sorted experiences
  const filteredExperiences = useMemo(() => {
    return experiences
      .filter((exp) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          exp.name.toLowerCase().includes(q) ||
          exp.description.toLowerCase().includes(q) ||
          exp.id.toString().includes(q) ||
          (exp.rootPlaceId && exp.rootPlaceId.toString().includes(q))
        );
      })
      .sort((a, b) => {
        if (sortBy === 'visits') return (b.placeVisits || 0) - (a.placeVisits || 0);
        if (sortBy === 'updated') return new Date(b.updated).getTime() - new Date(a.updated).getTime();
        return a.name.localeCompare(b.name);
      });
  }, [experiences, searchQuery, sortBy]);

  const totalVisits = useMemo(() => {
    return experiences.reduce((acc, curr) => acc + (curr.placeVisits || 0), 0);
  }, [experiences]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-16">
      <Helmet>
        <title>Backup Server | Disperser Studio</title>
      </Helmet>

      {/* Page Header */}
      <div className="page-header relative">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold uppercase tracking-wider mb-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              Roblox DataStore & Migration Engine
            </div>
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight flex items-center gap-3">
              <Database className="text-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,0.4)]" size={38} />
              Backup Server
            </h1>
            <p className="page-desc mt-1.5 text-slate-400 text-sm max-w-xl">
              Backup Standard dan OrderedDataStore, migrasi antar-experience, dan restore data melalui Roblox Open Cloud.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900/60 border border-white/[0.08] rounded-2xl p-1.5 backdrop-blur-xl shadow-lg">
            <button
              onClick={() => {
                setTargetType('community');
                if (groupIdInput) fetchExperiences(groupIdInput);
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                targetType === 'community'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Users size={15} />
              Community (Group)
            </button>
            <button
              onClick={() => {
                setTargetType('creator');
                if (userIdInput) fetchExperiences(undefined, userIdInput);
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                targetType === 'creator'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Server size={15} />
              Personal Creator
            </button>
          </div>
        </div>
      </div>

      <BackupWorkbench experiences={experiences} suggestion={backupSource} initialKey={savedApiKey || localStorage.getItem('disperser_key') || ''} />

      {/* Target Source Input Bar */}
      <Card className="glass-panel rounded-3xl border border-white/[0.08] backdrop-blur-2xl shadow-2xl">
        <CardContent className="p-6">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchExperiences();
            }}
            className="flex flex-col md:flex-row items-stretch md:items-center gap-4"
          >
            <div className="flex-1 flex items-center gap-3 bg-slate-950/60 border border-white/[0.08] rounded-2xl px-4 py-3 focus-within:border-cyan-500/50 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all">
              {targetType === 'community' ? (
                <Users size={20} className="text-cyan-400 shrink-0" />
              ) : (
                <Server size={20} className="text-cyan-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  {targetType === 'community' ? 'Community / Group ID' : 'Roblox User ID'}
                </label>
                <input
                  type="text"
                  placeholder={targetType === 'community' ? 'e.g. 1 or your Community Group ID' : 'e.g. 1179762'}
                  value={targetType === 'community' ? groupIdInput : userIdInput}
                  onChange={(e) => {
                    if (targetType === 'community') setGroupIdInput(e.target.value);
                    else setUserIdInput(e.target.value);
                  }}
                  className="w-full bg-transparent border-none text-white text-sm font-semibold focus:outline-none placeholder:text-slate-600 mt-0.5"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold px-7 py-6 rounded-2xl shadow-lg shadow-cyan-500/25 flex items-center gap-2.5 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {loading ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <Sparkles size={18} />
              )}
              <span className="text-sm">{loading ? 'Scanning...' : 'Muat Experiences'}</span>
            </Button>
          </form>

          {/* Active Community Banner if loaded */}
          {community && (
            <div className="mt-6 pt-6 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-4 animate-in fade-in duration-300">
              <div className="flex items-center gap-4">
                {community.iconUrl ? (
                  <img
                    src={community.iconUrl}
                    alt={community.name}
                    className="w-14 h-14 rounded-2xl object-cover border border-white/[0.1] shadow-lg"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <Users size={26} />
                  </div>
                )}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-bold text-white tracking-tight">{community.name}</h2>
                    <Badge variant="outline" className="border-cyan-500/30 text-cyan-300 bg-cyan-500/10 text-xs px-2.5 py-0.5 font-mono">
                      ID: {community.id}
                    </Badge>
                    {community.communityTier && (
                      <Badge className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs px-2.5 py-0.5">
                        Tier {community.communityTier.currentTier}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-1.5 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Users size={13} className="text-cyan-400" />
                      {Number(community.memberCount || 0).toLocaleString()} Members
                    </span>
                    {community.owner && (
                      <span className="text-slate-400">
                        Owner: <strong className="text-slate-200">{community.owner.displayName || community.owner.username}</strong>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {targetType === 'community' && (
                  <a
                    href={`https://www.roblox.com/groups/${community.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-slate-300 hover:text-cyan-300 glass-panel-elevated border-white/[0.08] hover:border-cyan-500/30 px-3.5 py-2 rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <span>View Community</span>
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error state */}
      {error && (
        <div className="glass-panel bg-red-500/10 border border-red-500/25 rounded-2xl p-4 flex items-center gap-3.5 text-red-400 text-sm animate-in slide-in-from-top-2">
          <AlertCircle size={22} className="shrink-0 text-red-400" />
          <div className="flex-1">
            <p className="font-bold text-red-300">{error}</p>
            <p className="text-xs text-red-400/80 mt-0.5">
              Pastikan Group / User ID benar dan memiliki experience publik di Roblox.
            </p>
          </div>
        </div>
      )}

      {/* Metrics & Filter Bar */}
      {experiences.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="glass-panel rounded-2xl p-5 border border-white/[0.08] flex items-center gap-4 shadow-lg backdrop-blur-xl">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                <Layers size={22} />
              </div>
              <div>
                <div className="text-2xl font-black text-white tracking-tight">{experiences.length}</div>
                <div className="text-xs text-slate-400 font-medium">Experiences Ditemukan</div>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-5 border border-white/[0.08] flex items-center gap-4 shadow-lg backdrop-blur-xl">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <Flame size={22} />
              </div>
              <div>
                <div className="text-2xl font-black text-white tracking-tight">{totalVisits.toLocaleString()}</div>
                <div className="text-xs text-slate-400 font-medium">Total Player Visits</div>
              </div>
            </div>

            <div className="glass-panel rounded-2xl p-5 border border-white/[0.08] flex items-center gap-4 shadow-lg backdrop-blur-xl">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <ShieldCheck size={22} />
              </div>
              <div>
                <div className="text-2xl font-black text-emerald-400 tracking-tight">Ready</div>
                <div className="text-xs text-slate-400 font-medium">DataStore Snapshot Sync</div>
              </div>
            </div>
          </div>

          {/* Search and Sort controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Cari nama experience atau Universe ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 glass-input bg-slate-900/60 border-white/[0.08] text-white rounded-xl placeholder:text-slate-500 focus-visible:ring-cyan-500/40"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 glass-panel-elevated border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-slate-300">
                <ArrowUpDown size={14} className="text-cyan-400" />
                <span className="font-bold text-slate-400 uppercase text-[10px]">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="visits" className="bg-slate-900 text-white">Most Visits</option>
                  <option value="updated" className="bg-slate-900 text-white">Recently Updated</option>
                  <option value="name" className="bg-slate-900 text-white">Alphabetical</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Experience List Cards */}
      {loading ? (
        <div className="min-h-[300px] flex flex-col items-center justify-center gap-3.5 glass-panel border border-white/[0.08] rounded-3xl p-8 backdrop-blur-2xl">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <RefreshCw size={28} className="animate-spin" />
          </div>
          <p className="text-base font-bold text-white">Scanning Roblox Experiences...</p>
          <p className="text-xs text-slate-400">Mengambil data tempat, thumbnail, dan metadata komunitas</p>
        </div>
      ) : filteredExperiences.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExperiences.map((exp) => (
            <Card
              key={exp.id}
              className="glass-card-interactive glass-panel rounded-3xl border border-white/[0.08] hover:border-cyan-500/30 overflow-hidden transition-all duration-300 flex flex-col justify-between group shadow-xl"
            >
              <div>
                {/* Header & Thumbnail */}
                <div className="relative h-48 bg-slate-950 overflow-hidden border-b border-white/[0.06]">
                  {exp.iconUrl ? (
                    <img
                      src={exp.iconUrl}
                      alt={exp.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 bg-slate-900/40">
                      <Layers size={40} className="mb-2 opacity-40 text-cyan-400" />
                      <span className="text-xs font-semibold text-slate-400">No Icon Available</span>
                    </div>
                  )}

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent" />

                  {/* Visits Badge */}
                  <div className="absolute top-3.5 right-3.5 bg-slate-950/80 backdrop-blur-md border border-white/10 rounded-full px-3 py-1 flex items-center gap-1.5 text-xs text-white font-bold shadow-lg">
                    <Eye size={12} className="text-cyan-400" />
                    <span>{(exp.placeVisits || 0).toLocaleString()}</span>
                  </div>

                  {/* Universe ID Pill */}
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-slate-950/80 backdrop-blur-md border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-300 shadow-lg">
                    <span className="text-slate-400 font-bold uppercase text-[9px]">Universe</span>
                    <span className="font-mono text-cyan-300 font-bold">{exp.id}</span>
                    <button
                      onClick={() => copyToClipboard(exp.id.toString(), `uni-${exp.id}`)}
                      className="p-1 hover:text-white transition-colors ml-0.5 cursor-pointer"
                      title="Copy Universe ID"
                    >
                      {copiedId === `uni-${exp.id}` ? (
                        <Check size={12} className="text-emerald-400" />
                      ) : (
                        <Copy size={12} />
                      )}
                    </button>
                  </div>
                </div>

                {/* Content */}
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                      {exp.name}
                    </h3>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 h-8 leading-relaxed">
                    {exp.description || 'Tidak ada deskripsi place.'}
                  </p>

                  <div className="pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-xs text-slate-400 font-medium">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-slate-500" />
                      <span>{new Date(exp.updated).toLocaleDateString('id-ID', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>

                    {exp.rootPlaceId && (
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="text-slate-500">Place:</span>
                        <span className="text-cyan-300 font-semibold">{exp.rootPlaceId}</span>
                        <button
                          onClick={() => copyToClipboard(exp.rootPlaceId!.toString(), `place-${exp.id}`)}
                          className="hover:text-cyan-400 transition-colors ml-0.5 cursor-pointer"
                          title="Copy Place ID"
                        >
                          {copiedId === `place-${exp.id}` ? (
                            <Check size={12} className="text-emerald-400" />
                          ) : (
                            <Copy size={12} />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </div>

              {/* Action Buttons */}
              <div className="p-4 pt-0 border-t border-white/[0.06] mt-2 flex items-center gap-2">
                <Button
                  onClick={() => { setBackupSource({ ...exp, selectedAt: Date.now() }); document.getElementById('backup-workbench')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                  className="flex-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold text-xs py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 hover:border-cyan-400/50 shadow-sm"
                >
                  <Database size={14} className="text-cyan-400" />
                  <span>Backup & Migrasi</span>
                </Button>

                {exp.rootPlaceId && (
                  <a
                    href={`https://www.roblox.com/games/${exp.rootPlaceId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 glass-panel-elevated border-white/[0.08] hover:border-cyan-500/40 text-slate-400 hover:text-white rounded-xl transition-all flex items-center justify-center cursor-pointer"
                    title="Buka Game di Roblox"
                  >
                    <ExternalLink size={15} />
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : !loading && community ? (
        <div className="min-h-[260px] flex flex-col items-center justify-center gap-3.5 glass-panel border border-white/[0.08] rounded-3xl p-8 text-center backdrop-blur-2xl">
          <Layers size={36} className="text-slate-500 mb-1" />
          <h3 className="text-lg font-bold text-white">Tidak ada Experience Ditemukan</h3>
          <p className="text-xs text-slate-400 max-w-md">
            Tidak ada experience publik pada daftar ini. Untuk experience privat atau disuspend, masukkan Universe ID langsung pada formulir backup di atas.
          </p>
        </div>
      ) : (
        <div className="min-h-[280px] flex flex-col items-center justify-center gap-4 glass-panel border border-dashed border-white/[0.12] rounded-3xl p-10 text-center backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400">
            <Users size={32} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Masukkan Community / Group ID Roblox</h3>
            <p className="text-xs text-slate-400 max-w-md mt-1.5 leading-relaxed">
              Ketik ID Komunitas Roblox di atas untuk melihat daftar seluruh experience dan universe place yang aktif untuk persiapan DataStore backup.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

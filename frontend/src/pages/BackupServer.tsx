import React, { useState, useEffect, useMemo } from 'react';
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
  ChevronRight, 
  Layers, 
  Key, 
  HardDriveDownload,
  Flame,
  ArrowUpDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/api/api';
import { useConfigStore } from '@/store/useConfigStore';

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
  const [groupIdInput, setGroupIdInput] = useState(savedGroupId || localStorage.getItem('disperser_group_id') || '');
  const [userIdInput, setUserIdInput] = useState(savedUserId || localStorage.getItem('disperser_user_id') || '');
  
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

  // Modal / DataStore Inspection state
  const [inspectExp, setInspectExp] = useState<RobloxExperience | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [datastoresList, setDatastoresList] = useState<any[]>([]);
  const [inspectApiKey, setInspectApiKey] = useState(savedApiKey || localStorage.getItem('disperser_key') || '');

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchExperiences = async (overrideGroupId?: string, overrideUserId?: string) => {
    setLoading(true);
    setError(null);
    try {
      if (targetType === 'community') {
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
    if (groupIdInput) {
      fetchExperiences(groupIdInput);
    } else if (userIdInput) {
      setTargetType('creator');
      fetchExperiences(undefined, userIdInput);
    }
  }, []);

  // Inspect DataStores Handler
  const handleInspect = async (exp: RobloxExperience) => {
    setInspectExp(exp);
    setInspectLoading(true);
    setInspectError(null);
    setDatastoresList([]);

    const key = inspectApiKey || savedApiKey || localStorage.getItem('disperser_key') || '';
    if (!key) {
      setInspectError('Open Cloud API Key is required to list DataStores. Add your key below or in Settings.');
      setInspectLoading(false);
      return;
    }

    try {
      const res = await api.getExperienceDataStores(exp.id.toString(), key);
      setDatastoresList(res.datastores || []);
    } catch (err: any) {
      setInspectError(err.message || 'Failed to query DataStores');
    } finally {
      setInspectLoading(false);
    }
  };

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
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase tracking-wider mb-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              Roblox DataStore & Migration Engine
            </div>
            <h1 className="text-4xl font-black text-white tracking-tight flex items-center gap-3">
              <Database className="text-cyan-400" size={34} />
              Backup Server
            </h1>
            <p className="page-desc mt-1">
              Jelajahi dan pilih experience di komunitas untuk backup DataStore & migrasi langsung via web.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 rounded-xl p-1.5 backdrop-blur-sm">
            <button
              onClick={() => {
                setTargetType('community');
                if (groupIdInput) fetchExperiences(groupIdInput);
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                targetType === 'community'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users size={14} />
              Community (Group)
            </button>
            <button
              onClick={() => {
                setTargetType('creator');
                if (userIdInput) fetchExperiences(undefined, userIdInput);
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                targetType === 'creator'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Server size={14} />
              Personal Creator
            </button>
          </div>
        </div>
      </div>

      {/* Target Source Input Bar */}
      <Card className="bg-[#111820]/90 border-slate-800 backdrop-blur-md shadow-xl">
        <CardContent className="p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              fetchExperiences();
            }}
            className="flex flex-col md:flex-row items-stretch md:items-center gap-4"
          >
            <div className="flex-1 flex items-center gap-3 bg-slate-900/90 border border-slate-700/80 rounded-xl px-4 py-2.5 focus-within:border-cyan-500 transition-colors">
              {targetType === 'community' ? (
                <Users size={18} className="text-cyan-400 shrink-0" />
              ) : (
                <Server size={18} className="text-cyan-400 shrink-0" />
              )}
              <div className="flex-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
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
                  className="w-full bg-transparent border-none text-white text-sm font-medium focus:outline-none placeholder:text-slate-600"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold px-6 py-5 rounded-xl shadow-lg shadow-cyan-500/20 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              {loading ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              <span>{loading ? 'Scanning...' : 'Muat Experiences'}</span>
            </Button>
          </form>

          {/* Active Community Banner if loaded */}
          {community && (
            <div className="mt-5 pt-5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 animate-in fade-in duration-300">
              <div className="flex items-center gap-3">
                {community.iconUrl ? (
                  <img
                    src={community.iconUrl}
                    alt={community.name}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-700 shadow-md"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <Users size={24} />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-white tracking-tight">{community.name}</h2>
                    <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/5 text-[10px]">
                      ID: {community.id}
                    </Badge>
                    {community.communityTier && (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
                        Tier {community.communityTier.currentTier}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                    <span className="flex items-center gap-1.5">
                      <Users size={12} className="text-slate-500" />
                      {Number(community.memberCount || 0).toLocaleString()} Members
                    </span>
                    {community.owner && (
                      <span className="text-slate-500">
                        Owner: <strong className="text-slate-300">{community.owner.displayName || community.owner.username}</strong>
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
                    className="text-xs text-slate-400 hover:text-cyan-400 bg-slate-900 border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <span>View Community</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error state */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-center gap-3 text-red-400 text-sm animate-in slide-in-from-top-2">
          <AlertCircle size={20} className="shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">{error}</p>
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
            <div className="bg-[#111820]/70 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Layers size={22} />
              </div>
              <div>
                <div className="text-2xl font-black text-white">{experiences.length}</div>
                <div className="text-xs text-slate-400 font-medium">Experiences Ditemukan</div>
              </div>
            </div>

            <div className="bg-[#111820]/70 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Flame size={22} />
              </div>
              <div>
                <div className="text-2xl font-black text-white">{totalVisits.toLocaleString()}</div>
                <div className="text-xs text-slate-400 font-medium">Total Player Visits</div>
              </div>
            </div>

            <div className="bg-[#111820]/70 border border-slate-800/80 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShieldCheck size={22} />
              </div>
              <div>
                <div className="text-2xl font-black text-emerald-400">Ready</div>
                <div className="text-xs text-slate-400 font-medium">DataStore Snapshot Sync</div>
              </div>
            </div>
          </div>

          {/* Search and Sort controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                type="text"
                placeholder="Cari nama experience atau Universe ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[#111820] border-slate-800 text-white rounded-xl placeholder:text-slate-600 focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-[#111820] border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-400">
                <ArrowUpDown size={14} className="text-slate-500" />
                <span className="font-semibold text-slate-500 uppercase text-[10px]">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
                >
                  <option value="visits" className="bg-[#111820] text-white">Most Visits</option>
                  <option value="updated" className="bg-[#111820] text-white">Recently Updated</option>
                  <option value="name" className="bg-[#111820] text-white">Alphabetical</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Experience List Cards */}
      {loading ? (
        <div className="min-h-[300px] flex flex-col items-center justify-center gap-3 bg-[#111820]/40 border border-slate-800/80 rounded-2xl p-8">
          <RefreshCw size={36} className="text-cyan-400 animate-spin" />
          <p className="text-sm font-semibold text-white">Scanning Roblox Experiences...</p>
          <p className="text-xs text-slate-500">Mengambil data tempat, thumbnail, dan metadata komunitas</p>
        </div>
      ) : filteredExperiences.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredExperiences.map((exp) => (
            <Card
              key={exp.id}
              className="bg-[#111820]/90 border-slate-800 hover:border-slate-700/80 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/5 group flex flex-col justify-between"
            >
              <div>
                {/* Header & Thumbnail */}
                <div className="relative h-44 bg-slate-950 overflow-hidden border-b border-slate-800/80">
                  {exp.iconUrl ? (
                    <img
                      src={exp.iconUrl}
                      alt={exp.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 bg-slate-900/50">
                      <Layers size={40} className="mb-2 opacity-50" />
                      <span className="text-xs font-semibold">No Icon Available</span>
                    </div>
                  )}

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#111820] via-transparent to-transparent opacity-80" />

                  {/* Visits Badge */}
                  <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md border border-white/10 rounded-full px-3 py-1 flex items-center gap-1.5 text-xs text-white font-bold">
                    <Eye size={12} className="text-cyan-400" />
                    <span>{(exp.placeVisits || 0).toLocaleString()}</span>
                  </div>

                  {/* Universe ID Pill */}
                  <div className="absolute bottom-3 left-3 flex items-center gap-1 bg-black/80 backdrop-blur-md border border-white/10 rounded-lg px-2.5 py-1 text-[11px] text-slate-300">
                    <span className="text-slate-500 font-bold uppercase text-[9px]">Universe</span>
                    <span className="font-mono text-cyan-300 font-semibold">{exp.id}</span>
                    <button
                      onClick={() => copyToClipboard(exp.id.toString(), `uni-${exp.id}`)}
                      className="p-1 hover:text-white transition-colors ml-1"
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
                    <h3 className="text-base font-bold text-white group-hover:text-cyan-400 transition-colors line-clamp-1">
                      {exp.name}
                    </h3>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2 h-8">
                    {exp.description || 'Tidak ada deskripsi place.'}
                  </p>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                    <div className="flex items-center gap-1">
                      <Calendar size={12} />
                      <span>Updated: {new Date(exp.updated).toLocaleDateString('id-ID', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>

                    {exp.rootPlaceId && (
                      <div className="flex items-center gap-1 font-mono">
                        <span>Place:</span>
                        <span className="text-slate-400">{exp.rootPlaceId}</span>
                        <button
                          onClick={() => copyToClipboard(exp.rootPlaceId!.toString(), `place-${exp.id}`)}
                          className="hover:text-cyan-400 transition-colors ml-0.5"
                          title="Copy Place ID"
                        >
                          {copiedId === `place-${exp.id}` ? (
                            <Check size={11} className="text-emerald-400" />
                          ) : (
                            <Copy size={11} />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </div>

              {/* Action Buttons */}
              <div className="p-4 pt-0 border-t border-slate-800/60 mt-2 flex items-center gap-2">
                <Button
                  onClick={() => handleInspect(exp)}
                  className="flex-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold text-xs py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Database size={14} />
                  <span>Inspect DataStores</span>
                </Button>

                {exp.rootPlaceId && (
                  <a
                    href={`https://www.roblox.com/games/${exp.rootPlaceId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors flex items-center justify-center"
                    title="Buka Game di Roblox"
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : !loading && community ? (
        <div className="min-h-[260px] flex flex-col items-center justify-center gap-3 bg-[#111820]/40 border border-slate-800 rounded-2xl p-8 text-center">
          <Layers size={36} className="text-slate-600 mb-1" />
          <h3 className="text-lg font-bold text-white">Tidak ada Experience Ditemukan</h3>
          <p className="text-xs text-slate-400 max-w-md">
            Komunitas ini belum mempublikasikan game atau place publik di Roblox. Pastikan status place diset Public di Creator Hub.
          </p>
        </div>
      ) : (
        <div className="min-h-[280px] flex flex-col items-center justify-center gap-4 bg-[#111820]/30 border border-dashed border-slate-800 rounded-3xl p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Users size={28} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Masukkan Community / Group ID Roblox</h3>
            <p className="text-xs text-slate-400 max-w-md mt-1">
              Ketik ID Komunitas Roblox di atas untuk melihat daftar seluruh experience dan universe place yang aktif untuk persiapan DataStore backup.
            </p>
          </div>
        </div>
      )}

      {/* --- DataStore Inspector Modal --- */}
      {inspectExp && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-[#111820] border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Database size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {inspectExp.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span>Universe ID:</span>
                    <strong className="text-cyan-400 font-mono">{inspectExp.id}</strong>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setInspectExp(null)}
                className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* API Key field if user wants to change/provide */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
                    <Key size={14} className="text-cyan-400" />
                    Open Cloud API Key
                  </label>
                  <span className="text-[11px] text-slate-500">Izin: DataStores (Read/Write)</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    placeholder="Masukkan Roblox Open Cloud API Key..."
                    value={inspectApiKey}
                    onChange={(e) => setInspectApiKey(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <Button
                    onClick={() => handleInspect(inspectExp)}
                    disabled={inspectLoading}
                    className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs px-4 py-2 rounded-xl shrink-0"
                  >
                    {inspectLoading ? <RefreshCw size={14} className="animate-spin" /> : 'Connect'}
                  </Button>
                </div>
              </div>

              {/* Status / Error */}
              {inspectError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-xs flex items-center gap-2.5">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{inspectError}</span>
                </div>
              )}

              {/* DataStores List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider text-[11px] flex items-center gap-2">
                    <HardDriveDownload size={14} className="text-cyan-400" />
                    Standard DataStores Terdaftar ({datastoresList.length})
                  </h4>
                </div>

                {inspectLoading ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <RefreshCw size={24} className="text-cyan-400 animate-spin" />
                    <span className="text-xs">Menghubungi Roblox Open Cloud API...</span>
                  </div>
                ) : datastoresList.length > 0 ? (
                  <div className="space-y-2">
                    {datastoresList.map((ds: any, idx: number) => (
                      <div
                        key={idx}
                        className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 text-xs font-mono font-bold">
                            DS
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white">{ds.name}</div>
                            {ds.createdTime && (
                              <div className="text-[10px] text-slate-500">
                                Created: {new Date(ds.createdTime).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 bg-emerald-500/5">
                            Online
                          </Badge>
                          <Button
                            size="sm"
                            className="bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-lg px-3 py-1 font-semibold"
                            onClick={() => alert(`Fitur Snapshot untuk DataStore "${ds.name}" siap diproses pada tahapan migrasi berikutnya!`)}
                          >
                            Prepare Snapshot
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : !inspectLoading && !inspectError ? (
                  <div className="py-6 text-center text-xs text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800/50">
                    Klik tombol "Connect" dengan API Key yang valid untuk memuat daftar DataStore di Universe ini.
                  </div>
                ) : null}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-900/40 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Roblox Open Cloud v1 Engine
              </span>
              <Button
                onClick={() => setInspectExp(null)}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-xl"
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Music, Image as ImageIcon, CheckCircle, Clock, AlertCircle, MessageSquare, Shield, Crown, Zap, SubscriptIcon, Subscript, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '../api/api';
import { supabase } from '../api/supabase';
import { useAppStore } from '../store/useAppStore';
import { useConfigStore } from '../store/useConfigStore';

export default function Overview() {
  const { items } = useAppStore();
  const { hasConfig, loadingConfig } = useConfigStore();
  const userStr = localStorage.getItem('disperser_user');
  const user = userStr ? JSON.parse(userStr) : {};
  const username = user.username || 'Creator';
  const [currentRole, setCurrentRole] = useState(user.current_role || 'Pro Plan');
  const [expireDate, setExpireDate] = useState(user.subscription_expires_at
    ? new Date(user.subscription_expires_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '-');

  const [totalAudios, setTotalAudios] = useState(0);
  const [totalApproved, setTotalApproved] = useState(0);
  const [totalPending, setTotalPending] = useState(0);
  const [dailyUploads, setDailyUploads] = useState(0);
  const dailyLimit = currentRole === 'Free' ? 3 : Infinity;

  useEffect(() => {
    const fetchData = async () => {
      const data = await api.getQueue();
      // Stats from library are still useful for total counts
      setTotalAudios(data.length);
      setTotalApproved(data.filter((item: any) => item.status === 'success').length);
      setTotalPending(data.filter((item: any) => item.status === 'pending' || item.status === 'processing' || item.status === 'reviewing').length);

      // Fetch latest user info
      if (user.id) {
        const { data: dbUser } = await supabase
          .from('users')
          .select('current_role, subscription_expires_at, uploads_today, last_upload_date')
          .eq('id', user.id)
          .single();

        if (dbUser) {
          const activeRole = dbUser.current_role || 'Pro Plan';
          setCurrentRole(activeRole);
          const newExpireDate = dbUser.subscription_expires_at
            ? new Date(dbUser.subscription_expires_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
            : '-';
          setExpireDate(newExpireDate);

          // Daily Reset Logic for Display
          const today = new Date().toISOString().split('T')[0];
          const lastUpload = dbUser.last_upload_date ? new Date(dbUser.last_upload_date).toISOString().split('T')[0] : '';

          if (lastUpload !== today) {
            setDailyUploads(0);
          } else {
            setDailyUploads(dbUser.uploads_today || 0);
          }

          // Update localStorage
          const updatedUser = { ...user, current_role: activeRole, subscription_expires_at: dbUser.subscription_expires_at, uploads_today: dbUser.uploads_today };
          localStorage.setItem('disperser_user', JSON.stringify(updatedUser));
        }
      }
    };
    fetchData();
  }, [user.id]);

  const stats = [
    { label: 'Total Audios', value: totalAudios.toString(), icon: <Music className="text-cyan-400" />, trend: 'Uploaded assets' },
    {
      label: 'Daily Upload Limit',
      value: currentRole === 'Free' ? `${dailyUploads}/${dailyLimit}` : '∞',
      icon: <Zap className="text-amber-400" />,
      trend: currentRole === 'Free' ? `${dailyLimit - dailyUploads} uploads left today` : 'Unlimited uploads'
    },
    { label: 'Approved Assets', value: totalApproved.toString(), icon: <CheckCircle className="text-emerald-400" />, trend: 'Ready on Roblox' },
    { label: 'Pending/Processing', value: totalPending.toString(), icon: <Clock className="text-blue-400" />, trend: 'Awaiting moderation' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <Helmet>
        <title>Dashboard | Disperser Studio</title>
      </Helmet>
      <div className="page-header">
        <div className="flex items-center gap-2 text-cyan-400 text-sm font-bold mb-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          SYSTEM ONLINE
        </div>
        <h1 className="text-4xl font-black text-white tracking-tight mb-2">
          Hello, <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">{username}</span>
        </h1>
        <p className="page-desc">Welcome back to Disperser Studio. Here's a quick look at your assets.</p>
      </div>

      {!loadingConfig && !hasConfig && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 animate-in slide-in-from-top-4 duration-500">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
              <AlertCircle className="text-red-400" size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">Configuration Required!</h3>
              <p className="text-sm text-slate-400 leading-relaxed max-w-xl">
                You haven't set up your <span className="text-white font-semibold">Roblox API Key</span> or <span className="text-white font-semibold">User ID</span> yet.
                Without these, you won't be able to upload assets to Roblox. Please complete your profile in Settings.
              </p>
            </div>
          </div>
          <Button
            variant="destructive"
            className="bg-red-600 hover:bg-red-500 text-white font-bold px-8 shrink-0"
            onClick={() => window.location.href = '/dashboard/settings'}
          >
            Complete Now
          </Button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="group relative rounded-3xl bg-slate-900/40 hover:bg-slate-900/60 border border-white/[0.08] hover:border-cyan-500/30 backdrop-blur-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-cyan-500/10"
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</span>
              <div className="w-10 h-10 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center group-hover:scale-110 transition-transform">
                {stat.icon}
              </div>
            </div>
            <div className="text-3xl font-black text-white tracking-tight mb-1">{stat.value}</div>
            <div className="text-xs text-slate-400 flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60" />
              {stat.trend}
            </div>
          </div>
        ))}
      </div>

      {/* Main Highlights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subscription & Account Status */}
        <div className="lg:col-span-2 rounded-3xl bg-slate-900/40 border border-white/[0.08] backdrop-blur-2xl p-8 relative overflow-hidden shadow-2xl flex flex-col justify-between">
          <div className="absolute top-0 right-0 p-8 opacity-[0.04] pointer-events-none">
            <Crown size={160} />
          </div>

          <div>
            <div className="flex items-center gap-2.5 text-xs font-extrabold text-cyan-400 uppercase tracking-widest mb-2">
              <Shield size={16} /> Status Akun & Lisensi
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight mb-2">
              Subscription Status
            </h2>
            <p className="text-sm text-slate-400 max-w-md leading-relaxed mb-6">
              Kelola status tier Anda untuk mendapatkan batas upload tak terbatas dan akselerasi transcoding audio.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-md">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Paket Aktif</div>
                <div className="text-2xl font-black bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  {currentRole}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-md">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Masa Berlaku</div>
                <div className="text-2xl font-black text-white">
                  {currentRole === 'Free' ? 'Lifetime Access' : expireDate}
                </div>
              </div>
            </div>
          </div>

          {currentRole === 'Free' && (
            <div className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/5 border border-amber-500/20 relative overflow-hidden">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
                    <Crown size={18} /> Upgrade ke Pro Plan
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 max-w-md">
                    Buka upload tak terbatas, bulk import YouTube & local, dan prioritas antrean.
                  </p>
                </div>
                <Button
                  onClick={() => window.open('https://discord.gg/2dRtqgmKPR', '_blank')}
                  className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-extrabold px-6 py-2.5 rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  Upgrade via Discord
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Benefits & Quick Actions Sidebar */}
        <div className="space-y-6">
          {/* Pro Benefits Card */}
          <div className="rounded-3xl bg-slate-900/40 border border-white/[0.08] backdrop-blur-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Sparkles size={20} />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base">Studio Features</h3>
                <p className="text-xs text-slate-400">Teknologi transcoding Roblox</p>
              </div>
            </div>

            <ul className="space-y-2.5 pt-2">
              {[
                "Roblox DataStore Migration & Backup",
                "Real-time Moderation Tracking",
                "High Quality OGG Audio Transcoder",
                "YouTube Audio Extraction (No Loss)",
                "Bulk Audio Auto-Namer & Formatter"
              ].map((benefit, i) => (
                <li key={i} className="text-xs text-slate-300 flex items-center gap-2.5 font-medium">
                  <div className="w-4 h-4 rounded-md bg-cyan-500/15 flex items-center justify-center shrink-0">
                    <Zap size={10} className="text-cyan-400" />
                  </div>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Quick External Links */}
          <div className="rounded-3xl bg-slate-900/40 border border-white/[0.08] backdrop-blur-2xl p-6 shadow-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Pintasan Cepat</h4>
            <div className="space-y-2">
              <a
                href="https://create.roblox.com/dashboard/creations"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] text-xs font-semibold text-slate-300 hover:text-white transition-all group"
              >
                <span>Roblox Creator Hub</span>
                <span className="text-slate-500 group-hover:text-cyan-400 transition-colors">↗</span>
              </a>

              <a
                href="https://discord.gg/2dRtqgmKPR"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-between p-3 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-xs font-semibold text-indigo-300 hover:text-white transition-all group"
              >
                <span>Discord Community Server</span>
                <span className="text-indigo-400 group-hover:text-white transition-colors">↗</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

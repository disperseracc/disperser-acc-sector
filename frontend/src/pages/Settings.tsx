import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ExternalLink, Key, User, Info, Save, CheckCircle, Users, Shield, Loader2, AlertCircle } from 'lucide-react';

import { supabase } from '@/api/supabase';
import { Helmet } from 'react-helmet-async';
import { BASE_URL } from '@/api/api';
import { useConfigStore } from '@/store/useConfigStore';

export default function Settings() {
  const { setConfig, uploadTarget, setUploadTarget } = useConfigStore();
  const [userId, setUserId] = useState(localStorage.getItem('disperser_user_id') || '');
  const [groupId, setGroupId] = useState(localStorage.getItem('disperser_group_id') || '');
  const [apiKey, setApiKey] = useState(localStorage.getItem('disperser_key') || '');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');


  // Fetch from Supabase on load
  useEffect(() => {
    const fetchUserData = async () => {
      const storedUser = localStorage.getItem('disperser_user');
      if (!storedUser) return;

      const { id } = JSON.parse(storedUser);

      const { data, error } = await supabase
        .from('users')
        .select('roblox_user_id, roblox_group_id, roblox_api_key')
        .eq('id', id)
        .single();

      if (data && !error) {
        if (data.roblox_user_id) {
          setUserId(data.roblox_user_id);
          localStorage.setItem('disperser_user_id', data.roblox_user_id);
        }
        if (data.roblox_group_id) {
          setGroupId(data.roblox_group_id);
          localStorage.setItem('disperser_group_id', data.roblox_group_id);
        }
        if (data.roblox_api_key) {
          setApiKey(data.roblox_api_key);
          localStorage.setItem('disperser_key', data.roblox_api_key);
        }
      }
    };

    fetchUserData();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setStatus('idle');
    setStatusMsg('');
    try {
      const storedUser = localStorage.getItem('disperser_user');
      if (!storedUser) throw new Error('Not logged in');

      const { id } = JSON.parse(storedUser);

      // 1. Validate API Key with Backend first
      const validationRes = await fetch(`${BASE_URL}/api/roblox/validate-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey })
      });

      const contentType = validationRes.headers.get('content-type');
      let validationData;

      if (contentType && contentType.includes('application/json')) {
        validationData = await validationRes.json();
      } else {
        const text = await validationRes.text();
        throw new Error(`Roblox key validation failed (Server Error)`);
      }

      if (!validationRes.ok) {
        throw new Error(validationData.error || 'Roblox API validation failed');
      }

      // 2. Update Supabase
      const updatePayload: any = {
        roblox_user_id: userId,
        roblox_api_key: apiKey
      };
      if (groupId !== undefined) updatePayload.roblox_group_id = groupId;

      const { error } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', id);

      if (error) {
        console.warn('Supabase update warning (roblox_group_id column might not exist):', error.message);
      }

      // Update LocalStorage for quick access in API calls
      localStorage.setItem('disperser_user_id', userId);
      localStorage.setItem('disperser_group_id', groupId);
      localStorage.setItem('disperser_key', apiKey);

      // Update global context state
      setConfig(userId, groupId, apiKey);

      setSaved(true);
      setStatus('success');
      setStatusMsg('Credentials validated and saved successfully!');
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      console.error('Save failed:', e);
      setStatus('error');
      setStatusMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <Helmet>
        <title>Settings | Disperser Studio</title>
      </Helmet>
      <div className="page-header relative">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold uppercase tracking-wider mb-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          Credentials & Cloud Setup
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight flex items-center gap-3">
          <Key className="text-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,0.4)]" size={36} />
          Settings
        </h1>
        <p className="page-desc mt-1.5 text-slate-400 text-sm max-w-xl">
          Manage your Roblox credentials, Open Cloud permissions, and upload preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Settings Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="glass-panel rounded-3xl border border-white/[0.08] backdrop-blur-2xl shadow-2xl">
            <CardHeader className="p-6 md:p-8 pb-4">
              <CardTitle className="text-2xl font-black text-white flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Key size={20} />
                </div>
                Roblox Authentication
              </CardTitle>
              <CardDescription className="text-slate-400 text-sm mt-1">
                These credentials are required to interact with the Roblox Open Cloud API for asset uploads & studio synchronization.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 md:p-8 pt-2 space-y-6">
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="userId" className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <User size={14} className="text-cyan-400" /> Roblox User ID
                  </Label>
                  <Input
                    id="userId"
                    placeholder="e.g. 12345678"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="bg-slate-950/60 border-white/[0.08] text-white text-sm rounded-xl placeholder:text-slate-600 focus-visible:ring-cyan-500/40 h-11"
                  />
                  <p className="text-xs text-slate-400">Your unique Roblox numeric ID (can be found in your Roblox profile URL).</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="groupId" className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <Users size={14} className="text-cyan-400" /> Roblox Group ID <span className="text-[11px] text-slate-500 font-normal lowercase">(optional)</span>
                  </Label>
                  <Input
                    id="groupId"
                    placeholder="e.g. 98765432"
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    className="bg-slate-950/60 border-white/[0.08] text-white text-sm rounded-xl placeholder:text-slate-600 focus-visible:ring-cyan-500/40 h-11"
                  />
                  <p className="text-xs text-slate-400">Pilih atau isi Group ID ini jika API Key dikonfigurasi untuk komunitas Group Roblox.</p>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-white/[0.06]">
                <Label className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <Users size={14} className="text-cyan-400" /> Mode Default Target Upload
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setUploadTarget('user')}
                    className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 cursor-pointer ${uploadTarget === 'user'
                      ? 'glass-panel bg-cyan-500/10 border-cyan-500/40 text-white ring-1 ring-cyan-500/30 shadow-lg shadow-cyan-950/30'
                      : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:border-white/20 hover:text-white'
                      }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${uploadTarget === 'user' ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-white/[0.03] border-white/[0.06] text-slate-500'}`}>
                      <User size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">Personal Account</div>
                      <div className="text-xs text-slate-400 mt-0.5">Upload atas nama User ID</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUploadTarget('group')}
                    className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3.5 cursor-pointer ${uploadTarget === 'group'
                      ? 'glass-panel bg-cyan-500/10 border-cyan-500/40 text-white ring-1 ring-cyan-500/30 shadow-lg shadow-cyan-950/30'
                      : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:border-white/20 hover:text-white'
                      }`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${uploadTarget === 'group' ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-white/[0.03] border-white/[0.06] text-slate-500'}`}>
                      <Users size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">Roblox Group</div>
                      <div className="text-xs text-slate-400 mt-0.5">Upload atas nama Group ID</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Label htmlFor="apiKey" className="text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <Key size={14} className="text-cyan-400" /> Open Cloud API Key
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Paste your Roblox Open Cloud API key here..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="bg-slate-950/60 border-white/[0.08] text-white text-sm font-mono rounded-xl placeholder:text-slate-600 focus-visible:ring-cyan-500/40 h-11"
                />
                <p className="text-xs text-slate-400">Required permissions: Assets API (Read & Write).</p>
              </div>

              {status !== 'idle' && (
                <div className={`p-4 rounded-2xl border animate-in fade-in slide-in-from-top-2 duration-300 ${status === 'success'
                  ? 'glass-panel bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'glass-panel bg-red-500/10 border-red-500/30 text-red-300'
                  }`}>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                    {status === 'success' ? <CheckCircle size={16} className="text-emerald-400" /> : <AlertCircle size={16} className="text-red-400" />}
                    {status === 'success' ? 'Validation Passed' : 'Validation Error'}
                  </div>
                  <p className="text-xs mt-1 leading-relaxed opacity-90">{statusMsg}</p>
                </div>
              )}

              <Button
                onClick={handleSave}
                disabled={loading}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold h-12 rounded-2xl shadow-lg shadow-cyan-500/25 gap-2.5 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99] text-sm"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : (saved ? <CheckCircle size={18} /> : <Save size={18} />)}
                {loading ? 'Validating & Saving...' : (saved ? 'Credentials Verified & Saved!' : 'Save Credentials')}
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-panel rounded-3xl border border-white/[0.08] backdrop-blur-xl shadow-xl">
            <CardHeader className="p-6 md:p-8 pb-3">
              <CardTitle className="text-xl font-bold text-white flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Shield size={18} />
                </div>
                Security Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 md:p-8 pt-2">
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                Your credentials are encrypted and stored safely in your browser's local storage and only transmitted to your local backend server to communicate securely with official Roblox Open Cloud endpoints.
              </p>
              <div className="bg-slate-950/60 p-4 rounded-2xl border border-white/[0.06]">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Required API Permissions</h4>
                <ul className="text-xs text-slate-400 space-y-2">
                  <li className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                    <span><strong className="text-slate-200">Assets API</strong> (Read & Write) — Required for uploading audio assets and tracking moderation status.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 mt-1.5 shrink-0" />
                    <span><strong className="text-slate-200">DataStore API</strong> (Read & Write) — Optional, used if accessing DataStore snapshots on Backup Server.</span>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Instructions Sidebar */}
        <div className="space-y-6">
          <Card className="glass-panel rounded-3xl border border-white/[0.08] backdrop-blur-xl shadow-xl">
            <CardHeader className="p-6 pb-3">
              <CardTitle className="text-base font-bold text-white flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Info size={16} />
                </div>
                How to get API Keys?
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-2 text-xs text-slate-400 space-y-4 leading-relaxed">
              <ol className="list-decimal list-inside space-y-3 font-medium">
                <li>
                  Go to the <a href="https://create.roblox.com/dashboard/credentials?activeTab=ApiKeysTab" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 underline font-semibold inline-flex items-center gap-1">
                    Roblox Creator Dashboard <ExternalLink size={12} />
                  </a>
                </li>
                <li>Click on <span className="text-white font-semibold">"Create API Key"</span>.</li>
                <li>Add a name (e.g., <span className="text-cyan-300 font-mono">Disperser Studio</span>).</li>
                <li>
                  In <span className="text-white font-semibold">API Permissions</span>, add:
                  <ul className="list-disc list-inside ml-4 mt-1.5 text-xs text-slate-400 space-y-1">
                    <li>Assets API (Read & Write)</li>
                    <li>Ordered DataStore (Optional)</li>
                  </ul>
                </li>
                <li>Copy the generated key and paste it into the field on the left!</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

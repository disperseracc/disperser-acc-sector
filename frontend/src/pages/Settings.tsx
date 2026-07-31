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
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-desc">Manage your Roblox credentials and application preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Settings Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Key className="text-cyan-400" size={20} />
                Roblox Authentication
              </CardTitle>
              <CardDescription className="text-slate-400">
                These credentials are required to interact with the Roblox Open Cloud API.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="userId" className="text-slate-300 flex items-center gap-2">
                    <User size={14} /> Roblox User ID
                  </Label>
                  <Input
                    id="userId"
                    placeholder="e.g. 12345678"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-cyan-500/50"
                  />
                  <p className="text-[11px] text-slate-500">Your unique Roblox numeric ID (can be found in your profile URL).</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="groupId" className="text-slate-300 flex items-center gap-2">
                    <Users size={14} /> Roblox Group ID <span className="text-xs text-slate-500 font-normal">(Optional)</span>
                  </Label>
                  <Input
                    id="groupId"
                    placeholder="e.g. 98765432"
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-cyan-500/50"
                  />
                  <p className="text-[11px] text-slate-500">Pilih/Isi ini jika API Key kamu dikonfigurasi untuk Group. Audio akan langsung terhubung ke Group ini saat diupload.</p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-800">
                <Label className="text-slate-300 flex items-center gap-2">
                  <Users size={14} /> Mode Default Target Upload
                </Label>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setUploadTarget('user')}
                    className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${uploadTarget === 'user'
                        ? 'bg-cyan-500/10 border-cyan-500/50 text-white ring-1 ring-cyan-500/30'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                  >
                    <User size={18} className={uploadTarget === 'user' ? 'text-cyan-400 mt-0.5' : 'text-slate-500 mt-0.5'} />
                    <div>
                      <div className="text-xs font-bold">Personal Account</div>
                      <div className="text-[10px] text-slate-500">Upload atas nama User ID</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setUploadTarget('group')}
                    className={`p-3 rounded-xl border text-left transition-all flex items-start gap-3 ${uploadTarget === 'group'
                        ? 'bg-cyan-500/10 border-cyan-500/50 text-white ring-1 ring-cyan-500/30'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                  >
                    <Users size={18} className={uploadTarget === 'group' ? 'text-cyan-400 mt-0.5' : 'text-slate-500 mt-0.5'} />
                    <div>
                      <div className="text-xs font-bold">Roblox Group</div>
                      <div className="text-[10px] text-slate-500">Upload atas nama Group ID</div>
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="apiKey" className="text-slate-300 flex items-center gap-2">
                  <Key size={14} /> Open Cloud API Key
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="Paste your API key here..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-cyan-500/50"
                />
                <p className="text-[11px] text-slate-500">Required permissions: Asset Read & Asset Write.</p>
              </div>

              {status !== 'idle' && (
                <div className={`p-4 rounded-xl border animate-in fade-in slide-in-from-top-2 duration-300 ${status === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400'
                  }`}>
                  <div className="flex items-center gap-2 text-xs font-bold">
                    {status === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                    {status === 'success' ? 'SUCCESS' : 'VALIDATION ERROR'}
                  </div>
                  <p className="text-[12px] mt-1 opacity-80">{statusMsg}</p>
                </div>
              )}

              <Button
                onClick={handleSave}
                disabled={loading}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white gap-2 transition-all active:scale-[0.98]"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : (saved ? <CheckCircle size={18} /> : <Save size={18} />)}
                {loading ? 'Saving...' : (saved ? 'Changes Saved' : 'Save Credentials')}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Shield className="text-cyan-400" size={20} />
                Security Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400 mb-4">
                Your credentials are stored securely in your browser's local storage and are only sent directly to your local backend server to communicate with Roblox APIs.
              </p>
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                <h4 className="text-sm font-medium text-white mb-2">Required API Permissions</h4>
                <ul className="text-xs text-slate-400 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-1 shrink-0" />
                    <strong>Assets API</strong> (Read & Write) - Required for uploading and checking status.
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Instructions Sidebar */}
        <div className="space-y-6">
          <Card className="bg-slate-900/50 border-slate-800 border-dashed">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Info className="text-cyan-400" size={16} />
                How to get API Keys?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-400 space-y-4 leading-relaxed">
              <ol className="list-decimal list-inside space-y-3">
                <li>
                  Go to the <a href="https://create.roblox.com/dashboard/credentials?activeTab=ApiKeysTab" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline inline-flex items-center gap-1">
                    Roblox Creator Dashboard <ExternalLink size={12} />
                  </a>
                </li>
                <li>Click on <span className="text-white font-medium">"Create API Key"</span>.</li>
                <li>Add a name (e.g., "Disperser Studio").</li>
                <li>
                  In <span className="text-white font-medium">API Permissions</span>, add:
                  <ul className="list-disc list-inside ml-4 mt-1 text-xs text-slate-500">
                    <li>Assets API (Read & Write)</li>
                  </ul>
                </li>
                <li>Copy the generated key and paste it here!</li>
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

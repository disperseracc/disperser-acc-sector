import localforage from 'localforage';
import { supabase } from './supabase';

export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const getCurrentUserId = () => {
  try {
    const userStr = localStorage.getItem('disperser_user');
    if (userStr) return JSON.parse(userStr).id;
  } catch (e) { }
  return null;
};

// Using LocalForage (IndexedDB) for audio blobs and youtubeHistory
const historyDb = localforage.createInstance({
  name: 'DisperserDB',
  storeName: 'youtubeHistory'
});

export const audioBlobsDb = localforage.createInstance({
  name: 'DisperserDB',
  storeName: 'audioBlobs'
});

export const api = {
  // History Store
  async getHistory() {
    const list: any[] = [];
    await historyDb.iterate((val) => { list.push(val); });
    // Keep only the 5 most recent
    const sorted = list.sort((a, b) => b.createdAt - a.createdAt);
    if (sorted.length > 5) {
      const toRemove = sorted.slice(5);
      for (const item of toRemove) {
        await historyDb.removeItem(item.id);
      }
      return sorted.slice(0, 5);
    }
    return sorted;
  },

  async addToHistory(title: string, ytUrl: string, buffer: Uint8Array) {
    const id = Math.random().toString(36).substring(7);
    const item = { id, title, ytUrl, buffer, createdAt: Date.now() };
    await historyDb.setItem(id, item);
    return item;
  },

  async clearHistory() {
    await historyDb.clear();
  },

  // Queue Store
  async getQueue() {
    const userId = getCurrentUserId();
    if (!userId) return [];

    try {
      const { data, error } = await supabase
        .from('audio_library')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase fetch error:', error);
        return [];
      }

      return data.map(item => ({
        ...item,
        createdAt: item.created_at,
        assetId: item.asset_id,
        operationPath: item.operation_path,
        errorMessage: item.error_message,
      }));
    } catch (e) {
      console.error('Failed to fetch from Supabase. Is the URL correct?', e);
      return [];
    }
  },

  async addToQueue(name: string, description: string, buffer: Uint8Array | Blob | ArrayBuffer) {
    const id = crypto.randomUUID();
    const isMp3 = name.toLowerCase().endsWith('.mp3');
    const isOgg = name.toLowerCase().endsWith('.ogg');
    const isWavBlob = buffer instanceof Blob ? buffer.type === 'audio/wav' : true;
    const contentType = isMp3 ? 'audio/mpeg' : (isOgg && !isWavBlob ? 'audio/ogg' : 'audio/wav');
    const blob = buffer instanceof Blob ? buffer : new Blob([buffer as any], { type: contentType });

    // Store binary file in local IndexedDB (Zero Supabase Storage quota & egress used!)
    await audioBlobsDb.setItem(id, blob);

    // Insert ONLY metadata to Supabase DB
    const item = {
      id,
      name,
      description,
      status: 'pending',
      file_path: 'local',
      user_id: getCurrentUserId()
    };

    const { error: dbError } = await supabase
      .from('audio_library')
      .insert([item]);

    if (dbError) {
      console.error('Supabase DB insert error:', dbError);
      // Clean up local blob if DB metadata insert fails
      await audioBlobsDb.removeItem(id);
      throw dbError;
    }

    return { ...item, createdAt: Date.now() }; // approximate createdAt for immediate UI usage
  },

  async updateItem(id: string, data: any) {
    const updatePayload: any = { ...data };
    if (data.assetId !== undefined) updatePayload.asset_id = data.assetId;
    if (data.operationPath !== undefined) updatePayload.operation_path = data.operationPath;
    if (data.errorMessage !== undefined) updatePayload.error_message = data.errorMessage;

    delete updatePayload.assetId;
    delete updatePayload.operationPath;
    delete updatePayload.errorMessage;
    delete updatePayload.createdAt;

    const { error } = await supabase
      .from('audio_library')
      .update(updatePayload)
      .eq('id', id)
      .eq('user_id', getCurrentUserId());

    if (error) console.error('Supabase DB update error:', error);
  },

  async deleteItem(id: string) {
    // 1. Delete from local IndexedDB
    try {
      await audioBlobsDb.removeItem(id);
    } catch (e) { }

    // 2. Check if legacy file exists on Supabase Storage
    const { data: item } = await supabase
      .from('audio_library')
      .select('file_path')
      .eq('id', id)
      .eq('user_id', getCurrentUserId())
      .single();

    // 3. Delete from storage if legacy cloud file
    if (item?.file_path && item.file_path !== 'local') {
      await supabase.storage.from('audios').remove([item.file_path]);
    }

    // 4. Delete from DB
    await supabase.from('audio_library').delete().eq('id', id).eq('user_id', getCurrentUserId());
  },

  async deleteFileOnly(id: string) {
    try {
      await audioBlobsDb.removeItem(id);
    } catch (e) { }

    const { data: item } = await supabase
      .from('audio_library')
      .select('file_path')
      .eq('id', id)
      .eq('user_id', getCurrentUserId())
      .single();

    if (item?.file_path && item.file_path !== 'local') {
      await supabase.storage.from('audios').remove([item.file_path]);
      await supabase.from('audio_library').update({ file_path: null }).eq('id', id).eq('user_id', getCurrentUserId());
    }
  },

  async removeLocalBlob(id: string) {
    try {
      await audioBlobsDb.removeItem(id);
    } catch (e) { }
  },

  async getItemBuffer(id: string): Promise<Blob | null> {
    // 1. First check IndexedDB (Fast & 0 Supabase bandwidth)
    try {
      const localBlob = await audioBlobsDb.getItem<Blob>(id);
      if (localBlob) return localBlob;
    } catch (e) {
      console.warn('Error reading from IndexedDB:', e);
    }

    // 2. Fallback to Supabase Storage for legacy uploaded items
    const { data: item } = await supabase
      .from('audio_library')
      .select('file_path')
      .eq('id', id)
      .eq('user_id', getCurrentUserId())
      .single();

    if (!item?.file_path || item.file_path === 'local') return null;

    const { data: urlData, error: urlError } = await supabase.storage
      .from('audios')
      .createSignedUrl(item.file_path, 60);

    if (urlError || !urlData?.signedUrl) {
      console.error('Supabase storage signed url error:', urlError);
      return null;
    }

    try {
      const res = await fetch(urlData.signedUrl);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return await res.blob();
    } catch (e) {
      console.error('Error fetching Blob from signed URL:', e);
      return null;
    }
  },

  async getSignedUrl(id: string) {
    const { data: item } = await supabase
      .from('audio_library')
      .select('file_path')
      .eq('id', id)
      .eq('user_id', getCurrentUserId())
      .single();

    if (!item?.file_path || item.file_path === 'local') return null;

    const { data, error } = await supabase.storage
      .from('audios')
      .createSignedUrl(item.file_path, 300); // 5 mins

    if (error || !data) {
      console.error('Supabase signed URL error:', error);
      return null;
    }

    return data.signedUrl;
  },

  // Remote Services
  async ytDownload(url: string) {
    const res = await fetch(`${BASE_URL}/api/youtube/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Download failed');
    }
    const title = decodeURIComponent(res.headers.get('X-Audio-Title') || 'audio');
    const buffer = await res.arrayBuffer();
    return { title, buffer: new Uint8Array(buffer) };
  },

  async robloxUpload(name: string, desc: string, audioBlob: Blob, uploadTarget?: 'user' | 'group') {
    const key = localStorage.getItem('disperser_key');
    const userId = localStorage.getItem('disperser_user_id'); // Roblox Creator ID
    const groupId = localStorage.getItem('disperser_group_id');
    const target = uploadTarget || localStorage.getItem('disperser_upload_target') || 'user';
    const sbUserId = getCurrentUserId();
    const form = new FormData();
    form.append('apiKey', key || '');
    form.append('userId', userId || '');
    if (groupId) form.append('groupId', groupId);
    form.append('uploadTarget', target);
    form.append('supabaseUserId', sbUserId || '');
    form.append('name', name);
    form.append('description', desc);
    form.append('file', audioBlob, 'audio.wav');

    const res = await fetch(`${BASE_URL}/api/roblox/upload`, {
      method: 'POST',
      body: form
    });
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch (e) {
      throw new Error(`Server returned non-JSON response (${res.status}): ${text.substring(0, 150)}`);
    }
    if (!res.ok) {
      throw new Error(data.error || data.message || `Upload failed (${res.status})`);
    }
    return data;
  },

  async robloxUploadFromUrl(name: string, desc: string, fileUrl: string, uploadTarget?: 'user' | 'group') {
    const apiKey = localStorage.getItem('disperser_key');
    const userId = localStorage.getItem('disperser_user_id'); // Roblox Creator ID
    const groupId = localStorage.getItem('disperser_group_id');
    const target = uploadTarget || localStorage.getItem('disperser_upload_target') || 'user';
    const sbUserId = getCurrentUserId();

    const res = await fetch(`${BASE_URL}/api/roblox/upload-from-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey,
        userId,
        groupId,
        uploadTarget: target,
        supabaseUserId: sbUserId,
        name,
        description: desc,
        fileUrl
      })
    });

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch (e) {
      let msg = `Server returned non-JSON response (${res.status})`;
      if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
        msg = `Server Error (${res.status}): Path not found or HTML error page returned.`;
      }
      throw new Error(msg);
    }

    if (!res.ok) {
      throw new Error(data.error || data.message || `Upload failed (${res.status})`);
    }

    return data;
  },

  async checkOperation(opId: string) {
    const key = localStorage.getItem('disperser_key');
    const res = await fetch(`${BASE_URL}/api/roblox/operation/${opId}?apiKey=${encodeURIComponent(key || '')}`);
    return await res.json();
  },

  async getAssetMeta(assetId: string) {
    const key = localStorage.getItem('disperser_key');
    const res = await fetch(`${BASE_URL}/api/roblox/asset/${assetId}?apiKey=${encodeURIComponent(key || '')}`);
    return await res.json();
  }
};

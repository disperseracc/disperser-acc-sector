import { Router } from 'express';

const ROBLOX_API = 'https://apis.roblox.com';
const MAX_ASSETS = 100;
const BATCH_SIZE = 50;

type GrantTarget = 'Group' | 'Universe';
type AssetResult = { assetId: string; status: 'success' | 'error'; error?: string };

function positiveId(value: unknown): string | null {
  const id = String(value ?? '').trim();
  return /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id)) ? id : null;
}

async function robloxJson(url: string, apiKey: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { 'x-api-key': apiKey, Accept: 'application/json', ...(init?.headers || {}) },
  });
  const raw = await response.text();
  let data: any = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
  return { ok: response.ok, status: response.status, data };
}

function robloxError(data: any, status: number): string {
  return data?.error?.message || data?.message || data?.errors?.[0]?.message || `Roblox HTTP ${status}`;
}

export function createAssetSharingRouter() {
  const router = Router();

  router.post('/grant', async (req, res) => {
    const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
    const sourceGroupId = positiveId(req.body?.sourceGroupId);
    const targetType: GrantTarget | null = req.body?.targetType === 'Group' || req.body?.targetType === 'Universe'
      ? req.body.targetType : null;
    const targetId = positiveId(req.body?.targetId);
    const rawIds = req.body?.assetIds;
    if (!apiKey || !sourceGroupId || !targetType || !targetId || !Array.isArray(rawIds)) {
      return res.status(400).json({ error: 'API key, Community A, tujuan, dan daftar Asset ID wajib diisi.' });
    }
    if (targetType === 'Group' && targetId === sourceGroupId) {
      return res.status(400).json({ error: 'Community tujuan harus berbeda dari Community asal.' });
    }
    if (rawIds.length < 1 || rawIds.length > MAX_ASSETS) {
      return res.status(400).json({ error: `Pilih 1–${MAX_ASSETS} audio per proses.` });
    }
    const assetIds = [...new Set(rawIds.map(positiveId))];
    if (assetIds.includes(null) || assetIds.length === 0) {
      return res.status(400).json({ error: 'Asset ID harus berupa angka positif.' });
    }

    const results: AssetResult[] = [];
    const eligible: string[] = [];
    try {
      // Verify both type and creator before forwarding grants to Roblox.
      for (let offset = 0; offset < assetIds.length; offset += 8) {
        const checked = await Promise.all(assetIds.slice(offset, offset + 8).map(async (assetId) => {
          try {
            const result = await robloxJson(`${ROBLOX_API}/assets/v1/assets/${assetId}`, apiKey);
            if (!result.ok) return { assetId, error: robloxError(result.data, result.status) };
            const asset = result.data;
            if (asset.assetType !== 'Audio') return { assetId, error: 'Asset ini bukan Audio.' };
            if (String(asset.creationContext?.creator?.groupId ?? '') !== sourceGroupId) {
              return { assetId, error: 'Audio bukan milik Community A.' };
            }
            return { assetId };
          } catch (error: any) {
            return { assetId, error: error?.message || 'Gagal memeriksa asset.' };
          }
        }));
        for (const item of checked) {
          if (item.error) results.push({ assetId: item.assetId!, status: 'error', error: item.error });
          else eligible.push(item.assetId!);
        }
      }

      for (let offset = 0; offset < eligible.length; offset += BATCH_SIZE) {
        const batch = eligible.slice(offset, offset + BATCH_SIZE);
        const grant = await robloxJson(`${ROBLOX_API}/asset-permissions-api/v1/assets/permissions`, apiKey, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subjectType: targetType,
            subjectId: targetId,
            action: 'Use',
            requests: batch.map(assetId => ({ assetId: Number(assetId) })),
          }),
        });
        if (!grant.ok) {
          const error = robloxError(grant.data, grant.status);
          results.push(...batch.map(assetId => ({ assetId, status: 'error' as const, error })));
          continue;
        }
        const successes = new Set((grant.data?.successAssetIds || []).map(String));
        const errors = new Map((grant.data?.errors || []).map((item: any) => [String(item.assetId), String(item.code || 'Roblox menolak izin')]));
        for (const assetId of batch) {
          results.push(successes.has(assetId)
            ? { assetId, status: 'success' }
            : { assetId, status: 'error', error: String(errors.get(assetId) || 'Roblox tidak mengonfirmasi izin asset ini.') });
        }
      }

      return res.json({
        success: true,
        targetType,
        targetId,
        total: assetIds.length,
        granted: results.filter(item => item.status === 'success').length,
        results,
      });
    } catch (error: any) {
      return res.status(502).json({ error: error?.message || 'Gagal terhubung ke Roblox.' });
    }
  });

  return router;
}

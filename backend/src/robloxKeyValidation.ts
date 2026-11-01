type ValidationBody = {
  success: boolean;
  code: string;
  error?: string;
  detail?: string;
  message?: string;
};

export type KeyValidationResult = { status: number; body: ValidationBody };

function robloxMessage(data: any): string | undefined {
  const value = data?.error?.message ?? data?.error ?? data?.message ?? data?.errors?.[0]?.message;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function hasAssetOperation(scopes: any, operation: 'read' | 'write'): boolean {
  if (!Array.isArray(scopes)) return false;
  return scopes.some((scope: any) => {
    const name = String(scope?.name ?? '').toLowerCase();
    if (name === `asset:${operation}`) return true;
    return name === 'asset' && Array.isArray(scope?.operations)
      && scope.operations.some((value: unknown) => String(value).toLowerCase() === operation);
  });
}

export async function validateRobloxKey(apiKey: unknown, fetcher: typeof fetch = fetch): Promise<KeyValidationResult> {
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    return { status: 400, body: { success: false, code: 'KEY_REQUIRED', error: 'Isi Roblox Open Cloud API key terlebih dahulu.' } };
  }

  let response: Response;
  try {
    response = await fetcher('https://apis.roblox.com/api-keys/v1/introspect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: apiKey.trim() }),
    });
  } catch {
    return { status: 502, body: { success: false, code: 'ROBLOX_UNREACHABLE', error: 'Server Disperser tidak dapat menghubungi Roblox. Coba lagi beberapa saat.' } };
  }

  const data: any = await response.json().catch(() => ({}));
  const detail = robloxMessage(data)?.split(apiKey.trim()).join('[redacted]');
  if (!response.ok) {
    const error = response.status === 401
      ? 'Roblox menolak API key. Periksa apakah key benar, aktif, belum kedaluwarsa, dan belum dicabut.'
      : response.status === 403
        ? 'Roblox menolak akses API key dari server Disperser. Periksa pembatasan IP, status key, dan izin akun pembuat key.'
        : `Roblox gagal memeriksa API key (HTTP ${response.status}). Coba lagi atau periksa status Open Cloud.`;
    return { status: response.status, body: { success: false, code: 'ROBLOX_KEY_REJECTED', error, detail } };
  }
  if (data?.enabled === false) {
    return { status: 403, body: { success: false, code: 'KEY_DISABLED', error: 'API key dinonaktifkan di Roblox Creator Dashboard. Aktifkan key lalu coba lagi.' } };
  }
  if (data?.expired === true) {
    return { status: 403, body: { success: false, code: 'KEY_EXPIRED', error: 'API key sudah kedaluwarsa. Perbarui atau buat key baru di Roblox Creator Dashboard.' } };
  }
  if (!Array.isArray(data?.scopes)) {
    return { status: 502, body: { success: false, code: 'ROBLOX_RESPONSE_INVALID', error: 'Roblox tidak mengirim rincian izin API key. Coba validasi lagi beberapa saat.' } };
  }
  if (!hasAssetOperation(data?.scopes, 'read') || !hasAssetOperation(data?.scopes, 'write')) {
    return { status: 403, body: { success: false, code: 'ASSET_SCOPE_MISSING', error: 'API key terbaca, tetapi izin Assets API Read dan Write belum lengkap. Tambahkan keduanya pada key di Roblox Creator Dashboard.' } };
  }
  return { status: 200, body: { success: true, code: 'KEY_VALID', message: 'API key aktif dan izin Assets API Read/Write tersedia.' } };
}

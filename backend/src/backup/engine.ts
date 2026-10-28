import fs from 'fs/promises';
import { createReadStream } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Readable, Transform } from 'stream';
import { createGzip, createGunzip } from 'zlib';
import { isDeepStrictEqual } from 'util';
import { RobloxCloud, CloudError } from './cloud';
import { BackupEntry, BackupError, BackupJob, Credentials, PausedError, StartJob, storeSpecs, universeId, validateEntry } from './types';

const digest = (text: string) => crypto.createHash('sha256').update(text).digest('hex');
const identity = (entry: BackupEntry) => digest(JSON.stringify([entry.kind, entry.name, entry.scope, entry.key]));
const iso = () => new Date().toISOString();
const exists = async (file: string) => { try { await fs.access(file); return true; } catch (error: any) { if (error.code === 'ENOENT') return false; throw error; } };
async function atomicJson(file: string, value: unknown) {
  const temporary = file + '.' + crypto.randomUUID() + '.tmp';
  await fs.writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
  await fs.rename(temporary, file);
}
async function bounded<T>(items: T[], count: number, action: (item: T) => Promise<void>) {
  let next = 0;
  let failure: unknown;
  let failed = false;
  await Promise.all(Array.from({ length: Math.min(count, items.length) }, async () => {
    while (!failed && next < items.length) {
      const item = items[next++];
      try { await action(item); } catch (error) { failed = true; failure ??= error; }
    }
  }));
  if (failed) throw failure;
}
function firstNullPath(value: unknown, location: string, depth = 0): string | undefined {
  if (value === null) return location;
  if (!value || typeof value !== 'object' || depth > 24) return undefined;
  for (const [key, item] of Object.entries(value)) {
    const found = firstNullPath(item, Array.isArray(value) ? `${location}[${key}]` : `${location}.${key}`, depth + 1);
    if (found) return found;
  }
  return undefined;
}
function equivalent(entry: BackupEntry, remote: any) {
  return Object.prototype.hasOwnProperty.call(remote, 'value') && isDeepStrictEqual(entry.value, remote.value) &&
    (entry.kind === 'ordered' || (isDeepStrictEqual([...(entry.users || [])].sort(), [...(remote.users || [])].sort()) && isDeepStrictEqual(entry.attributes || {}, remote.attributes || {})));
}

export class BackupEngine {
  readonly cloud: RobloxCloud;
  private jobs = new Map<string, BackupJob>();
  private loads = new Map<string, Promise<BackupJob>>();
  private saves = new Map<string, Promise<void>>();
  private active = new Map<string, { stop: boolean; startedAt: number; universes: string[] }>();
  private reservations = new Map<string, string[]>();
  private deleting = new Set<string>();
  private sourcesInCreation = new Map<string, number>();
  constructor(readonly root = process.env.BACKUP_DATA_DIR || path.resolve(__dirname, '../../.backup-data'), cloud = new RobloxCloud(), private concurrency = 6) {
    this.cloud = cloud;
  }
  private dir(id: string) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new BackupError('Proses tidak ditemukan.', 404);
    return path.join(this.root, id);
  }
  private entries(job: BackupJob) { return path.join(this.dir(job.dataJobId), 'entries'); }
  private receipts(job: BackupJob) { return path.join(this.dir(job.id), 'receipts'); }
  private async save(job: BackupJob) {
    job.updatedAt = iso();
    const task = (this.saves.get(job.id) || Promise.resolve()).catch(() => {}).then(() => atomicJson(path.join(this.dir(job.id), 'job.json'), job));
    this.saves.set(job.id, task);
    await task;
  }
  private async load(id: string): Promise<BackupJob> {
    if (this.jobs.has(id)) return this.jobs.get(id)!;
    if (this.loads.has(id)) return this.loads.get(id)!;
    const loading = this.readJob(id).finally(() => this.loads.delete(id));
    this.loads.set(id, loading);
    return loading;
  }
  private async readJob(id: string): Promise<BackupJob> {
    let job: BackupJob;
    try { job = JSON.parse(await fs.readFile(path.join(this.dir(id), 'job.json'), 'utf8')); }
    catch (error: any) { if (error.code === 'ENOENT') throw new BackupError('Proses tidak ditemukan.', 404); throw error; }
    if (['queued', 'running'].includes(job.status)) { job.status = 'paused'; job.error = 'Backend sempat berhenti. Isi API key dan lanjutkan dari checkpoint.'; }
    const files = (await fs.readdir(this.entries(job))).filter(f => /^[a-f0-9]{64}\.json$/.test(f));
    job.captured = files.length;
    job.written = 0; job.skipped = 0; job.unchanged = 0;
    for (const file of await fs.readdir(this.receipts(job))) {
      if (!/^[a-f0-9]{64}\.json$/.test(file)) continue;
      const receipt = JSON.parse(await fs.readFile(path.join(this.receipts(job), file), 'utf8'));
      if (receipt.outcome === 'written') job.written++;
      if (receipt.outcome === 'skipped') job.skipped++;
      if (receipt.outcome === 'unchanged') job.unchanged++;
    }
    this.jobs.set(id, job);
    await this.save(job);
    return job;
  }
  async authorize(id: string, token: string): Promise<BackupJob> {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new BackupError('Proses tidak ditemukan atau token akses tidak valid.', 404);
    const job = await this.load(id);
    if (!crypto.timingSafeEqual(Buffer.from(job.tokenHash, 'hex'), Buffer.from(digest(token), 'hex'))) throw new BackupError('Proses tidak ditemukan atau token akses tidak valid.', 404);
    return job;
  }
  public(job: BackupJob) {
    const { tokenHash, stores, dataJobId, ...safe } = job;
    const running = this.active.get(job.id);
    const activeMs = job.activeMs + (running ? Date.now() - running.startedAt : 0);
    const processed = job.written + job.skipped + job.unchanged;
    const units = job.mode === 'backup' ? job.captured : processed;
    const perMinute = activeMs > 1000 ? Math.round(units / activeMs * 60000) : 0;
    return { ...safe, status: running && !['running', 'queued'].includes(job.status) ? 'running' as const : job.status, activeMs, stores: stores.map(({ kind, name, scope, done }) => ({ kind, name, scope, done })), processed,
      pauseRequested: !!running?.stop, perMinute, total: job.captureComplete ? job.captured : null,
      estimatedSeconds: job.captureComplete && job.mode !== 'backup' && perMinute > 0 ? Math.ceil(Math.max(0, job.captured - processed) / perMinute * 60) : null };
  }
  private async newJob(input: StartJob, source?: BackupJob) {
    const id = crypto.randomUUID();
    const token = crypto.randomBytes(32).toString('hex');
    const stores = source ? source.stores.map(s => ({ kind: s.kind, name: s.name, scope: s.scope })) : storeSpecs(input.stores);
    const job: BackupJob = {
      id, tokenHash: digest(token), mode: input.mode, status: 'queued', phase: input.mode === 'restore' ? 'apply' : 'capture',
      sourceUniverseId: source?.sourceUniverseId || universeId(input.sourceUniverseId),
      ...(input.mode !== 'backup' ? { targetUniverseId: universeId(input.targetUniverseId) } : {}),
      dataJobId: source?.dataJobId || id, stores: stores.map(s => ({ ...s, cursor: '', done: input.mode === 'restore' })),
      conflict: input.conflict === 'overwrite' ? 'overwrite' : 'skip', skipUnchanged: input.skipUnchanged !== false,
      verifyReadback: input.verifyReadback === true, captureComplete: !!source, captured: source?.captured || 0,
      written: 0, skipped: 0, unchanged: 0, disappeared: 0, retries: 0, createdAt: iso(), updatedAt: iso(), activeMs: 0
    };
    await fs.mkdir(path.join(this.dir(id), 'entries'), { recursive: true, mode: 0o700 });
    await fs.mkdir(this.receipts(job), { recursive: true, mode: 0o700 });
    this.jobs.set(id, job);
    await this.save(job);
    return { job, token };
  }
  private validateKeys(job: BackupJob, credentials: Credentials) {
    if (!job.captureComplete && !credentials.sourceKey?.trim()) throw new BackupError('API key sumber diperlukan untuk membaca backup.');
    if (job.mode !== 'backup' && !credentials.targetKey?.trim()) throw new BackupError('API key tujuan diperlukan.');
  }
  private assertCapacity(job: Pick<BackupJob, 'id' | 'sourceUniverseId' | 'targetUniverseId' | 'captureComplete'>) {
    if (this.active.size + this.reservations.size >= 2) throw new BackupError('Dua proses sedang berjalan. Jeda atau tunggu salah satunya.', 409);
    const needed = [!job.captureComplete ? job.sourceUniverseId : '', job.targetUniverseId].filter(Boolean);
    for (const universes of [...this.reservations.values(), ...[...this.active.values()].map(a => a.universes)]) if (universes.some(u => needed.includes(u))) throw new BackupError('Universe ini sedang digunakan proses lain. Tunggu atau jeda proses tersebut.', 409);
  }
  async create(input: StartJob) {
    if (!input || !['backup', 'migrate', 'restore'].includes(input.mode)) throw new BackupError('Mode proses tidak valid.');
    let source: BackupJob | undefined;
    if (input.mode === 'restore') {
      source = await this.authorize(String(input.backupJobId || ''), String(input.backupToken || ''));
      if (!source.captureComplete) throw new BackupError('Backup sumber belum lengkap.');
      if (this.deleting.has(source.id) || this.deleting.has(source.dataJobId)) throw new BackupError('Backup sumber sedang dihapus. Coba lagi.', 409);
    }
    const sourceId = source?.sourceUniverseId || universeId(input.sourceUniverseId);
    if (!source) storeSpecs(input.stores);
    if (input.mode !== 'backup') {
      const target = universeId(input.targetUniverseId);
      if (input.confirmedTarget !== target) throw new BackupError('Ketik ulang Universe ID tujuan untuk mengonfirmasi penulisan.');
      if (input.mode === 'migrate' && sourceId === target) throw new BackupError('Universe sumber dan tujuan migrasi harus berbeda.');
      if (!input.targetKey?.trim()) throw new BackupError('API key tujuan belum diisi.');
    }
    if (!source && !input.sourceKey?.trim()) throw new BackupError('API key sumber belum diisi.');
    this.assertCapacity({ id: '', sourceUniverseId: sourceId, targetUniverseId: input.mode === 'backup' ? undefined : universeId(input.targetUniverseId), captureComplete: !!source });
    const reservation = crypto.randomUUID();
    if (source) this.sourcesInCreation.set(source.dataJobId, (this.sourcesInCreation.get(source.dataJobId) || 0) + 1);
    this.reservations.set(reservation, [!source ? sourceId : '', input.mode === 'backup' ? '' : universeId(input.targetUniverseId)].filter(Boolean));
    try {
      const result = await this.newJob(input, source);
      this.launch(result.job, input);
      return { job: this.public(result.job), token: result.token };
    } finally { this.reservations.delete(reservation); if (source) { const count = this.sourcesInCreation.get(source.dataJobId) || 0; if (count <= 1) this.sourcesInCreation.delete(source.dataJobId); else this.sourcesInCreation.set(source.dataJobId, count - 1); } }
  }
  async delete(id: string, token: string) {
    const job = await this.authorize(id, token);
    if (this.active.has(id) || ['queued', 'running'].includes(job.status)) throw new BackupError('Jeda proses dan tunggu hingga status Dijeda sebelum menghapus.', 409);
    if (this.deleting.has(id) || this.sourcesInCreation.has(job.dataJobId)) throw new BackupError('Backup ini sedang digunakan. Coba lagi sesaat.', 409);
    this.deleting.add(id);
    try {
      if (job.dataJobId === id) {
        const folders = await fs.readdir(this.root, { withFileTypes: true });
        for (const folder of folders) {
          if (!folder.isDirectory() || folder.name === id || !/^[a-f0-9-]{36}$/.test(folder.name)) continue;
          let dependent: BackupJob;
          try { dependent = JSON.parse(await fs.readFile(path.join(this.dir(folder.name), 'job.json'), 'utf8')); }
          catch (error: any) { if (error.code === 'ENOENT') continue; throw error; }
          if (dependent.dataJobId === id) throw new BackupError('Backup ini masih dipakai proses restore lain. Hapus proses restore terkait lebih dulu.', 409);
        }
      }
      const directory = path.resolve(this.dir(id));
      if (path.dirname(directory) !== path.resolve(this.root)) throw new BackupError('Direktori backup tidak valid.');
      await fs.rm(directory, { recursive: true });
      this.jobs.delete(id); this.loads.delete(id); this.saves.delete(id);
    } finally { this.deleting.delete(id); }
  }
  async status(id: string, token: string) { return this.public(await this.authorize(id, token)); }
  async pause(id: string, token: string) {
    const job = await this.authorize(id, token);
    const active = this.active.get(id);
    if (active) active.stop = true;
    else if (job.status !== 'completed') { job.status = 'paused'; await this.save(job); }
    return this.public(job);
  }
  async resume(id: string, token: string, credentials: Credentials) {
    const job = await this.authorize(id, token);
    if (this.active.has(id)) throw new BackupError('Proses masih berjalan atau sedang menyelesaikan jeda.', 409);
    if (job.status === 'completed') return this.public(job);
    this.validateKeys(job, credentials);
    this.assertCapacity(job);
    this.launch(job, credentials);
    return this.public(job);
  }
  private launch(job: BackupJob, credentials: Credentials) {
    const control = { stop: false, startedAt: Date.now(), universes: [!job.captureComplete ? job.sourceUniverseId : '', job.targetUniverseId || ''].filter(Boolean) };
    this.active.set(job.id, control);
    job.status = 'running'; job.error = undefined;
    // Credentials exist only in this closure, never in job files or API responses.
    void this.run(job, credentials, () => { if (control.stop) throw new PausedError(); }).catch(error => {
      console.error('Backup checkpoint error for job ' + job.id + ': ' + error.message);
    }).finally(() => { this.active.delete(job.id); });
  }
  private async apply(job: BackupJob, entry: BackupEntry, credentials: Credentials, check: () => void) {
    const keyId = identity(entry);
    const receiptPath = path.join(this.receipts(job), keyId + '.json');
    if (await exists(receiptPath)) return;
    check();
    const retry = () => { job.retries++; };
    let outcome: 'written' | 'skipped' | 'unchanged' = 'written';
    if (job.conflict === 'overwrite' && job.skipUnchanged) {
      try {
        const current = await this.cloud.read(job.targetUniverseId!, credentials.targetKey!, entry, entry.key, check, retry);
        if (equivalent(entry, current)) outcome = 'unchanged';
      } catch (error) { if (!(error instanceof CloudError && error.status === 404)) throw error; }
    }
    if (outcome === 'written') {
      let response: any;
      try { response = await this.cloud.write(job.targetUniverseId!, credentials.targetKey!, entry, job.conflict === 'overwrite', check, retry); }
      catch (error) {
        if (job.conflict === 'skip' && error instanceof CloudError && (error.status === 409 || (error.status === 400 && /^Roblox 400: Entry Already Exist\b/i.test(error.message)))) {
          // Roblox can report an existing key as 409 or 400 Entry Already Exist. Compare before skipping.
          const current = await this.cloud.read(job.targetUniverseId!, credentials.targetKey!, entry, entry.key, check, retry);
          outcome = equivalent(entry, current) ? 'unchanged' : 'skipped';
        } else if (error instanceof CloudError && error.status === 400 && /Value cannot be null\. \(Parameter 'item'\)/i.test(error.message)) {
          const nullPath = firstNullPath(entry.value, 'value') || firstNullPath(entry.attributes, 'attributes');
          throw new BackupError(`Roblox menolak entry ${entry.name}/${entry.scope}/${entry.key}: ${error.message}${nullPath ? `; lokasi null: ${nullPath.slice(0, 120)}` : '; tidak ada null pada payload yang terlihat'}. Data tidak diubah.`, 400);
        } else throw error;
      }
      if (outcome === 'written') {
        if (!equivalent(entry, response)) throw new BackupError('Verifikasi respons gagal untuk ' + entry.name + '/' + entry.scope + '/' + entry.key, 502);
        if (job.verifyReadback) {
          const actual = await this.cloud.read(job.targetUniverseId!, credentials.targetKey!, entry, entry.key, check, retry);
          if (!equivalent(entry, actual)) throw new BackupError('Verifikasi baca ulang gagal untuk ' + entry.name + '/' + entry.scope + '/' + entry.key, 409);
        }
      }
    }
    await atomicJson(receiptPath, { outcome });
    job[outcome]++;
    await this.save(job);
  }
  private async run(job: BackupJob, credentials: Credentials, check: () => void) {
    try {
      await this.save(job);
      if (!job.captureComplete) {
        for (const store of job.stores) {
          if (store.done) continue;
          job.currentStore = store.name + ' / ' + store.scope;
          while (!store.done) {
            check();
            if (!store.pending) {
              store.pending = await this.cloud.list(job.sourceUniverseId, credentials.sourceKey!, store, store.cursor, check, () => { job.retries++; });
              if (store.pending.nextCursor && store.pending.nextCursor === store.cursor) throw new BackupError('Cursor Roblox tidak bergerak maju.', 502);
              await this.save(job);
            }
            await bounded(store.pending.entries, this.concurrency, async ref => {
              check();
              const spec = { kind: store.kind, name: store.name, scope: ref.scope };
              const file = path.join(this.entries(job), identity({ ...spec, key: ref.key } as BackupEntry) + '.json');
              let entry: BackupEntry;
              if (await exists(file)) entry = JSON.parse(await fs.readFile(file, 'utf8'));
              else {
                try {
                  entry = store.kind === 'ordered' && Object.prototype.hasOwnProperty.call(ref, 'value')
                    ? validateEntry({ ...spec, key: ref.key, value: ref.value, capturedAt: iso() })
                    : await this.cloud.capture(job.sourceUniverseId, credentials.sourceKey!, spec, ref.key, check, () => { job.retries++; });
                }
                catch (error) { if (error instanceof CloudError && error.status === 404) { job.disappeared++; return; } throw error; }
                await atomicJson(file, entry);
                job.captured++;
                await this.save(job);
              }
              if (job.mode === 'migrate') await this.apply(job, entry, credentials, check);
            });
            store.cursor = store.pending.nextCursor;
            store.done = !store.cursor;
            store.pending = undefined;
            await this.save(job);
          }
        }
        job.captureComplete = true;
      }
      if (job.mode !== 'backup') {
        job.phase = 'apply';
        const files = (await fs.readdir(this.entries(job))).filter(f => /^[a-f0-9]{64}\.json$/.test(f));
        // Pages already applied by migration have receipts and are skipped.
        await bounded(files, this.concurrency, async file => {
          check();
          if (await exists(path.join(this.receipts(job), file))) return;
          const entry = JSON.parse(await fs.readFile(path.join(this.entries(job), file), 'utf8'));
          job.currentStore = entry.name + ' / ' + entry.scope;
          await this.apply(job, entry, credentials, check);
        });
      }
      check();
      job.phase = 'done'; job.status = 'completed'; job.currentStore = undefined;
    } catch (error: any) {
      job.status = error instanceof PausedError ? 'paused' : 'failed';
      let message = String(error.message || 'Proses gagal.').slice(0, 500);
      for (const key of [credentials.sourceKey, credentials.targetKey]) if (key) message = message.split(key).join('[redacted]');
      job.error = error instanceof PausedError ? undefined : message;
    } finally {
      const active = this.active.get(job.id);
      if (active) { job.activeMs += Date.now() - active.startedAt; active.startedAt = Date.now(); }
      await this.save(job);
    }
  }
  async download(id: string, token: string): Promise<{ stream: Readable; filename: string }> {
    const job = await this.authorize(id, token);
    if (!job.captureComplete) throw new BackupError('Backup belum lengkap. Lanjutkan capture sebelum mengunduh.');
    const files = (await fs.readdir(this.entries(job))).filter(f => /^[a-f0-9]{64}\.json$/.test(f)).sort();
    const header = { type: 'manifest', format: 'disperser-backup', version: 1, sourceUniverseId: job.sourceUniverseId, createdAt: job.createdAt, stores: job.stores.map(({ kind, name, scope }) => ({ kind, name, scope })), entryCount: files.length };
    const folder = this.entries(job);
    async function* records() {
      const hash = crypto.createHash('sha256');
      const start = JSON.stringify(header) + '\n';
      hash.update(start);
      yield start;
      for (const file of files) {
        const entry = JSON.parse(await fs.readFile(path.join(folder, file), 'utf8'));
        const line = JSON.stringify({ type: 'entry', ...entry }) + '\n';
        hash.update(line);
        yield line;
      }
      yield JSON.stringify({ type: 'end', entryCount: files.length, sha256: hash.digest('hex') }) + '\n';
    }
    const source = Readable.from(records());
    const compressed = createGzip();
    source.on('error', error => compressed.destroy(error));
    compressed.on('close', () => source.destroy());
    return { stream: source.pipe(compressed), filename: 'disperser-' + job.sourceUniverseId + '-' + job.id + '.jsonl.gz' };
  }
  async importFile(file: string, compressed: boolean) {
    const raw = createReadStream(file);
    const stream = compressed ? raw.pipe(createGunzip()) : raw;
    // Forward file errors to the decoding stream as pipe() doesn't forward errors.
    if (compressed) raw.on('error', error => stream.destroy(error));
    const maxExpanded = 512 * 1024 * 1024;
    let expanded = 0;
    const limit = new Transform({ transform(chunk, _encoding, callback) {
      expanded += chunk.length;
      callback(expanded > maxExpanded ? new BackupError('Backup melebihi batas 512 MB setelah dekompresi.') : null, chunk);
    } });
    stream.on('error', error => limit.destroy(error));
    stream.pipe(limit);
    let job: BackupJob | undefined;
    let token = '';
    let header: any;
    let ended = false;
    let count = 0;
    let pending = '';
    const seen = new Set<string>();
    const hash = crypto.createHash('sha256');
    const line = async (text: string) => {
      if (!text) throw new BackupError('Baris kosong pada backup tidak valid.');
      const value = JSON.parse(text);
      if (ended) throw new BackupError('Backup mengandung data setelah checksum akhir.');
      if (!header) {
        if (value.type !== 'manifest' || value.format !== 'disperser-backup' || value.version !== 1 || !Number.isSafeInteger(value.entryCount) || value.entryCount < 0 || value.entryCount > 500000) throw new BackupError('Format atau manifest backup tidak valid.');
        header = value;
        const created = await this.newJob({ mode: 'backup', sourceUniverseId: universeId(value.sourceUniverseId), stores: storeSpecs(value.stores) });
        job = created.job; token = created.token;
        job.status = 'paused';
        hash.update(text + '\n');
        return;
      }
      if (value.type === 'end') {
        if (value.entryCount !== count || header.entryCount !== count || value.sha256 !== hash.digest('hex')) throw new BackupError('Checksum atau jumlah entry tidak cocok. File mungkin terpotong/rusak.');
        ended = true;
        return;
      }
      if (value.type !== 'entry') throw new BackupError('Record backup tidak dikenal.');
      const entry = validateEntry(value);
      if (!job!.stores.some(s => s.kind === entry.kind && s.name === entry.name && (s.scope === '*' || s.scope === entry.scope))) throw new BackupError('Entry berada di luar store/scope manifest.');
      const entryId = identity(entry);
      if (seen.has(entryId)) throw new BackupError('Backup mengandung key duplikat.');
      seen.add(entryId);
      if (++count > header.entryCount) throw new BackupError('Jumlah entry melebihi manifest.');
      await atomicJson(path.join(this.entries(job!), entryId + '.json'), entry);
      hash.update(text + '\n');
    };
    try {
      for await (const chunk of limit.setEncoding('utf8')) {
        pending += chunk;
        let newline: number;
        while ((newline = pending.indexOf('\n')) !== -1) {
          const text = pending.slice(0, newline);
          pending = pending.slice(newline + 1);
          if (Buffer.byteLength(text) > 32 * 1024 * 1024) throw new BackupError('Satu entry backup terlalu besar.');
          await line(text);
        }
        if (Buffer.byteLength(pending) > 32 * 1024 * 1024) throw new BackupError('Satu entry backup terlalu besar.');
      }
      if (pending) await line(pending);
      if (!job || !ended) throw new BackupError('Backup tidak lengkap: manifest atau checksum akhir tidak ditemukan.');
      job.captured = count; job.captureComplete = true; job.status = 'completed'; job.phase = 'done';
      job.stores.forEach(s => { s.done = true; });
      await this.save(job);
      return { job: this.public(job), token };
    } catch (error: any) {
      if (job) {
        // Invalid imports never become usable backups. Remove only this newly-created job.
        const directory = path.resolve(this.dir(job.id));
        if (path.dirname(directory) !== path.resolve(this.root) || job.dataJobId !== job.id) throw new BackupError('Direktori import tidak valid.');
        this.jobs.delete(job.id); this.saves.delete(job.id);
        await fs.rm(directory, { recursive: true, force: true });
      }
      throw new BackupError(error instanceof BackupError ? error.message : 'File backup tidak valid atau gagal dibaca.');
    } finally { raw.destroy(); stream.destroy(); limit.destroy(); }
  }
}

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { BackupEngine } = require('../dist/backup/engine');
const { RobloxCloud } = require('../dist/backup/cloud');

const standard = { kind: 'standard', name: 'Player Data', scope: '*' };
const ordered = { kind: 'ordered', name: 'Top/Score', scope: 'season 1' };
const key = (u, kind, name, scope, id) => JSON.stringify([u, kind, name, scope, id]);
const reply = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function terminal(engine, handle, expected) {
  for (let i = 0; i < 1000; i++) {
    const job = await engine.status(handle.job.id, handle.token);
    if (!['queued', 'running'].includes(job.status)) {
      if (expected) assert.equal(job.status, expected, job.error);
      return job;
    }
    await sleep(5);
  }
  throw Error('Job did not settle');
}
async function fixture(t, count = 3, delay = 0) {
  const tempParent = path.resolve(process.env.BACKUP_TEST_TMP || os.tmpdir());
  const root = await fs.mkdtemp(path.join(tempParent, 'disperser-backup-test-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), tempParent);
    assert.ok(path.basename(root).startsWith('disperser-backup-test-'));
    await fs.rm(root, { recursive: true, force: true });
  });
  const data = new Map();
  const calls = [];
  let active = 0;
  let maxActive = 0;
  const control = { rejectSource: false, throttleOnce: false, networkAfterCreate: false, mismatchReadback: false, existingAs400: false };
  for (let i = 0; i < count; i++) data.set(key('1', 'standard', standard.name, i % 2 ? 'custom/scope' : 'global', 'user/' + i), { value: { coins: i, enabled: false }, users: ['users/123'], attributes: { version: 1 }, revisionId: 'r' + i });
  data.set(key('1', 'ordered', ordered.name, ordered.scope, 'user/0'), { value: 0 });
  data.set(key('1', 'ordered', ordered.name, ordered.scope, 'user/1'), { value: 99 });
  const fetcher = async (input, init = {}) => {
    const url = new URL(input);
    assert.equal(url.hostname, 'apis.roblox.com');
    calls.push({ url: String(url), method: init.method || 'GET' });
    active++; maxActive = Math.max(active, maxActive);
    try {
      if (delay) await sleep(delay);
      const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
      const u = url.pathname.startsWith('/datastores/') ? segments[3] : segments[3];
      if (control.rejectSource && u === '1') return reply({ message: 'permission denied' }, 403);
      if (control.throttleOnce) { control.throttleOnce = false; return reply({ message: 'slow down' }, 429, { 'retry-after': '0' }); }
      if (url.pathname.startsWith('/datastores/')) {
        assert.equal(url.searchParams.get('allScopes'), 'true');
        const keys = [...data.keys()].map(s => JSON.parse(s)).filter(x => x[0] === u && x[1] === 'standard' && x[2] === url.searchParams.get('datastoreName')).map(x => ({ scope: x[3], key: x[4] }));
        const cursor = Number(url.searchParams.get('cursor') || 0);
        return reply({ keys: keys.slice(cursor, cursor + 2), nextPageCursor: cursor + 2 < keys.length ? String(cursor + 2) : '' });
      }
      const kind = segments[4] === 'data-stores' ? 'standard' : 'ordered';
      if (segments.length === 5) {
        if (!url.searchParams.get('pageToken')) return reply({ dataStores: [{ id: standard.name }], nextPageToken: 'last' });
        return reply({ dataStores: [{ id: 'Other' }] });
      }
      const name = segments[5], scope = segments[7];
      if (segments.length === 9 && (!init.method || init.method === 'GET')) {
        const matches = [...data.keys()].map(s => JSON.parse(s)).filter(x => x[0] === u && x[1] === kind && x[2] === name && x[3] === scope);
        return reply({ [kind === 'standard' ? 'dataStoreEntries' : 'orderedDataStoreEntries']: matches.map(x => ({ id: x[4], ...(kind === 'ordered' ? { value: data.get(key(u, kind, name, scope, x[4])).value } : {}) })) });
      }
      const id = init.method === 'POST' ? url.searchParams.get('id') : segments[9];
      const identity = key(u, kind, name, scope, id);
      if (!init.method || init.method === 'GET') {
        const current = data.get(identity);
        if (!current) return reply({ message: 'not found' }, 404);
        if (control.mismatchReadback && u === '2') return reply({ value: 999 });
        return reply(current);
      }
      if (init.method === 'POST' && data.has(identity)) return control.existingAs400 ? reply({ message: 'Entry Already Exist' }, 400) : reply({ message: 'already exists' }, 409);
      if (init.method === 'PATCH') assert.equal(url.searchParams.get('allowMissing'), 'true');
      const body = JSON.parse(init.body);
      data.set(identity, body);
      if (control.networkAfterCreate && init.method === 'POST') { control.networkAfterCreate = false; throw new TypeError('network failed after commit'); }
      return reply(body);
    } finally { active--; }
  };
  const cloud = new RobloxCloud(fetcher, 0);
  const engine = new BackupEngine(root, cloud, 3);
  return { engine, root, data, calls, control, cloud, maxActive: () => maxActive };
}
const input = (overrides = {}) => ({ mode: 'migrate', sourceUniverseId: '1', targetUniverseId: '2', confirmedTarget: '2', sourceKey: 'SOURCE_SECRET', targetKey: 'TARGET_SECRET', stores: [standard, ordered], ...overrides });

test('migrates all pages, custom scopes, zero ordered values and standard metadata; stores no credentials', async t => {
  const f = await fixture(t, 5, 2);
  const handle = await f.engine.create(input());
  const job = await terminal(f.engine, handle, 'completed');
  assert.equal(job.captured, 7);
  assert.equal(job.written, 7);
  assert.equal(job.skipped, 0);
  assert.equal(f.data.get(key('2', 'ordered', ordered.name, ordered.scope, 'user/0')).value, 0);
  assert.deepEqual(f.data.get(key('2', 'standard', standard.name, 'custom/scope', 'user/1')), { value: { coins: 1, enabled: false }, users: ['users/123'], attributes: { version: 1 } });
  assert.ok(f.maxActive() <= 3);
  const state = await fs.readFile(path.join(f.root, handle.job.id, 'job.json'), 'utf8');
  assert.ok(!state.includes('SOURCE_SECRET') && !state.includes('TARGET_SECRET'));
  assert.ok(!JSON.stringify(job).includes('tokenHash'));
  assert.ok(!f.calls.some(c => c.method !== 'GET' && c.url.includes('/universes/1/')));
  assert.equal((await f.cloud.stores('1', 'key')).length, 2);
});

test('skip preserves conflicting destination data; overwrite skips identical records and changes the rest', async t => {
  const f = await fixture(t);
  const destination = key('2', 'standard', standard.name, 'global', 'user/0');
  f.data.set(destination, { value: { coins: 800 }, users: [], attributes: {} });
  const first = await f.engine.create(input());
  const skipped = await terminal(f.engine, first, 'completed');
  assert.equal(skipped.skipped, 1);
  assert.equal(f.data.get(destination).value.coins, 800);
  const second = await f.engine.create(input({ conflict: 'overwrite' }));
  const overwritten = await terminal(f.engine, second, 'completed');
  assert.equal(overwritten.written, 1);
  assert.equal(overwritten.unchanged, 4);
  assert.equal(f.data.get(destination).value.coins, 0);
});

test('Roblox 400 Entry Already Exist respects skip mode and keeps destination data', async t => {
  const f = await fixture(t, 1);
  f.control.existingAs400 = true;
  const destination = key('2', 'standard', standard.name, 'global', 'user/0');
  f.data.set(destination, { value: { coins: 800 }, users: [], attributes: {} });
  const handle = await f.engine.create(input());
  const job = await terminal(f.engine, handle, 'completed');
  assert.equal(job.skipped, 1);
  assert.equal(f.data.get(destination).value.coins, 800);
});
test('pause, reload and resume use checkpoints without rewriting completed keys', async t => {
  const f = await fixture(t, 22, 4);
  const handle = await f.engine.create(input());
  while ((await f.engine.status(handle.job.id, handle.token)).written < 2) await sleep(5);
  await f.engine.pause(handle.job.id, handle.token);
  const paused = await terminal(f.engine, handle, 'paused');
  const writesBefore = f.calls.filter(c => c.method === 'POST').length;
  const persistedPath = path.join(f.root, handle.job.id, 'job.json');
  const persisted = JSON.parse(await fs.readFile(persistedPath, 'utf8'));
  persisted.status = 'running';
  await fs.writeFile(persistedPath, JSON.stringify(persisted));
  const recovered = new BackupEngine(f.root, f.cloud, 3);
  assert.equal((await recovered.status(handle.job.id, handle.token)).status, 'paused');
  await recovered.resume(handle.job.id, handle.token, { sourceKey: 'key', targetKey: 'key' });
  const result = await terminal(recovered, handle, 'completed');
  assert.equal(result.written, 24);
  assert.equal(f.calls.filter(c => c.method === 'POST').length, writesBefore + 24 - paused.written);
});

test('backup export/import verifies checksum and restores without reading source universe', async t => {
  const f = await fixture(t, 4);
  const handle = await f.engine.create(input({ mode: 'backup' }));
  await terminal(f.engine, handle, 'completed');
  const download = await f.engine.download(handle.job.id, handle.token);
  const chunks = [];
  for await (const chunk of download.stream) chunks.push(chunk);
  const zipped = Buffer.concat(chunks);
  const file = path.join(f.root, 'backup.jsonl.gz');
  await fs.writeFile(file, zipped);
  const imported = await f.engine.importFile(file, true);
  assert.equal(imported.job.captured, 6);
  const before = f.calls.length;
  const restore = await f.engine.create(input({ mode: 'restore', sourceKey: undefined, backupJobId: imported.job.id, backupToken: imported.token }));
  await terminal(f.engine, restore, 'completed');
  assert.ok(f.calls.slice(before).every(c => !c.url.includes('/universes/1/')));
  const broken = zlib.gunzipSync(zipped).toString('utf8').replace('"coins":0', '"coins":900');
  const corruptFile = path.join(f.root, 'corrupt.jsonl');
  await fs.writeFile(corruptFile, broken);
  await assert.rejects(f.engine.importFile(corruptFile, false), /Checksum/);
  await fs.writeFile(corruptFile, broken.split('\n').slice(0, -2).join('\n'));
  await assert.rejects(f.engine.importFile(corruptFile, false), /tidak lengkap/);
});

test('bad source permissions fail visibly; resume succeeds with no lost entries', async t => {
  const f = await fixture(t);
  f.control.rejectSource = true;
  const handle = await f.engine.create(input());
  const failed = await terminal(f.engine, handle, 'failed');
  assert.match(failed.error, /403/);
  assert.equal(failed.captureComplete, false);
  await assert.rejects(f.engine.download(handle.job.id, handle.token), /belum lengkap/);
  f.control.rejectSource = false;
  await f.engine.resume(handle.job.id, handle.token, { sourceKey: 'key', targetKey: 'key' });
  assert.equal((await terminal(f.engine, handle, 'completed')).written, 5);
});

test('job capabilities protect status, pause, resume and download; validates destructive destinations', async t => {
  const f = await fixture(t);
  await assert.rejects(f.engine.create(input({ targetUniverseId: '1', confirmedTarget: '1' })), /harus berbeda/);
  await assert.rejects(f.engine.create(input({ confirmedTarget: 'wrong' })), /Ketik ulang/);
  await assert.rejects(f.engine.create(input({ stores: [{ ...ordered, scope: '*' }] })), /scope tertentu/);
  const handle = await f.engine.create(input({ mode: 'backup' }));
  await terminal(f.engine, handle, 'completed');
  const wrong = '0'.repeat(64);
  await assert.rejects(f.engine.status(handle.job.id, wrong), /token akses/);
  await assert.rejects(f.engine.pause(handle.job.id, wrong), /token akses/);
  await assert.rejects(f.engine.resume(handle.job.id, wrong, {}), /token akses/);
  await assert.rejects(f.engine.download(handle.job.id, wrong), /token akses/);
  await assert.rejects(f.engine.status('../escape', handle.token), /tidak ditemukan/);
});

test('429 retries respect recovery and uncertain creates are reconciled without duplicate writes', async t => {
  const f = await fixture(t, 1);
  f.control.throttleOnce = true;
  f.control.networkAfterCreate = true;
  const handle = await f.engine.create(input({ stores: [standard] }));
  const job = await terminal(f.engine, handle, 'completed');
  assert.ok(job.retries >= 2);
  assert.equal(job.unchanged, 1);
  assert.equal([...f.data.keys()].map(JSON.parse).filter(k => k[0] === '2').length, 1);
});

test('readback mismatch fails instead of reporting a successful restore', async t => {
  const f = await fixture(t, 1);
  f.control.mismatchReadback = true;
  const handle = await f.engine.create(input({ stores: [standard], verifyReadback: true }));
  const result = await terminal(f.engine, handle, 'failed');
  assert.match(result.error, /Verifikasi baca ulang/);
  assert.equal(result.written, 0);
});

test('overlapping universe jobs are rejected to avoid concurrent migration races', async t => {
  const f = await fixture(t, 10, 4);
  const handle = await f.engine.create(input());
  await assert.rejects(f.engine.create(input({ mode: 'backup' })), /sedang digunakan/);
  await terminal(f.engine, handle, 'completed');
});

test('empty stores complete and export as a valid zero-entry backup', async t => {
  const f = await fixture(t, 0);
  const handle = await f.engine.create(input({ mode: 'backup', stores: [{ kind: 'standard', name: 'Empty', scope: 'global' }] }));
  const job = await terminal(f.engine, handle, 'completed');
  assert.equal(job.captured, 0);
  const result = await f.engine.download(handle.job.id, handle.token);
  const chunks = [];
  for await (const chunk of result.stream) chunks.push(chunk);
  const file = path.join(f.root, 'empty.gz');
  await fs.writeFile(file, Buffer.concat(chunks));
  const imported = await f.engine.importFile(file, true);
  assert.equal(imported.job.captured, 0);
});

test('concurrent submissions cannot reserve the same source or destination twice', async t => {
  const f = await fixture(t, 10, 4);
  const submitted = await Promise.allSettled([f.engine.create(input()), f.engine.create(input())]);
  const accepted = submitted.filter(s => s.status === 'fulfilled');
  assert.equal(accepted.length, 1);
  assert.equal(submitted.filter(s => s.status === 'rejected').length, 1);
  await terminal(f.engine, accepted[0].value, 'completed');
});

test('HTTP endpoints create, protect, export and import a real streamed backup', async t => {
  const express = require('express');
  const { createBackupRouter } = require('../dist/backup/router');
  const f = await fixture(t, 2);
  const app = express();
  app.use(express.json());
  app.use('/api/backup', createBackupRouter(f.engine));
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port + '/api/backup';
  const start = await fetch(base + '/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input({ mode: 'backup' })) });
  assert.equal(start.status, 202);
  const handle = await start.json();
  await terminal(f.engine, handle, 'completed');
  assert.equal((await fetch(base + '/jobs/' + handle.job.id)).status, 404);
  const response = await fetch(base + '/jobs/' + handle.job.id + '/download', { headers: { Authorization: 'Bearer ' + handle.token } });
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-disposition'), /\.jsonl\.gz/);
  const body = new FormData();
  body.append('backup', new Blob([await response.arrayBuffer()]), 'backup.jsonl.gz');
  const importedResponse = await fetch(base + '/imports', { method: 'POST', body });
  assert.equal(importedResponse.status, 201);
  const imported = await importedResponse.json();
  assert.equal(imported.job.captureComplete, true);
  assert.equal(imported.job.captured, 4);
  const protectedResponse = await fetch(base + '/jobs/' + imported.job.id, { headers: { Authorization: 'Bearer ' + imported.token } });
  assert.equal(protectedResponse.headers.get('cache-control'), 'no-store');
});

test('one shared rate limiter spaces same-universe requests across concurrent clients', async () => {
  const seen = [];
  const cloud = new RobloxCloud(async () => { seen.push(Date.now()); return reply({}); }, 25);
  await Promise.all(Array.from({ length: 4 }, () => cloud.request('10', 'standard', 'read', 'key', '/test')));
  assert.equal(seen.length, 4);
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i] - seen[i - 1] >= 20, 'requests must remain spaced');
});

test('non-JSON transient server failures are retried rather than losing the job', async () => {
  let count = 0;
  const cloud = new RobloxCloud(async () => ++count === 1 ? new Response('temporary gateway error', { status: 502 }) : reply({ value: 12 }), 0);
  const result = await cloud.request('10', 'standard', 'read', 'key', '/test');
  assert.equal(result.value, 12);
  assert.equal(count, 2);
});

test('OrderedDataStore capture uses listed values without an extra read per key', async t => {
  const f = await fixture(t, 0);
  const handle = await f.engine.create(input({ mode: 'backup', stores: [ordered] }));
  const result = await terminal(f.engine, handle, 'completed');
  assert.equal(result.captured, 2);
  assert.equal(f.calls.filter(c => c.method === 'GET' && new URL(c.url).pathname.split('/').filter(Boolean).length === 10).length, 0);
});
test('non-finite tagged Luau numbers are rejected before a destination type can change', async t => {
  const f = await fixture(t, 1);
  f.data.set(key('1', 'standard', standard.name, 'global', 'user/0'), { value: { score: { m: null, t: 'numeric', v: 'inf' } } });
  const handle = await f.engine.create(input({ stores: [standard] }));
  const job = await terminal(f.engine, handle, 'failed');
  assert.match(job.error, /non-finite/);
  assert.equal(job.written, 0);
});
test('concurrent recovery requests share one loaded job and subsequent progress', async t => {
  const f = await fixture(t, 12, 4);
  const handle = await f.engine.create(input());
  await f.engine.pause(handle.job.id, handle.token);
  await terminal(f.engine, handle, 'paused');
  const restarted = new BackupEngine(f.root, f.cloud, 3);
  await Promise.all([restarted.status(handle.job.id, handle.token), restarted.status(handle.job.id, handle.token), restarted.resume(handle.job.id, handle.token, { sourceKey: 'key', targetKey: 'key' })]);
  assert.equal((await terminal(restarted, handle, 'completed')).written, 14);
});

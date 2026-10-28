import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';
import { BackupEngine } from './engine';
import { BackupError, storeSpecs, universeId } from './types';

export function createBackupRouter(engine = new BackupEngine()) {
  const router = express.Router();
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  const token = (req: Request) => /^Bearer ([a-f0-9]{64})$/.exec(req.header('authorization') || '')?.[1] || '';
  const wrap = (action: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => { action(req, res).catch(next); };
  const uploads = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, callback) => {
        const folder = path.join(engine.root, 'imports');
        fs.mkdir(folder, { recursive: true, mode: 0o700 }).then(() => callback(null, folder), error => callback(error, folder));
      },
      filename: (_req, _file, callback) => callback(null, crypto.randomUUID() + '.upload')
    }),
    limits: { fileSize: 256 * 1024 * 1024, files: 1, fields: 0 }
  });
  router.get('/stores/:universeId', wrap(async (req, res) => {
    const id = universeId(req.params.universeId);
    res.json({ stores: await engine.cloud.stores(id, req.header('x-api-key') || '') });
  }));
  router.post('/inspect', wrap(async (req, res) => {
    const id = universeId(req.body.universeId);
    const stores = storeSpecs(req.body.stores);
    if (stores.length > 10) throw new BackupError('Uji akses maksimal 10 kombinasi store/scope sekaligus.');
    const result = [];
    for (const store of stores) {
      const page = await engine.cloud.list(id, req.body.sourceKey, store, '', () => {}, () => {});
      if (page.entries.length) {
        const first = page.entries[0];
        await engine.cloud.capture(id, req.body.sourceKey, { ...store, scope: first.scope }, first.key, () => {}, () => {});
      }
      result.push({ ...store, firstPageEntries: page.entries.length, hasMore: !!page.nextCursor });
    }
    res.json({ stores: result });
  }));
  router.post('/jobs', wrap(async (req, res) => { res.status(202).json(await engine.create(req.body)); }));
  router.get('/jobs/:id', wrap(async (req, res) => { res.json({ job: await engine.status(String(req.params.id), token(req)) }); }));
  router.delete('/jobs/:id', wrap(async (req, res) => { await engine.delete(String(req.params.id), token(req)); res.json({ deleted: true }); }));
  router.post('/jobs/:id/pause', wrap(async (req, res) => { res.json({ job: await engine.pause(String(req.params.id), token(req)) }); }));
  router.post('/jobs/:id/resume', wrap(async (req, res) => { res.status(202).json({ job: await engine.resume(String(req.params.id), token(req), req.body) }); }));
  router.get('/jobs/:id/download', wrap(async (req, res) => {
    const download = await engine.download(String(req.params.id), token(req));
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', 'attachment; filename="' + download.filename + '"');
    await pipeline(download.stream, res);
  }));
  router.post('/imports', uploads.single('backup'), wrap(async (req, res) => {
    if (!req.file) throw new BackupError('Pilih file backup .jsonl atau .jsonl.gz.');
    try {
      const handle = await fs.open(req.file.path, 'r');
      const magic = Buffer.alloc(2);
      try { await handle.read(magic, 0, 2, 0); } finally { await handle.close(); }
      res.status(201).json(await engine.importFile(req.file.path, magic[0] === 0x1f && magic[1] === 0x8b));
    } finally { await fs.unlink(req.file.path).catch(() => {}); }
  }));
  router.use((error: any, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(error);
    if (error instanceof multer.MulterError) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Ukuran upload maksimal 256 MB.' : 'Upload backup tidak valid.' });
    res.status(error instanceof BackupError ? error.status : 500).json({ error: error instanceof BackupError ? error.message : 'Proses backup gagal. Periksa penyimpanan backend dan coba lagi.' });
  });
  return router;
}

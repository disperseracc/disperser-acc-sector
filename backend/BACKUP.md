# Backup Server

The Backup Server page now supports manual backups, cross-universe migration, and restoration of Standard DataStores and OrderedDataStores. The existing group/user experience browser can select the source; a Universe ID can also be entered directly for private or suspended experiences.

## Deployment

- Deploy the updated frontend and the existing Node backend. The frontend uses VITE_API_URL to reach /api/backup.
- Use Node 20+ and a long-running backend process. These jobs are not Vercel background functions.
- Mount persistent storage and set BACKUP_DATA_DIR to that mount, for example /data/disperser-backups. Without it, the default is backend/.backup-data; ephemeral redeployments can lose backups/checkpoints.
- Run one backend process/replica for the backup directory. Universe reservations and request budgets are coordinated in that process; this implementation does not provide distributed locking across replicas.
- Keep the backup directory private and outside any static/public web directory.
- Backups are retained on disk. Monitor disk capacity and export archives for independent storage; there is no automatic retention deletion.
- The new implementation does not add dependencies or require a database migration.

## API permissions

Source Standard DataStores require:
- universe-datastores.control:list (automatic store discovery)
- universe-datastores.objects:list
- universe-datastores.objects:read

Destination Standard DataStores require:
- universe-datastores.objects:create
- universe-datastores.objects:update (overwrite mode)
- universe-datastores.objects:read (conflict reconciliation, unchanged comparison, and optional read-back verification)

Ordered DataStores require:
- universe.ordered-data-store.scope.entry:read on the source
- universe.ordered-data-store.scope.entry:write on the destination
- universe.ordered-data-store.scope.entry:read on the destination for conflict reconciliation/comparison/read-back

Grant the keys access to the correct source and destination universes. Separate source and destination keys are supported. An accessible Studio project does not prove Open Cloud access: use "Uji akses sumber" to test the selected stores.

References:
- https://create.roblox.com/docs/cloud/guides/data-stores
- https://create.roblox.com/docs/cloud/reference/features/storage
- https://create.roblox.com/docs/cloud-services/data-stores/error-codes-and-limits

## Workflow

1. Select Backup or Migrasi A → B and enter a source Universe ID/API key.
2. Load Standard DataStores. The default * scope enumerates all Standard scopes using the v1 allScopes listing; entry values are read with Open Cloud v2. A specific scope such as global can be entered instead. If the enumeration response lacks scope identities, the job fails explicitly rather than guessing.
3. Add each OrderedDataStore name and scope manually. Roblox does not expose an API to discover all OrderedDataStore names/scopes.
4. Optionally test sample source reads. This is a permission/sample check, not an exhaustive snapshot check.
5. For migration/restore, choose the destination key, conflict policy, and type the destination Universe ID to confirm writing.
6. Download a completed capture as a compressed .jsonl.gz archive. Restore accepts an existing complete backup or an uploaded Disperser archive.
7. Pause drains in-flight work and preserves checkpoints. After a backend restart, interrupted work becomes paused; enter API keys again to resume.

## Correctness and performance

- Up to six independent entries are processed in parallel; migration pipelines capture and destination writes. OrderedDataStore values already included in listing responses are captured directly, avoiding one extra read per entry.
- The process shares paced request budgets across jobs by universe, store type, and operation (240 requests/minute/budget). HTTP 429/5xx/network errors retry with backoff and Retry-After support.
- At most two independent jobs can run. Overlapping source/destination universes are rejected while occupied to avoid conflicting migrations.
- Entry payloads and receipts are written atomically to disk. A saved pending page and per-key receipts let interrupted work resume. An uncertain create is reconciled after a conflict.
- Default conflict mode preserves existing destination values. Overwrite mode can compare values/metadata and avoid unchanged writes. This still scans/reads the source; it is not a change-feed or automatic standby sync.
- Every write response is compared with the expected value/metadata. Optional read-back verification adds a separate destination GET.
- The latest active values, keys, scopes, user associations, and attributes are copied. Original timestamps, revision IDs, full revision histories, deleted keys, place assets, badges, and game passes are not recreated in the destination.
- Frameworks such as ProfileService/ProfileStore may persist session locks inside profile values. Shut down source sessions and follow the framework's recovery behavior; this tool does not edit or strip game-specific profile fields.
- Backups are rolling reads, not an atomic universe snapshot. Stop source writes for a consistent final cutover, and stop destination game writes while overwriting/restoring. Destination-only keys are preserved; this is not a destructive mirror.
- OrderedDataStore values outside JavaScript's safe integer range and tagged non-finite Luau numbers are rejected instead of silently changing their value/type.
- A key deleted while being read is counted separately and is not written to the destination.
- Archives contain a versioned manifest, records, and an SHA-256 footer. Truncated/tampered/inconsistent archives and duplicate key identities are rejected. Upload limit: 256 MB; expanded limit: 512 MB.
- API keys stay in process memory while a job runs and are not written to backup files, job metadata, or status responses. Per-job capability tokens protect polling, pause, resume, and downloads. Browser history stores these capabilities for the current app user; clearing it loses that browser's job links. Keep downloaded archives.
- Capture totals are unknown during enumeration; progress does not claim a precise total until available. Restore estimates use observed throughput and are not duration guarantees.
- Automatic recurring backups/standby synchronization are not enabled by this implementation. Repeat a manual migration with overwrite + unchanged comparison when desired.

## Validation

Run from backend:

    npm run test:backup

This compiles the backend and exercises mocked Roblox APIs plus real local HTTP export/import. It covers scope/metadata preservation, pagination, integer zero values, skip/overwrite, duplicate-write recovery, pause/restart/resume, invalid permissions, checksums/truncation, token access, concurrent reservations, rate pacing, and transient failures.

No tests write to a live Roblox universe. Live validation should start with a small non-production source and destination that the operator explicitly selects.

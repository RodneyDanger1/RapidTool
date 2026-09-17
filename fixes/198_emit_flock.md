# 198 — emit flock + write-set rollback (parent wire of 196)

`emitProject` now:

1. O_EXCL `.rapidtool-emit.lock` — concurrent emit → `RT_E_BUSY`
2. `snapshotPaths` of intended files, `applyWrite` per scaffold file
3. On throw: `rollback` then `{ ok:false, code: RT_E_INTERNAL }`
4. `finally` always drops the lock

Ghost wipe still happens only after all writes succeed. Successful emit leaves no lock file.

Library: `src/lib/write-set.ts` (G2/196). This is the parent emit consumer.

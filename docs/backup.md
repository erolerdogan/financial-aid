# Backup, restore and transaction export

`src/services/backupService.ts` + `src/components/modals/BackupRestoreModal.tsx`, opened from Settings (and from the For You backup reminder through `InboxHost`).

## Backup

- The backup is the whole SQLite file via `serializeAsync`. WAL header bytes 18 / 19 are normalised to 1, otherwise `deserializeDatabaseAsync` cannot read it.
- Saved through `saveFile` in `src/services/fileSaver.ts`: RN `Share` on iOS, a directory picker on Android. No `expo-sharing` here.
- `app_meta` holds the last backup date and the backup password switch.

## Restore

- Restore validates an in-memory copy, writes `pre-restore.db` to the document directory (used by "Undo Last Restore"), then calls `replaceDatabaseContents` (`backupDatabaseAsync` + `initDatabase`) and `reloadAfterRestore` in ProfileContext.
- Backups with `user_version > CLASSIFIER_VERSION` are refused.
- A restore replaces `app_meta` as well. ("Reset" does not: `app_meta` survives it.)

## Encrypted backups

- The password is optional: the switch in the sheet's `setPassword` step. The last choice is kept in `app_meta` `backupEncrypt` (`'0'` = off).
- With a password, `exportBackup(db, password)` writes `.fabackup`: the header from `src/utils/backupFormat.ts` followed by AES-256-GCM ciphertext + tag.
- Header: magic `FAIDBKP1`, version, scrypt `logN` / `r` / `p`, salt, nonce. 41 bytes, passed as GCM additional data.
- AES comes from `expo-crypto`, which is native: it needs a native build.
- The key comes from `deriveKey` (`scryptAsync` from `@noble/hashes` v1). v2 is ESM-only and does not resolve under this tsconfig, so stay on v1. The cost is `DEFAULT_KDF` and is read back from the file on restore.
- `pickBackup` returns a `LockedBackup` for such a file; `unlockBackup` decrypts it into the usual `openBackup` checks.
- A failed tag is `WRONG_PASSWORD`: a wrong password and a damaged file look the same.
- Plain `.db` backups still restore. `pre-restore.db` is never encrypted.
- The sheet is one `Modal` with a `step` (`menu | setPassword | enterPassword`).
- Tests: `npx tsx src/utils/backupFormat.test.ts` (Node's AES stands in for `expo-crypto`).

## Transaction export

- "Export Transactions" row in the same sheet → `exportTransactions` in `src/services/exportService.ts`: all transactions of the active profile, as CSV with BOM via `papaparse` or Excel via `xlsx`. Never encrypted.
- Rows come from `buildExportRows` in `src/utils/exportRows.ts`: oldest first, translated headers and category names passed in as `labels`, and text cells that start like a formula get a leading `'`.
- Saved through the same `saveFile` as the backup.
- Tests: `npx tsx src/utils/exportRows.test.ts`.

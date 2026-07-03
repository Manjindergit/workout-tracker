# Database Schema — rules and rationale

Seven tables in `src/db/migrations/001_initial.ts`; seed library in `002_seed.ts`. Read this before touching anything under `src/db/`.

## Hard rules

1. **`sessions.finished_at IS NULL` is the crash-recovery sentinel.** The session row and its `session_muscle_groups` are written at workout start, `session_exercises` + draft sets when exercises are confirmed, so a process kill at any point leaves a resumable session. Launch flow calls `sessionRepo.closeStaleActiveSession()`: fresh active → resume banner; stale (>12h since last completed set) → auto-finished at its last activity, or deleted if zero sets were completed.
2. **`session_muscle_groups` is an immutable "planned groups" snapshot.** Written once by `startSession`, never updated. Anything user-facing after the workout (History chips, export, stats) must derive groups via `session_exercises JOIN exercises JOIN muscle_groups` — the planned snapshot goes stale the moment an unplanned exercise is added mid-workout, and that's fine: it records intent, not outcome.
3. **UI order comes from `position` columns only** (on `session_exercises` and `sets`). Never sort UI rows by timestamps — completion order ≠ display order, and `updated_at` churns on every edit.
4. **Sets are drafts until checked off.** Rows are inserted with `completed = 0` (prefilled from the exercise's last finished session), keystrokes flush via debounced UPDATE, check-off is `UPDATE completed = 1, completed_at = now`. All set mutations are UPDATEs keyed by UUID — idempotent, race-free. `finishSession` deletes surviving drafts, so finished sessions contain only completed sets; every stats/export query still filters `completed = 1` defensively (active sessions).
5. **Reference data is soft-deleted, never hard-deleted.** `exercises`/`muscle_groups` have `deleted_at`; pickers filter it, History/Progress/export ignore it (names keep resolving). RESTRICT FKs make a hard DELETE fail while referenced. `deleted_at` doubles as the future sync tombstone. The unique name indexes are partial (`WHERE deleted_at IS NULL`), so a deleted name can be re-created.
6. **Seed UUIDs are canonical and hardcoded** (`00000000-0000-4000-8000-0000000000NN` groups, `...-0000000001NN` exercises), identical on every install, inserted with `INSERT OR IGNORE`. This is what lets future sync identify seed rows across devices. Never regenerate or reuse them. Seeds have `is_custom = 0`.
7. **Timestamps are TEXT ISO-8601 UTC with milliseconds** (`2026-07-03T14:32:11.512Z`) — lexicographically sortable. Convert to local dates only at display/export (`src/utils/dates.ts`).
8. **SQLite arithmetic: write `/30.0`, not `/30`.** `reps / 30` is integer division and silently zeroes the Epley bonus term. The canonical e1RM lives in `statsRepo.e1rmSeries` and must stay in sync with `src/utils/oneRepMax.ts`.
9. **Bodyweight exercises (`is_bodyweight = 1`) chart reps, not e1RM** (`statsRepo.repsSeries`). Their `weight_kg` means *added* weight; exports render `BW×8` / `BW+10kg×6`.
10. **Migrations are append-only**, each runs in one transaction including its `PRAGMA user_version` bump. `PRAGMA foreign_keys = ON` and `journal_mode = WAL` are set per-connection in `client.ts` (expo-sqlite enables neither).

## Delete semantics

| Relation | On delete |
|---|---|
| sessions → session_muscle_groups / session_exercises | CASCADE |
| session_exercises → sets | CASCADE |
| muscle_groups → exercises, exercises → session_exercises, muscle_groups → session_muscle_groups | RESTRICT (soft-delete instead) |

## Testing

Repositories depend on the `DbExecutor` interface (`src/db/executor.ts`) — expo-sqlite on device (`client.ts`), better-sqlite3 in Jest (`testDb.ts`). The crash-recovery kill matrix lives in `sessionRepo.test.ts`; extend it whenever the active-session write path changes.

# Workout Tracker

Offline-only Android workout logger built with React Native / Expo (SDK 57). No backend, no auth — all data in SQLite on device. Single-user today; UUID + timestamp conventions keep future multi-user sync additive.

## Tech Stack

- Expo SDK 57 (React Native 0.86, React 19.2), TypeScript strict
- expo-router — file-based navigation, routes live in `src/app/`
- expo-sqlite — **async API only** (`SQLiteProvider` + `onInit` migrations, `getAllAsync`/`runAsync`/`withTransactionAsync`); the legacy `db.transaction()` WebSQL API no longer exists
- Zustand 5 — in-memory mirror of the active workout (SQLite is the single source of truth; no persist middleware)
- victory-native **v41+ (Victory Native XL)** — `CartesianChart` API only; the legacy `VictoryChart`/`VictoryLine` API found in most tutorials is a different, incompatible library — never use it
- Jest (jest-expo) + React Native Testing Library; repositories tested against better-sqlite3 in Node
- ESLint (eslint-config-expo flat) + Prettier

## Commands

| Task | Command |
|---|---|
| Install deps | `npm install` (SDK-adjacent packages via `npx expo install <pkg>`) |
| Dev loop | `npx expo run:android` (development build; Expo Go is not supported) |
| Metro only | `npx expo start` |
| Tests | `npm test` |
| Single test file | `npm test -- src/db/repositories/sessionRepo.test.ts` |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` |
| Sideload APK | `npx expo prebuild -p android` + `cd android && gradlew app:assembleRelease` |

Run typecheck + lint + tests before considering any change done.

## Folder Structure

```
src/app/              # expo-router routes
  (tabs)/             # Home (index), history, progress, settings
  workout/            # new (exercise picker), log (active session) — root-level, tab bar hidden
  session/[id].tsx    # shared session detail (post-finish + from History)
  exercise/[id].tsx   # per-exercise progress chart
  export.tsx          # export modal
src/db/               # SQLite client, append-only migrations, repositories — the ONLY data-access layer
src/stores/           # Zustand stores (activeWorkout)
src/components/       # Reusable UI components (props-driven)
src/hooks/            # Shared hooks
src/utils/            # Pure helpers (oneRepMax, dates, units, export serializers)
src/types/            # Shared domain types
assets/               # Fonts, images, icons
agent_docs/           # Deep reference docs (db-schema.md, sync design) — read when relevant
.claude/              # Claude Code config & skills
```

## Conventions

- TypeScript strict; no `any`, no `@ts-ignore` without a comment explaining why.
- Functional components + hooks only.
- Screens stay thin: layout + hook calls. Logic in hooks/stores; persistence in repositories.
- **All persistence goes through `src/db/` repositories** — components/hooks never touch SQLite directly. Repositories take a `DbExecutor` so tests run them against better-sqlite3.
- **SQLite is the single source of truth.** The active workout writes draft set rows (`completed = 0`) eagerly; Zustand only mirrors for fast keystrokes (debounced ~400ms flush). Never persist Zustand itself.
- Every domain record: `id` (UUID via expo-crypto), `created_at`, `updated_at` — TEXT ISO-8601 UTC with milliseconds.
- Weights stored in kg, converted to display units only at render. SQLite division: use `/30.0` style literals — `/30` is integer division.
- UI ordering always comes from `position` columns, never timestamps.
- `session_muscle_groups` is an immutable "planned groups" snapshot; post-workout display derives groups from `session_exercises JOIN exercises` (see `agent_docs/db-schema.md`).
- Schema changes = a new migration in `src/db/`. Never edit a shipped migration.
- Naming: PascalCase components, camelCase functions/vars, kebab-case route files, snake_case SQL.
- Tests colocated as `*.test.ts(x)` next to the code they cover.

## Off-Limits

- Never read or edit `.env*`, `secrets/`, or signing material (`*.jks`, `*.p8`, `*.p12`, `*.mobileprovision`, `*.pem`, `*.key`).
- Never hand-edit `android/` or `ios/` — they are generated (CNG) and gitignored; configure via `app.json` and config plugins.
- Never edit `package-lock.json` by hand; change dependencies via `npm install` / `npx expo install`.
- Never modify an already-committed migration — add a new one.
- Flag any new native module that needs a config plugin or prebuild change before adding it.
- Never use the legacy Victory (`VictoryChart`) or legacy expo-sqlite (`db.transaction()`) APIs — they don't exist in the installed versions.

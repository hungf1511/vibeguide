# src/index/

SQLite-backed incremental index for VibeGuide.

## Layout

- `store.ts` — IndexStore wrapper (open, migrate, prepared statements, transactions).
- `schema.sql` — Initial schema reference.
- `migrations/` — Sequential SQL migrations applied by version.
- `builder.ts` — IndexBuilder full + incremental rebuild.
- `queries/` — Queries abstraction (in-memory vs sqlite).

## Lifecycle

1. `getQueries(repo)` factory checks signature freshness.
2. If match → SqliteQueries (fast).
3. If mismatch + `VIBEGUIDE_AUTO_INDEX=1` → await incremental rebuild.
4. Else → InMemoryQueries fallback.

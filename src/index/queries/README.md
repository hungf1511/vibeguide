# src/index/queries/

Queries abstraction over data sources.

## Files

- `types.ts` — Queries interface (graph, dependents, dependencies).
- `inMemory.ts` — InMemoryQueries: scans repo at query time.
- `sqlite.ts` — SqliteQueries: reads from pre-built SQLite index.
- `factory.ts` — getQueries() auto-detect by signature freshness.

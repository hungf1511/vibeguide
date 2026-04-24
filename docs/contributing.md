# Contributing to VibeGuide

## Setup

```bash
git clone <repo>
cd vibeguide
npm install
```

## Dev Loop

```bash
# Type-check and build
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run benchmark
npm run bench

# Self-check (dogfood)
npm run check
```

## Adding a New Tool

1. Implement handler in `src/mcp/handlers/<group>.ts`
2. Export from `src/mcp/handlers/index.ts`
3. Add Zod schema in `src/mcp/toolSchemas.ts`
4. Add description in `src/mcp/toolDescriptions.ts`
5. Register handler in `src/mcp/tools.ts`
6. Add unit test in `tests/`

## Code Style

- TypeScript strict mode
- No `any` unless unavoidable
- Use `pathGuard.resolveSafe` for all file system paths
- Vietnamese + English bilingual output for human-facing strings

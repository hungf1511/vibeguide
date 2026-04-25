# JavaScript Analyzer

Parses JavaScript and TypeScript-style import forms while preserving the legacy regex parser behavior:

- static `import ... from`
- side-effect imports
- dynamic `import(...)`
- CommonJS `require(...)`
- re-exports

`treeSitterAnalyzer.ts` is the default implementation for `.js`, `.jsx`, `.mjs`, `.cjs`, `.ts`, and `.tsx`. `staticAnalyzer.ts` remains as rollback fallback, and `legacyAnalyzer.ts` remains as a compatibility re-export for old imports and one-minor rollback mode.

This analyzer is intentionally lightweight so MCP cold start stays fast.

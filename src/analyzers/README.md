# Analyzers

Analyzer layer for building dependency graphs from source files.

Each analyzer implements `spi.ts` and exposes:

- `detect` to match file extensions.
- `parseImports` to return language-native import references.
- `parseExports` for future dead-code and symbol analysis.

The registry dispatches by extension. The default backend is `tree-sitter`; JavaScript, TypeScript, Python, Go, and Rust use WASM tree-sitter analyzers. Static analyzers remain available for rollback compatibility through `parser.backend: "static"`, while `parser.legacyParser` or `VIBEGUIDE_LEGACY_PARSER=1` keeps the old JS/TS-only behavior for one-minor rollback.

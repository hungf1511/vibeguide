# Rust Analyzer

Parses Rust local module declarations and local `use` paths.

Supported dependency patterns include `mod foo;`, `pub mod foo;`, `crate::...`, `self::...`, and `super::...` paths. External crates are ignored for the repo dependency graph.

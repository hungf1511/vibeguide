# Python Analyzer

Parses Python `import` and `from ... import ...` statements for dependency graph construction.

The default backend is `pythonTreeSitterAnalyzer`, powered by `web-tree-sitter` and VS Code's prebuilt `tree-sitter-python.wasm`. `staticPythonAnalyzer` remains available as a rollback/static fallback.

Supported project-local patterns include absolute module imports, package module paths, and relative imports such as `from .auth import login` or `from ..db import session`.

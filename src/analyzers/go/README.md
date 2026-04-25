# Go Analyzer

Parses Go single-line imports and import blocks.

Resolution uses `go.mod` module names to map project-local imports such as `github.com/acme/app/internal/api` back to repo-relative `.go` files.

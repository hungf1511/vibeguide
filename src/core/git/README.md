# src/core/git/

Native git wrappers using simple-git. No shelling out beyond the library.

## Files

- **runGit.ts** -- Low-level command runner.
- **lsFiles.ts** -- git ls-files -co --exclude-standard for source enumeration.
- **head.ts** -- HEAD SHA + branch.
- **status.ts** -- Working tree status.
- **log.ts** -- Commit log with date/scope filters.
- **diff.ts** -- Diff entries + stat.
- **blame.ts** -- Line-level authorship.
- **index.ts** -- Barrel export.

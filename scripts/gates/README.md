# Code-quality gates (ootk)

Lineage: copied from keeptrack-space `scripts/gates` at keeptrack-space commit 855850e2f (+ uncommitted gate work), 2026-11-25. Adapted: scope is `src/`
minus `src/external` and test files; base is the merge-base with `develop` (`origin/develop`); coverage is `coverage/lcov.info` only; the TypeScript
compiler API is the repo's own `typescript` (5.9); no plugins-pro submodule handling; `test-lint` does not scan generators. The approach comes from
unclebob/crapper and unclebob/dryer, reimplemented in TS (no code copied from those projects).

Usage, gate definitions and thresholds are the same as in keeptrack-space (CRAP >= 10, DRY Jaccard >= 0.8, deps rules, test-lint). Changed code must
pass; unchanged code only warns. Nothing is wired into husky or CI.

```
pnpm exec vitest run --coverage --coverage.reporter=lcov --coverage.reportOnFailure   # produces coverage/lcov.info
pnpm exec tsx scripts/gates/run.ts                  # four gates, changed code only
pnpm exec tsx scripts/gates/run.ts crap dry --all   # baseline, exit 0
pnpm exec vitest run scripts/gates                  # gate unit tests
```

Output: tables on stdout, `.metrics/<gate>.json` (gitignored).

`deps-rules.json`: three starting rules, all `confirmed: false` (violations warn only). `astronomy-engine` is a devDependency but is bundled by tsup
(`noExternal`), so it is not in the dev-package rule.

TODO: mutation gates (2 and 3). Copy `mutate.ts`, `mutate.vitest.config.ts`, `lib/mutants.ts`, `lib/testmap.ts`, `lib/mutants.test.ts` from keeptrack-space
`scripts/gates` once it is finished, restore the `mutate` branch in `run.ts`, and adapt the testmap skip prefixes and vitest config.

## Property tests

`src/**/__tests__/*.property.test.ts` use fast-check. A property known to fail is kept as `it.fails` with the counterexample in a comment.

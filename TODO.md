# TODO

## 2.7 performance pass

- [x] Add phase timing metrics to the run report.
- [x] Add a repeatable large-site benchmark for render, write, verify and audit phases.
- [x] Reuse a single parsed document for final output processing.
- [x] Add an early exit for preload injection when there are no hints.
- [x] Collapse render page evaluations into fewer browser round trips.
- [x] Collapse verification page evaluations into one browser round trip.
- [x] Replace quadratic verification/report lookups with maps.
- [x] Parallelize audit link existence checks while preserving finding order.
- [x] Parallelize route output writes with ordered merging.
- [x] Cache inline stylesheet text across routes.
- [x] Reuse or cache critical CSS processing where safe.
- [x] Parallelize destination copies and skip unchanged files.
- [x] Overlap independent startup work.
- [x] Parallelize sitemap-index child fetches.
- [x] Remove dead normalization metrics and deduplicate collected links.
- [x] Benchmark verification context reuse and decide whether to expose it.
- [x] Run lint, unit, integration and testcase acceptance; compare output and timings.

Verified: lint clean; 313 unit tests; 142 integration tests; static benchmarks improved
(200 routes 106.6s -> 90.5s; 50 routes with verification 51.3s -> 45.9s).
The expanded 200-route testcase is covered separately: it exposes testcase-side
hydration/lazy-route issues, a stale testcase config, lab gate limitations, missing
canonicals and duplicate metadata. See the validation report.

## Later

- [ ] Add a per-route hydration ignore list so known false positives can be suppressed for specific routes without disabling verification globally.

No outstanding non-critical test gaps.

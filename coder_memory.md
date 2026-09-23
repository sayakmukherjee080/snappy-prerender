# coder_memory.md

Persistent record of ad-hoc decisions and verbal rules for this project. Append-only: never edit or delete a past entry; supersede with a new dated entry instead. Categories: naming, dependency, infra, style, security-exception, architecture, process, other.

This file is committed to the public repository — never record secrets, tokens, credentials, or private URLs here.

[2026-09-23] [architecture] Pure JavaScript only — no TypeScript in project source. — user decision, stated explicitly.
[2026-09-23] [architecture] Browser-renderer path first (Playwright-based DOM capture, react-snap approach); SSR renderer deferred to phase two. — rationale: closest approach to react-snap, drop-in for existing SPAs.
[2026-09-23] [architecture] Single npm package with subpath exports (vite plugin, cli, core); browser driver as optional peer dependency.
[2026-09-23] [architecture] Framework-agnostic core that prerenders any static dist directory; Vite plugin is a thin wrapper over core.
[2026-09-23] [dependency] Browser resolution order: use installed Chrome/Edge first, download Chromium fallback only when neither found.
[2026-09-23] [other] No code reused from react-snap; reference copy at reference/react-snap-master is for study only.
[2026-09-23] [naming] npm package name is snappy-prerender — react-snappy taken by abandoned 2016 html-snapshot testing utility.
[2026-09-23] [naming] GitHub repo renamed from React-Snappy to snappy-prerender to match npm package.
[2026-09-23] [other] MIT LICENSE copyright holder: sayakmukherjee080 (GitHub handle).

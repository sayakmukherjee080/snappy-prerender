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
[2026-09-23] [naming] Prerender user agent is "SnappyPrerender" so app code can branch on it, mirroring react-snap's "ReactSnap". — user decision, stated explicitly.
[2026-09-23] [architecture] v2 implements react-snap feature parity: inlineCss, minifyHtml, minifyCss, preconnectThirdParty, preloadImages, cacheAjaxRequests with snapSaveState, removeBlobs, removeStyleTags, removeScriptTags, asyncScriptTags, destination, saveAs, browserArgs, ignoreHTTPSErrors.
[2026-09-23] [naming] react-snap's http2PushManifest is named preloadManifest here — browsers removed HTTP/2 push (Chrome v106), so the artifact is a Link header list for Early Hints instead.
[2026-09-23] [dependency] Critical CSS delegates to beasties as an optional peer dependency (>=0.4.1), never a hard dependency — most projects never enable it.
[2026-09-23] [other] react-snap's sourceMaps option is deliberately not implemented — it is declared in its defaults but never referenced in its source.
[2026-09-23] [naming] react-snap's fixInsertRule is named captureRuntimeStyles here and additionally serialises document.adoptedStyleSheets; default stays true like react-snap's.
[2026-09-23] [naming] react-snap's fixFormFields is named captureFormState here; unlike react-snap (always on) it is configurable, defaulting to true.
[2026-09-23] [architecture] Third-party requests are allowed by default (blockThirdParty: false) — CMS and API-driven React sites are the common case, and blocking them renders pages without data; blocking is opt-in with allowedHosts for exceptions. — user decision, stated explicitly after testing against the PPS app.
[2026-09-23] [architecture] Preconnect hints are generated for every third-party origin a page contacts, including hosts allowlisted while blocking. — user decision, stated explicitly.
[2026-09-23] [architecture] SEO is the primary product: crawler-visible static HTML with titles and meta tags. Hydration verification is a report, not a gate — hydration failures are logged by default and only fail the build with failOnHydrationError. — user decision, stated explicitly.
[2026-09-23] [architecture] The package ships its own head and metadata layer (snappy-prerender/head) rather than depending on react-helmet: runtime reconciliation so client-side navigation updates the head, plus a metadata config the prerenderer injects for public URLs. — user decision: "build the functionality of helmet and og tag defining onto our plugin".
[2026-09-25] [architecture] Head tags the app itself wrote are restored to the original values recorded during prerendering when no Head wants them any more; only tags the head layer generated are removed. — user decision during audit remediation.
[2026-09-25] [architecture] Page errors thrown while rendering are reported, not enforced; the opt-in gate is failOnPageError (default false). — user decision during audit remediation.
[2026-09-25] [other] More than one <title> in the output, which React 19 native metadata plus the head layer produces, is warned about and documented, never auto-reduced; the app picks one metadata system. — user decision during audit remediation.
[2026-09-25] [process] Audit remediation landed as code only: no version bump, CI change, or release tag until the user asks. — user decision during audit remediation.

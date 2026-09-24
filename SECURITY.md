# Security policy

## Supported versions

Only the latest published `0.x` release receives fixes. Pre-1.0 releases are supported on a best-effort basis.

## Reporting a vulnerability

Report privately through GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) on this repository. Do not open a public issue for a security problem.

Include the version, a minimal reproduction, and the impact you believe it has. You will get an acknowledgement, and a fix or an explanation of why the report is out of scope.

## What is in scope

- Output directory escape or arbitrary file write through a crafted route or link
- Injection into generated HTML through captured state, stylesheet content, or route data
- Command execution beyond the explicit `serveCmd` option
- Leakage of `storageState` contents, cookies, or page data into logs or output
- Supply chain issues in published dependencies

## What is out of scope

- The prerenderer executing your app's own client code by design. Prerendering runs your bundle in a real browser; treat it with the same trust as running your app.
- Project configuration executing as code. `snappy.config.js` is imported as a module and `serveCmd` runs a shell command, exactly like `vite.config.js` and npm scripts. Both are trusted input.
- Anything reachable on the loopback build server. During a run it serves the output directory — including any API responses captured into generated HTML — on an ephemeral `127.0.0.1` port, so a local process can read it.
- Third-party scripts your app loads. They are allowed by default so CMS-backed apps render with data; set `blockThirdParty: true` (optionally with `allowedHosts`) to stop them executing during a build.
- Integrity of the optional Chrome for Testing download beyond HTTPS, unless `browserDownloadHash` is set. The archive is fetched over TLS from Google's version-pinned bucket, and Chrome for Testing publishes no checksum feed to verify against. Set `browserDownload: false` if that trust model is not acceptable in your environment.

## Hardening available today

- `blockThirdParty: true` with `allowedHosts` to keep only the origins the build actually needs, so analytics and widgets never run during a build.
- `browserDownload: false` (or `browserDownloadHash`) to control the fallback browser download.
- `blockThirdParty: true` by default, so third-party scripts do not execute during rendering; `allowedHosts` narrows it further rather than disabling it.
- `storageState` files are read but never logged or written into the output; keep them out of the repository.
- Generated HTML escapes captured state keys and values against script breakout.

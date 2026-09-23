# Security policy

## Supported versions

Only the latest published `0.x` release receives fixes. Pre-1.0 releases are supported on a best-effort basis.

## Reporting a vulnerability

Report privately through GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) on this repository. Do not open a public issue for a security problem.

Include the version, a minimal reproduction, and the impact you believe it has. You will get an acknowledgement, and a fix or an explanation of why the report is out of scope.

## What is in scope

- Output directory escape or arbitrary file write through a crafted route or link
- Command execution beyond the explicit `serveCmd` option
- Leakage of `storageState` contents, cookies, or page data into logs or output
- Supply chain issues in published dependencies

## What is out of scope

- The prerenderer executing your app's own client code by design. Prerendering runs your bundle in a real browser; treat it with the same trust as running your app.
- `serveCmd` running a shell command from configuration. That option is documented as trusted input, equivalent to an npm script.
- Third-party content loaded by your app when `blockThirdParty` is disabled.
- Integrity of the optional Chrome for Testing download beyond HTTPS. The archive is fetched over TLS from Google's version-pinned bucket, and Chrome for Testing publishes no checksum feed to verify against. Set `browserDownload: false` if that trust model is not acceptable in your environment.

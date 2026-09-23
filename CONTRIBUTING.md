# Contributing

## Development setup

Requires Node.js 20.19 or newer and a Chrome or Edge install (the integration tests render real pages; a Chrome for Testing download is used only as a fallback).

```sh
npm ci
```

## Commands

```sh
npm run lint              # biome check
npm run lint:fix          # biome check --write
npm test                  # unit tests, no browser needed
npm run test:integration  # builds the fixtures and drives a real browser
```

`npm run test:integration` builds the React 18 and React 19 fixture apps, so expect the first run to take a little longer.

## Layout

- `src/core/` — the prerenderer: config, crawling, rendering, output, verification. No imports from `src/cli.js` or `src/vite-plugin.js`.
- `src/vite-plugin.js`, `src/cli.js`, `src/index.js` — entry points layered on top of core.
- `tests/unit/` — pure logic tests, no browser.
- `tests/integration/` — end-to-end runs against built fixtures and static sites.
- `tests/fixtures/react18-app` — an npm workspace so React 18 and React 19 can coexist.

## Conventions

- Plain JavaScript, ESM only, no build step. The published package is the source.
- Every function gets a one-line comment describing its role in the codebase.
- Operational values are config options with documented defaults, never inline constants.
- Tests must assert the property they exist to protect: cross-route isolation, exact output files, hydration failures detected, and so on.

## Pull requests

- Run `npm run lint`, `npm test`, and `npm run test:integration` before opening a PR.
- Behaviour changes need a test that fails before the change and passes after.
- Keep unrelated refactors out of the change; open a separate PR instead.

## Releasing

1. Bump the version: `npm version patch|minor|major`. This commits and tags.
2. Push the commit and tag: `git push --follow-tags`.
3. Draft a GitHub Release for that tag. Publishing the release triggers `.github/workflows/publish.yml`, which runs lint plus both test suites and then `npm publish --provenance`.
4. Publishing needs npm authentication: `npm login` for a local publish, or the `NPM_TOKEN` repository secret for the workflow. Alternatively configure a trusted publisher on npmjs.com and drop the token.

The first release has to be published once before a trusted publisher can be configured for the package.

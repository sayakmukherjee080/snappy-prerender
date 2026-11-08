# Rendering, readiness and hydration

How the prerenderer decides a page is ready, keeps output deterministic, and checks each route after the client bundle boots.

## Ready contract

Most apps need no configuration. The network-idle wait is enough. If data loads after the first render, signal readiness explicitly:

```js
window.__prerenderReady = false;

// after the data is rendered
window.__prerenderReady = true;
```

The flag is awaited only when the app defines it. Alternatives are `waitFor`, a selector required on every route, or `readySelector`.

## Detecting the prerenderer

Pages render with `userAgent: 'SnappyPrerender'`, so app code can branch:

```js
const isPrerender = navigator.userAgent === 'SnappyPrerender';
```

Use this to skip analytics or point API calls at a reachable host during the build. Set `userAgent: null` to send the browser default.

## Hydration verification

After writing output, the run reloads each route in a fresh browser context with the client bundle. Results are report-only by default. Enable `failOnHydrationError` or `--fail-on-hydration-error` to make hydration a build gate.

The check reports mismatch messages for React, Vue, Preact, Svelte, Angular, Ember and Lit. React text mismatches and production codes `#418`, `#423` and `#425` are recognised. Preact uses React-compatible messages. Solid needs `framework: 'solid'`. Vanilla builds report `undetected` because they have no framework root. A mismatch means the client re-rendered the page; the static HTML is unchanged.

Detection uses DOM markers only: `__reactContainer`, `__vue_app__` or `__vue__`, `__k`, `data-svelte-h`, Svelte 5's `<!--[-->` anchor, Angular's `ng-version`, Ember's application body or `ember-view`, and Lit's `_$litPart$`. Nothing is imported or executed.

Set `framework` when a custom root defeats detection. An explicit framework is treated as mounted and selects the matching mismatch patterns without requiring a marker. Set `framework: 'svelte'` for Svelte 3 client mounts and Svelte 5 apps that only call `mount()` with no hydration anchor. Set `framework: 'solid'` for Solid, and `framework: 'lit'` for Lit 1.x. Set `container` when the app root is outside `#root`, `#app` or `#__next`. A configured container that matches nothing fails the route.

When a route re-renders or has hydration errors, `firstMismatch` reports the first difference between written HTML and the live container as `{ path, kind, expected, actual }`, capped at 5,000 nodes and depth 20.

| Mode | Meaning |
| --- | --- |
| `hydrated` | The app kept the prerendered markup, including wrappers beneath the container. |
| `re-rendered` | The app discarded the markup or replaced everything inside the outer wrapper. |
| `undetected` | No framework root was found on the container. |
| `unknown` | The prerendered node was not seen, often because the container is outside the usual ids. |

A verification navigation that returns HTTP 4xx or 5xx, or a container with no content, is reported as failed with `status` or `empty`. `undetected` and `unknown` are counted; `failOnUndetected: true` fails the build. A verification pass that cannot run is listed in `verification.errors`; `failOnVerificationError: true` gates it separately.

`re-rendered` usually means the app calls `createRoot` instead of `hydrateRoot`, or mounts a string-rendered shell over the prerendered page. `createRoot` emits no hydration error, so the mode is the only signal. The report stores it as `verification.routes[].mode` and summarises it in `verification.modes`. Set `failOnRerender: true` to fail the build.

Uncaught page errors are reported as warnings and counted in the summary. Console errors are reported at debug level. `failOnPageError: true` makes page errors fail the build.

React 16 and 17 use the same modes. Their dev builds emit mismatch warnings; production builds report nothing, so the boot mode is the signal. The historical testcase hosts use the same mode signal with hydration skipped.

`verifyChangedOnly: true` skips verification when the HTML file did not change.

## Deterministic time

Copyright lines and dated content can differ between rendering and the verification reload. Fix the clock for both passes:

```js
snappy({
  freezeTime: true,       // SOURCE_DATE_EPOCH, or the run start
  timezone: 'UTC',
  randomSeed: 42,         // optional, deterministic Math.random
});
```

`freezeTime` also accepts an ISO string or epoch milliseconds:

```js
freezeTime: '2026-05-04T12:00:00Z'
```

Playwright's fixed clock is installed before navigation. Real timers keep running, so settling and scheduled work are unaffected. Pages can read `window.__SNAPPY_NOW__` (epoch ms) or `window.__SNAPPY_NOW_ISO__`. `SOURCE_DATE_EPOCH` is used when `freezeTime` is `true`.

The fixed clock applies to the build and verification only. Production keeps real time. Render live clocks client-only or add a hydration allow-list. `performance.now()` is not frozen because schedulers rely on it.

## Hydration policies

If a route is intentionally live or random, allow its re-render instead of disabling verification:

```js
snappy({
  hydration: {
    allowRerender: ['/status', '/live/*'],
    skip: ['/admin/*'],
  },
  routeOverrides: [
    { match: '/live/private', hydration: 'strict' },
  ],
});
```

`allow-rerender` keeps the mode in the report and moves hydration errors to `ignoredHydrationErrors`. `skip` omits the route from verification and records it in `verification.skippedRoutes`. A matching `routeOverrides[].hydration` wins over the global lists. If both global lists match, `skip` wins.

The CLI flags are `--allow-rerender` and `--skip-hydration`.

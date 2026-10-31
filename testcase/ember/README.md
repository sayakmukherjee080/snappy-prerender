# Aether Compute — Ember

Ember 7.3 implementation of the Aether Compute site, built with Vite and Embroider.

## Run

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
```

The build writes to `dist/`. `snappy.config.js` and `snappy.labs.config.js` point the prerenderer
at the shared 254-route manifest and the unlisted lab.

## Structure

- `app/templates/application.gjs` renders `SiteApp`.
- `app/components/site-app.gjs` hosts the shared site controller, renders its HTML through a
  `SafeString`, and mounts the shared DOM islands after each render.
- `app/router.js` disables Ember's URL synchronisation because the shared controller owns history.
- `app/styles/app.css` is intentionally empty; the shared design system is imported by `SiteApp`.

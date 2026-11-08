import './styles.css';
import { FEATURES } from './features.js';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const PUBLIC_ORIGIN = __DEMO_ORIGIN__;
const VARIANT = BASE.includes('before') ? 'SPA build' : 'Prerendered build';
const PLAYBACK =
  VARIANT === 'SPA build' && new URLSearchParams(window.location.search).has('playback');
const root = document.getElementById('root');
let playbackStarted = false;

const pages = {
  '/': {
    title: 'SPA prerendering demo',
    description:
      'See an SPA before and after prerendering. snappy-prerender is the maintained, MIT-licensed react-snap alternative for React, Vue, Svelte, Preact, Angular, Solid, Lit, Ember and vanilla apps.',
    eyebrow: '01 / Home',
    heading: 'This page has two builds.',
    lede: 'The SPA build renders this page with JavaScript. The prerendered build has the same markup in the HTML file before the app script runs. The output is static HTML for crawlers and link previews. The same approach works for React, Vue, Svelte, Preact, Angular, Solid, Lit, Ember and vanilla JavaScript.',
    cards: [
      [
        'HTML source',
        'The prerendered build includes the heading, paragraphs and links in the document, so a crawler that does not run JavaScript can read them.',
      ],
      [
        'JavaScript off',
        'The SPA build shows an empty page. The prerendered build still shows the text.',
      ],
      ['Same source', 'Both builds use the same app. Only the build step differs.'],
    ],
  },
  '/pricing': {
    title: 'Free MIT react-snap alternative',
    description:
      'The demo pricing page. snappy-prerender is a free, MIT-licensed react-snap alternative with no plans or paid tiers.',
    eyebrow: '02 / Pricing',
    heading: 'The react-snap alternative is free.',
    lede: 'snappy-prerender is MIT-licensed. There are no plans, seats or paid tiers. The package is a free react-snap replacement for React, Vue, Svelte, Preact, Angular, Solid, Lit, Ember and vanilla SPAs. This route exists so the demo has a second page to prerender.',
    cards: [
      ['MIT license', 'Use, modify and redistribute the package under the MIT license.'],
      ['Install from npm', 'Add the package to a project and run it against the built output.'],
      [
        'No hosted service',
        'Prerendering runs in your build pipeline. There is no account or dashboard.',
      ],
    ],
  },
  '/docs': {
    title: 'How SPA prerendering works',
    description:
      'How the demo builds an SPA, prerenders every route to static HTML, and verifies the output.',
    eyebrow: '03 / Docs',
    heading: 'One source, two builds.',
    lede: 'Vite builds the SPA. The prerendered build starts from that output, then snappy-prerender opens every route in a browser and writes the settled DOM back to disk as static HTML. The same process works for React, Vue, Svelte, Preact, Angular, Solid, Lit, Ember and vanilla JavaScript.',
    cards: [
      ['1. Build', 'Vite emits the app with an empty #root and a module script.'],
      [
        '2. Render',
        'snappy-prerender serves the build, opens each route and waits for the page to settle.',
      ],
      [
        '3. Write',
        'The settled DOM becomes index.html for each route, with the page title and metadata.',
      ],
    ],
  },
  '/404': {
    title: 'Page not found',
    description:
      'The requested demo route does not exist. The demo has three pages: home, pricing and docs.',
    eyebrow: '404 / Not found',
    heading: 'This page does not exist.',
    lede: 'The demo has three pages: home, pricing and docs. This URL is not one of them.',
    cards: [['Go back', 'Use the navigation at the top to open home, pricing or docs.']],
  },
};

/**
 * Removes the build base and a trailing slash from the current path.
 * @returns {string}
 */
function currentPath() {
  let path = window.location.pathname;
  if (BASE && (path === BASE || path.startsWith(`${BASE}/`))) {
    path = path.slice(BASE.length) || '/';
  }
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  return path || '/';
}

/**
 * Creates or updates the document description.
 * @param {string} description
 */
function setDescription(description) {
  let tag = document.head.querySelector('meta[name="description"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', 'description');
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', description);
}

/**
 * Creates or updates one meta tag.
 * @param {'name' | 'property'} attribute
 * @param {string} key
 * @param {string} content
 */
function setMeta(attribute, key, content) {
  let tag = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

/**
 * Creates or updates the canonical link.
 * @param {string} href
 */
function setCanonical(href) {
  let link = document.head.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

/**
 * Builds the public URL for a demo route under the current build base.
 * @param {string} path
 * @returns {string}
 */
function canonicalFor(path) {
  const suffix = path === '/' ? `${BASE}/` : `${BASE}${path}/`;
  return `${PUBLIC_ORIGIN}${suffix}`;
}

/**
 * Applies canonical, Open Graph and Twitter metadata for one route.
 * @param {{ title: string, description: string }} page
 * @param {string} path
 */
function setSocialMeta(page, path) {
  const title = `${page.title} | snappy-prerender`;
  const canonical = canonicalFor(path);
  const image = `${PUBLIC_ORIGIN}/og-card.png`;
  setCanonical(canonical);
  setMeta('property', 'og:type', 'website');
  setMeta('property', 'og:site_name', 'snappy-prerender');
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', page.description);
  setMeta('property', 'og:url', canonical);
  setMeta('property', 'og:locale', 'en_US');
  setMeta('property', 'og:image', image);
  setMeta('property', 'og:image:width', '1200');
  setMeta('property', 'og:image:height', '630');
  setMeta(
    'property',
    'og:image:alt',
    'snappy-prerender demo: an SPA before and after prerendering',
  );
  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', page.description);
  setMeta('name', 'twitter:image', image);
  setMeta(
    'name',
    'twitter:image:alt',
    'snappy-prerender demo: an SPA before and after prerendering',
  );
}

/**
 * Renders one route at a playback stage. Stage 0 is an empty root, stage 1 the app
 * shell, stage 2 the hero, and stage 3 the full page.
 * @param {string} path
 * @param {number} stage
 */
function renderStage(path, stage) {
  const page = pages[path] ?? pages['/404'];
  const links = [
    ['/', 'Home'],
    ['/pricing', 'Pricing'],
    ['/docs', 'Docs'],
  ];
  if (stage === 0) {
    root.innerHTML = '';
    return;
  }
  const header = `
      <header class="topbar">
        <a class="brand" href="${BASE}/">
          <span class="brand-mark" aria-hidden="true">S</span>
          <span><strong>snappy-prerender</strong><small>demo</small></span>
        </a>
        <nav aria-label="Demo pages">
          ${links
            .map(
              ([href, label]) =>
                `<a href="${BASE}${href}" data-link ${path === href ? 'aria-current="page"' : ''}>${label}</a>`,
            )
            .join('')}
        </nav>
        <span class="variant">${VARIANT}</span>
      </header>`;
  const hero = `
      <main>
        <p class="eyebrow">${page.eyebrow}</p>
        <h1>${page.heading}</h1>
        <p class="lede">${page.lede}</p>`;
  const rest = `
        <div class="cards">
          ${page.cards
            .map(
              ([title, copy]) => `
                <article class="card">
                  <h2>${title}</h2>
                  <p>${copy}</p>
                </article>`,
            )
            .join('')}
        </div>
        ${
          path === '/404'
            ? ''
            : `<section class="feature-section">
          <p class="eyebrow">Features</p>
          <h2>What snappy-prerender does.</h2>
          <div class="cards">
            ${FEATURES.map(
              ([title, copy, href]) => `
                <article class="card">
                  <h2>${title}</h2>
                  <p>${copy}</p>
                  ${href ? `<a href="${href}" target="_blank" rel="noreferrer">Read the docs ↗</a>` : ''}
                </article>`,
            ).join('')}
          </div>
        </section>`
        }
        <section class="proof">
          <p class="eyebrow">Current build</p>
          <h2>${VARIANT} at ${window.location.pathname}</h2>
          <p>${
            VARIANT === 'SPA build'
              ? 'The HTML file has an empty #root. The content appears after the module script runs.'
              : 'The content is already in the HTML file. It stays visible when JavaScript is disabled.'
          }</p>
        </section>
      </main>
      <footer>
        <span>snappy-prerender demo</span>
        <span>${VARIANT}</span>
      </footer>`;
  root.innerHTML = `<div class="frame">${header}${stage >= 2 ? hero : ''}${
    stage >= 3 ? rest : stage >= 2 ? '</main>' : ''
  }</div>`;
}

/**
 * Applies the route metadata and renders the route, or starts the capture playback.
 */
function render() {
  const path = currentPath();
  const page = pages[path] ?? pages['/404'];

  document.title = `${page.title} | snappy-prerender`;
  setDescription(page.description);
  setSocialMeta(page, path);

  if (PLAYBACK && path === '/' && !playbackStarted) {
    playbackStarted = true;
    renderStage(path, 0);
    setTimeout(() => renderStage(path, 1), 500);
    setTimeout(() => renderStage(path, 2), 1100);
    setTimeout(() => renderStage(path, 3), 1800);
    return;
  }
  renderStage(path, 3);
}

document.addEventListener('click', (event) => {
  const anchor = event.target.closest?.('a[data-link]');
  if (!anchor || event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  window.history.pushState({}, '', anchor.href);
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
});

window.addEventListener('popstate', render);
render();

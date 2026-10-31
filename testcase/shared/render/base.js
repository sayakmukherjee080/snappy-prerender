import { CONTACT, FOOTER_GROUPS, NAV_LINKS, SECTION_IDS } from '../content/site.js';

/**
 * Escapes a value for safe interpolation into HTML text and attributes.
 * @param {unknown} value
 * @returns {string}
 */
export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Joins class names while dropping empty entries.
 * @param {...(string | false | null | undefined)} values
 * @returns {string}
 */
export function cx(...values) {
  return values.filter(Boolean).join(' ');
}

/**
 * Renders an internal link.
 * @param {string} to
 * @param {string} label
 * @param {{ className?: string, attrs?: string, ariaCurrent?: boolean }} options
 * @returns {string}
 */
export function link(to, label, options = {}) {
  const className = options.className ? ` class="${esc(options.className)}"` : '';
  const current = options.ariaCurrent ? ' aria-current="page"' : '';
  const attrs = options.attrs ? ` ${options.attrs}` : '';
  return `<a href="${esc(to)}"${className}${current}${attrs}>${label}</a>`;
}

/**
 * Renders the Aether orbital mark and wordmark.
 * @param {'ink' | 'light'} tone
 * @returns {string}
 */
export function logo(tone = 'ink') {
  return `<span class="logo logo--${tone}">
  <svg class="logo__mark" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
    <circle cx="20" cy="20" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5"></circle>
    <ellipse cx="20" cy="20" rx="18" ry="6.5" fill="none" stroke="currentColor" stroke-width="1.5" transform="rotate(-28 20 20)"></ellipse>
    <circle cx="33.5" cy="10.5" r="2.6" fill="var(--orange)"></circle>
  </svg>
  <span class="logo__text">
    <span class="logo__name">AETHER</span>
    <span class="logo__sub">COMPUTE / ORBITAL</span>
  </span>
</span>`;
}

/**
 * Renders a compact status badge with a semantic tone.
 * @param {string} label
 * @param {string} tone
 * @returns {string}
 */
export function statusBadge(label, tone = 'neutral') {
  return `<span class="status-badge status-badge--${esc(tone)}">${esc(label)}</span>`;
}

/**
 * Renders the shared sub-page masthead.
 * @param {{ eyebrow: string, title: string, summary: string, meta?: Array<{ label: string, value: string }>, badge?: { label: string, tone?: string }, actions?: string }} options
 * @returns {string}
 */
export function pageIntro({ eyebrow, title, summary, meta = [], badge, actions }) {
  const metaHtml =
    meta.length > 0
      ? `<dl class="page-intro__meta">${meta
          .map((item) => `<div><dt>${esc(item.label)}</dt><dd>${esc(item.value)}</dd></div>`)
          .join('')}</dl>`
      : '';

  return `<header class="page-intro">
  <div class="shell">
    <p class="eyebrow">${esc(eyebrow)}</p>
    <div class="page-intro__grid">
      <h1>${title}</h1>
      <div class="page-intro__aside">
        <p class="lede">${esc(summary)}</p>
        ${badge ? statusBadge(badge.label, badge.tone) : ''}
        ${actions ?? ''}
      </div>
    </div>
    ${metaHtml}
  </div>
</header>`;
}

/**
 * Renders the numbered page masthead used by the main sections.
 * @param {{ index: string, label: string, title: string, lede: string, meta?: Array<{ label: string, value: string }> }} options
 * @returns {string}
 */
export function pageHero({ index, label, title, lede, meta = [] }) {
  const metaHtml =
    meta.length > 0
      ? `<dl class="page-hero__meta">${meta
          .map((item) => `<div><dt>${esc(item.label)}</dt><dd>${esc(item.value)}</dd></div>`)
          .join('')}</dl>`
      : '';

  return `<section class="page-hero">
  <div class="shell">
    <p class="eyebrow"><span class="eyebrow__index">${esc(index)}</span>${esc(label)}</p>
    <div class="page-hero__grid">
      <h1>${title}</h1>
      <div class="page-hero__aside"><p class="lede">${esc(lede)}</p></div>
    </div>
    ${metaHtml}
  </div>
</section>`;
}

/**
 * Renders a section heading with a number, label, title, and optional lede.
 * @param {{ index: string, label: string, title: string, lede?: string }} options
 * @returns {string}
 */
export function sectionHead({ index, label, title, lede }) {
  return `<div class="section-head">
  <p class="eyebrow"><span class="eyebrow__index">${esc(index)}</span>${esc(label)}</p>
  <div class="section-head__body${lede ? '' : ' section-head__body--single'}">
    <h2>${title}</h2>
    ${lede ? `<p class="lede">${esc(lede)}</p>` : ''}
  </div>
</div>`;
}

/**
 * Renders the ruled metric band.
 * @param {Array<{ value: string, unit?: string, label: string }>} items
 * @returns {string}
 */
export function metrics(items) {
  return `<dl class="metrics">${items
    .map(
      (item) => `<div class="metrics__item">
    <dt class="metrics__label">${esc(item.label)}</dt>
    <dd class="metrics__value">${esc(item.value)}${
      item.unit ? `<span class="metrics__unit">${esc(item.unit)}</span>` : ''
    }</dd>
  </div>`,
    )
    .join('')}</dl>`;
}

/**
 * Renders the closing conversion band shared by every page.
 * @param {string} title
 * @param {string} copy
 * @returns {string}
 */
export function ctaSection(
  title = 'Reserve capacity before it leaves the pad.',
  copy = 'Tell us your region, your monthly token volume, and when you need to be live. We will map the route and hold the slot.',
) {
  return `<section class="cta">
  <div class="shell cta__inner">
    <div class="cta__copy">
      <p class="eyebrow">Next launch window · Q1 2027</p>
      <h2>${esc(title)}</h2>
    </div>
    <div class="cta__aside">
      <p>${esc(copy)}</p>
      ${link(
        `/company#${SECTION_IDS.contact}`,
        'Request capacity <span aria-hidden="true">↗</span>',
        { className: 'button button--orange' },
      )}
      <span class="cta__meta">Response within two business days</span>
    </div>
  </div>
</section>`;
}

/**
 * Renders a numbered process sequence.
 * @param {Array<{ title: string, copy: string }>} items
 * @returns {string}
 */
export function processSteps(items) {
  return `<ol class="process">${items
    .map(
      (item, index) => `<li class="process__step">
    <span class="process__index">${String(index + 1).padStart(2, '0')}</span>
    <div class="process__body"><h3>${esc(item.title)}</h3><p>${esc(item.copy)}</p></div>
  </li>`,
    )
    .join('')}</ol>`;
}

/**
 * Renders a labelled code sample with a copy action.
 * @param {string} label
 * @param {string} code
 * @param {string} note
 * @returns {string}
 */
export function codeBlock(label, code, note = '') {
  return `<figure class="code" data-island="code">
  <figcaption class="code__head">
    <span class="code__dot" aria-hidden="true"></span>
    <span>${esc(label)}</span>
    <button type="button" class="code__copy" data-code-copy>Copy</button>
  </figcaption>
  <pre class="code__body"><code>${esc(code)}</code></pre>
  ${note ? `<p class="code__note">${esc(note)}</p>` : ''}
</figure>`;
}

/**
 * Renders paired latency bars for a set of routes.
 * @param {Array<{ id: string, from: string, to: string, orbital: number, fiber: number }>} items
 * @returns {string}
 */
export function latencyChart(items) {
  const max = Math.max(...items.flatMap((item) => [item.orbital, item.fiber]));
  return `<div class="latency">
  <div class="latency__key">
    <span><i class="latency__dot latency__dot--orbital" aria-hidden="true"></i> Aether orbital</span>
    <span><i class="latency__dot latency__dot--fiber" aria-hidden="true"></i> Terrestrial fiber</span>
  </div>
  ${items
    .map(
      (item) => `<div class="latency__row">
    <div class="latency__route"><span>${esc(item.from)}</span><span class="latency__arrow" aria-hidden="true">→</span><span>${esc(item.to)}</span></div>
    <div class="latency__bar-line">
      <span class="latency__bar-label">Orbital</span>
      <span class="latency__track" aria-hidden="true"><span class="latency__bar latency__bar--orbital" style="width:${(item.orbital / max) * 100}%"></span></span>
      <span class="latency__bar-value">${item.orbital} ms</span>
    </div>
    <div class="latency__bar-line">
      <span class="latency__bar-label">Fiber</span>
      <span class="latency__track" aria-hidden="true"><span class="latency__bar latency__bar--fiber" style="width:${(item.fiber / max) * 100}%"></span></span>
      <span class="latency__bar-value">${item.fiber} ms</span>
    </div>
  </div>`,
    )
    .join('')}
</div>`;
}

/**
 * Renders the related-links rail for a detail page.
 * @param {Array<{ label: string, to: string }>} links
 * @returns {string}
 */
export function relatedLinks(links = []) {
  if (links.length === 0) return '';
  return `<aside class="detail-aside">
  <p class="mono-label">Related</p>
  <ul class="detail-aside__links">${links
    .map(
      (item) =>
        `<li><a href="${esc(item.to)}">${esc(item.label)} <span aria-hidden="true">→</span></a></li>`,
    )
    .join('')}</ul>
</aside>`;
}

/**
 * Renders content sections with optional lists, stats, code, and callouts.
 * @param {Array<object>} sections
 * @param {Record<string, unknown>} record
 * @param {{ flags?: Record<string, boolean>, variant?: string }} preferences
 * @returns {string}
 */
export function contentSections(sections = [], record = {}, preferences = {}) {
  const flags = preferences.flags ?? {};
  const variant = preferences.variant ?? 'a';
  const visible = sections.filter((section) => {
    if (section.when === 'active' && record.telemetry !== true) return false;
    if (section.when === 'planned' && record.telemetry === true) return false;
    if (section.flag && !flags[section.flag]) return false;
    if (section.variant && variant !== section.variant) return false;
    return true;
  });

  if (visible.length === 0) return '';

  return `<div class="content-sections">${visible
    .map((section) => {
      const paragraphs = Array.isArray(section.body)
        ? section.body
        : section.body
          ? [section.body]
          : [];
      return `<section class="content-section" id="${esc(section.id ?? slugify(section.title))}">
    <h2>${esc(section.title)}</h2>
    ${paragraphs.map((paragraph) => `<p>${esc(paragraph)}</p>`).join('')}
    ${
      section.list
        ? `<ul class="content-list">${section.list.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`
        : ''
    }
    ${
      section.stats
        ? `<dl class="stat-strip">${section.stats
            .map((stat) => `<div><dt>${esc(stat.label)}</dt><dd>${esc(stat.value)}</dd></div>`)
            .join('')}</dl>`
        : ''
    }
    ${section.code ? `<pre class="inline-code">${esc(section.code)}</pre>` : ''}
    ${section.callout ? `<aside class="callout">${esc(section.callout)}</aside>` : ''}
  </section>`;
    })
    .join('')}</div>`;
}

/**
 * Renders a data-driven detail page.
 * @param {object} record
 * @param {{ preferences?: object, extra?: string, widget?: string }} options
 * @returns {string}
 */
export function detailPage(record, options = {}) {
  return `<article class="detail-page">
  ${pageIntro({
    eyebrow: record.eyebrow,
    title: esc(record.title),
    summary: record.summary,
    meta: record.meta,
    badge: record.badge,
    actions: record.apply
      ? `<a class="button button--orange" href="${esc(record.apply.href)}">${esc(
          record.apply.label,
        )} <span aria-hidden="true">↗</span></a>`
      : '',
  })}
  <div class="shell detail-grid">
    <div class="detail-main">
      ${contentSections(record.sections, record, options.preferences)}
      ${options.widget ? widgetMarkup(options.widget) : ''}
      ${options.extra ?? ''}
    </div>
    ${relatedLinks(record.related)}
  </div>
</article>`;
}

/**
 * Renders the breadcrumb trail for the active route.
 * @param {Array<{ label: string, to?: string }>} crumbs
 * @returns {string}
 */
export function breadcrumbs(crumbs) {
  if (!crumbs || crumbs.length === 0) return '';
  return `<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>${crumbs
    .map(
      (crumb, index) =>
        `<li>${crumb.to ? `<a href="${esc(crumb.to)}">${esc(crumb.label)}</a>` : `<span>${esc(crumb.label)}</span>`}${
          index < crumbs.length - 1 ? '<span aria-hidden="true">/</span>' : ''
        }</li>`,
    )
    .join('')}</ol></nav>`;
}

/**
 * Returns whether a nav target is the active route or an ancestor of it.
 * @param {string} path
 * @param {string} to
 * @returns {boolean}
 */
function isNavActive(path, to) {
  if (to === '/') return path === '/';
  return path === to || path.startsWith(`${to}/`);
}

/**
 * Renders the fixed network-status strip and primary navigation.
 * @param {string} path
 * @returns {string}
 */
export function renderHeader(path) {
  return `<div class="statusbar">
  <div class="shell statusbar__inner">
    <span class="statusbar__item statusbar__item--status"><span class="status-dot" aria-hidden="true"></span>Network status: nominal</span>
    <span class="statusbar__item statusbar__item--optional">AETHER-02 · handoff complete · 04:12 UTC</span>
    <span class="statusbar__item statusbar__item--optional">Ground relays 8/8</span>
  </div>
</div>
<header class="site-header" data-island="header">
  <div class="shell site-header__inner">
    <a href="/" class="brand" aria-label="Aether Compute home">${logo()}</a>
    <nav class="nav" aria-label="Primary">${NAV_LINKS.map((item) =>
      link(item.to, esc(item.label), {
        className: 'nav__link',
        ariaCurrent: isNavActive(path, item.to),
      }),
    ).join('')}</nav>
    <div class="site-header__actions">
      <button type="button" class="palette-trigger" data-palette-open aria-label="Open command palette" aria-keyshortcuts="Control+K Meta+K">
        <span class="palette-trigger__label">Search</span><kbd>⌘K</kbd>
      </button>
      ${link(
        `/company#${SECTION_IDS.contact}`,
        'Request capacity <span aria-hidden="true">↗</span>',
        {
          className: 'button button--sm header-cta',
        },
      )}
      <button type="button" class="menu-toggle" data-menu-toggle aria-expanded="false" aria-controls="mobile-nav" aria-label="Open menu">
        <span class="menu-toggle__bar" aria-hidden="true"></span><span class="menu-toggle__bar" aria-hidden="true"></span>
      </button>
    </div>
  </div>
  <span class="route-progress" aria-hidden="true"></span>
  <nav id="mobile-nav" class="mobile-menu" aria-label="Mobile" hidden data-mobile-menu>
    <div class="mobile-menu__list">${NAV_LINKS.map(
      (item, index) =>
        `<a href="${esc(item.to)}" class="mobile-menu__link"${
          isNavActive(path, item.to) ? ' aria-current="page"' : ''
        } data-menu-link><span class="mobile-menu__index">${String(index + 1).padStart(2, '0')}</span><span>${esc(
          item.label,
        )}</span><span class="mobile-menu__arrow" aria-hidden="true">↗</span></a>`,
    ).join('')}</div>
    ${link(
      `/company#${SECTION_IDS.contact}`,
      'Request capacity <span aria-hidden="true">↗</span>',
      {
        className: 'button button--orange mobile-menu__cta',
        attrs: 'data-menu-link',
      },
    )}
    <p class="mobile-menu__meta">Orbital inference network · 550 km SSO<br />Denver · Svalbard · Awarua</p>
  </nav>
</header>`;
}

/**
 * Renders the site footer.
 * @returns {string}
 */
export function renderFooter() {
  return `<footer class="footer">
  <div class="shell">
    <div class="footer__top">
      <div class="footer__brand">
        <a href="/" class="footer__logo" aria-label="Aether Compute home">${logo('light')}</a>
        <p class="footer__tagline">LLM inference from low Earth orbit. Powered by the sun, routed by light, built for teams who count milliseconds.</p>
        <a class="footer__email" href="mailto:${esc(CONTACT.general)}">${esc(CONTACT.general)}</a>
      </div>
      <div class="footer__cols">${FOOTER_GROUPS.map(
        (group) =>
          `<div class="footer__col"><h3>${esc(group.title)}</h3><ul>${group.links
            .map((item) => `<li><a href="${esc(item.to)}">${esc(item.label)}</a></li>`)
            .join('')}</ul></div>`,
      ).join('')}</div>
    </div>
    <div class="footer__wordmark" aria-hidden="true">AETHER</div>
    <div class="footer__bottom">
      <span>© 2026 Aether Compute, Inc.</span>
      <span>254 routes · Denver · Svalbard · Awarua</span>
      <span>Fictional company · illustrative telemetry</span>
    </div>
  </div>
</footer>`;
}

/**
 * Renders the command-palette dialog shell. The active runtime fills the result list.
 * @returns {string}
 */
export function renderPalette() {
  return `<div class="palette-backdrop" data-palette hidden>
  <div class="palette" role="dialog" aria-modal="true" aria-labelledby="palette-title">
    <div class="palette__head">
      <p id="palette-title" class="mono-label">Route palette</p>
      <span class="palette__count" aria-live="polite" data-palette-count>0 routes</span>
      <button type="button" class="palette__close" data-palette-close>Esc</button>
    </div>
    <input class="palette__input" type="search" placeholder="Search all routes…" aria-label="Search routes" autocomplete="off" spellcheck="false" data-palette-input />
    <fieldset class="palette__list" aria-label="Route results" data-palette-list></fieldset>
    <p class="palette__empty" data-palette-empty hidden>No route matches that search. Try a group name, a satellite, or “lab”.</p>
    <div class="palette__foot">
      <span>↑↓ navigate · ↵ open · esc close</span>
      <div class="palette__actions">
        <button type="button" class="palette__action" data-palette-action="telemetry">Telemetry on</button>
        <button type="button" class="palette__action" data-palette-action="variant">Variant A</button>
        <button type="button" class="palette__action" data-palette-action="hidden" hidden>Hidden off</button>
        <button type="button" class="palette__action" data-palette-action="lock" hidden>Lock lab</button>
      </div>
    </div>
  </div>
</div>`;
}

/**
 * Renders the unlisted-lab unlock gate.
 * @returns {string}
 */
export function hiddenGate() {
  return `<section class="hidden-gate" data-island="lab-gate">
  <div class="shell hidden-gate__inner">
    <p class="eyebrow"><span class="eyebrow__index">00</span>Unlisted lab</p>
    <h1>This route is not on the map.</h1>
    <p class="lede">The lab is unlisted and demo-gated. It is not a security boundary; it exists to keep the experimental routes out of the public navigation.</p>
    <form class="hidden-gate__form">
      <label for="gate-code">Demo access code</label>
      <div class="hidden-gate__row">
        <input id="gate-code" type="text" autocomplete="off" spellcheck="false" data-gate-input />
        <button type="submit" class="button button--orange">Unlock lab</button>
      </div>
      <span class="field__error" data-gate-error hidden></span>
    </form>
    <p class="hidden-gate__hint">Demo hint: <code>AETHER</code> · append <code>?unlock=AETHER</code> to any URL to open it directly.</p>
  </div>
</section>`;
}

/**
 * Wraps page content in the persistent site chrome.
 * @param {{ path: string, content: string }} options
 * @returns {string}
 */
export function renderApp({ path, content }) {
  return `<a class="skip-link" href="#main-content">Skip to content</a>
${renderHeader(path)}
<main id="main-content" tabindex="-1">${content}</main>
${renderFooter()}
${renderPalette()}`;
}

/**
 * Converts a title into an anchor-safe identifier.
 * @param {string} value
 * @returns {string}
 */
export function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { launchBrowser } from '../src/core/browser.js';
import { resolveConfig } from '../src/core/config.js';
import { startStaticServer } from '../src/core/server.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const app = path.join(here, 'app');
const site = path.join(here, 'site');
const origin = process.env.DEMO_ORIGIN ?? 'https://snappy-demo.example';

/**
 * Builds one variant of the demo app with the correct public base.
 * @param {'before' | 'after'} variant
 */
async function buildVariant(variant) {
  await build({
    root: app,
    base: `/${variant}/`,
    define: { __DEMO_ORIGIN__: JSON.stringify(origin) },
    logLevel: 'warn',
    build: {
      outDir: path.join(site, variant),
      emptyOutDir: true,
    },
  });
}

/**
 * Reads one meta tag's content.
 * @param {string} html
 * @param {'name' | 'property'} attribute
 * @param {string} key
 * @returns {string | null}
 */
function metaContent(html, attribute, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  const tag = tags.find((candidate) => new RegExp(`${attribute}="${escaped}"`).test(candidate));
  return tag?.match(/content="([^"]*)"/i)?.[1] ?? null;
}

/**
 * Reads the crawler-visible document metadata.
 * @param {string} html
 * @returns {{ title: string | null, description: string | null, canonical: string | null, ogTitle: string | null, ogDescription: string | null, ogImage: string | null, ogUrl: string | null, ogSiteName: string | null, twitterCard: string | null, twitterImage: string | null, h1: number, textLength: number, htmlBytes: number }}
 */
function measure(html) {
  const body = html.slice(html.indexOf('<body'));
  const text = body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    title: html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null,
    description: metaContent(html, 'name', 'description'),
    canonical: html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/i)?.[1] ?? null,
    ogTitle: metaContent(html, 'property', 'og:title'),
    ogDescription: metaContent(html, 'property', 'og:description'),
    ogImage: metaContent(html, 'property', 'og:image'),
    ogUrl: metaContent(html, 'property', 'og:url'),
    ogSiteName: metaContent(html, 'property', 'og:site_name'),
    twitterCard: metaContent(html, 'name', 'twitter:card'),
    twitterImage: metaContent(html, 'name', 'twitter:image'),
    h1: (html.match(/<h1\b/g) ?? []).length,
    textLength: text.length,
    htmlBytes: Buffer.byteLength(html),
  };
}

/**
 * Converts the small markdown subset used by CHANGELOG.md into HTML.
 * @param {string} text
 * @returns {string}
 */
function inlineMarkdown(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
    );
}

/**
 * Parses the changelog's version, section, list and note structure.
 * @param {string} markdown
 * @returns {Array<{ version: string, date: string, blocks: Array<object> }>}
 */
function parseChangelog(markdown) {
  const releases = [];
  let current = null;
  let list = null;
  let note = null;
  let paragraph = null;

  const flushParagraph = () => {
    if (paragraph && current) {
      current.blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
      paragraph = null;
    }
  };
  const flushList = () => {
    if (list && current) {
      current.blocks.push(list);
      list = null;
    }
  };
  const flushNote = () => {
    if (note && current) {
      current.blocks.push({ type: 'note', text: note.join(' ') });
      note = null;
    }
  };
  const flush = () => {
    flushParagraph();
    flushList();
    flushNote();
  };

  for (const line of markdown.split(/\r?\n/)) {
    const version = line.match(/^## \[([^\]]+)\] - (.+)$/);
    if (version) {
      flush();
      current = { version: version[1], date: version[2], blocks: [] };
      releases.push(current);
      continue;
    }
    if (!current) continue;
    if (/^### /.test(line)) {
      flush();
      current.blocks.push({ type: 'section', text: line.slice(4) });
      continue;
    }
    if (line.startsWith('> ')) {
      flushParagraph();
      flushList();
      note ??= [];
      note.push(line.slice(2));
      continue;
    }
    if (/^[-*] /.test(line)) {
      flushParagraph();
      flushNote();
      list ??= { type: 'list', items: [] };
      list.items.push(line.slice(2));
      continue;
    }
    if (list && /^\s{2,}\S/.test(line)) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    if (line.trim() === '') {
      flush();
      continue;
    }
    if (!list) {
      flushNote();
      paragraph ??= [];
      paragraph.push(line.trim());
    }
  }
  flush();
  return releases;
}

/**
 * Orders versions by semantic-version precedence, including pre-release identifiers.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function compareVersions(a, b) {
  const split = (version) => {
    const [base, pre] = version.split('-', 2);
    return { base: base.split('.').map(Number), pre: pre ? pre.split('.') : [] };
  };
  const left = split(a);
  const right = split(b);

  for (let index = 0; index < Math.max(left.base.length, right.base.length); index += 1) {
    const difference = (left.base[index] ?? 0) - (right.base[index] ?? 0);
    if (difference !== 0) return difference;
  }
  if (left.pre.length === 0 && right.pre.length === 0) return 0;
  if (left.pre.length === 0) return 1;
  if (right.pre.length === 0) return -1;

  for (let index = 0; index < Math.max(left.pre.length, right.pre.length); index += 1) {
    const leftPart = left.pre[index];
    const rightPart = right.pre[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) {
      const difference = Number(leftPart) - Number(rightPart);
      if (difference !== 0) return difference;
    } else if (leftNumeric !== rightNumeric) {
      return leftNumeric ? -1 : 1;
    } else {
      const difference = leftPart.localeCompare(rightPart);
      if (difference !== 0) return difference;
    }
  }
  return 0;
}

/**
 * Writes /releases/, generated from the repository changelog.
 */
async function writeReleasesPage() {
  const changelog = await fs.readFile(path.join(repo, 'CHANGELOG.md'), 'utf8');
  const releases = parseChangelog(changelog);
  const sorted = [...releases].sort((a, b) => compareVersions(b.version, a.version));
  const latest = sorted[0]?.version;

  const renderBlock = (block) => {
    if (block.type === 'section') return `<h3>${inlineMarkdown(block.text)}</h3>`;
    if (block.type === 'note') return `<p class="release-note">${inlineMarkdown(block.text)}</p>`;
    if (block.type === 'list') {
      return `<ul>${block.items.map((item) => `<li>${inlineMarkdown(item)}</li>`).join('')}</ul>`;
    }
    return `<p>${inlineMarkdown(block.text)}</p>`;
  };

  const releaseHtml = sorted
    .map(
      (
        release,
      ) => `<article class="release${release.version === latest ? ' release--latest' : ''}" id="v${release.version}">
        <header>
          <div>
            <span class="release-version">${release.version}${release.version === latest ? ' · latest' : ''}</span>
            <time datetime="${release.date}">${release.date}</time>
          </div>
          <a href="https://github.com/sayakmukherjee080/snappy-prerender/releases/tag/v${release.version}" target="_blank" rel="noreferrer">GitHub tag ↗</a>
        </header>
        ${release.blocks.map(renderBlock).join('\n        ')}
      </article>`,
    )
    .join('\n      ');

  const versionNav = sorted
    .map(
      (release) =>
        `<a href="#v${release.version}"${release.version === latest ? ' class="active"' : ''}>v${release.version} <span>${release.date}</span></a>`,
    )
    .join('');

  const page = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>snappy-prerender releases: the maintained react-snap alternative</title>
    <meta name="description" content="Release notes for snappy-prerender, the maintained react-snap alternative for React and Vite single-page apps." />
    <meta name="robots" content="index,follow" />
    <link rel="canonical" href="${origin}/releases/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="snappy-prerender" />
    <meta property="og:title" content="snappy-prerender releases: react-snap alternative" />
    <meta property="og:description" content="Release notes for snappy-prerender, the maintained react-snap alternative for React and Vite single-page apps." />
    <meta property="og:url" content="${origin}/releases/" />
    <meta property="og:image" content="${origin}/og-card.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="snappy-prerender releases" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="snappy-prerender releases" />
    <meta name="twitter:description" content="Release notes for the maintained react-snap alternative." />
    <meta name="twitter:image" content="${origin}/og-card.png" />
    <meta name="twitter:image:alt" content="snappy-prerender releases" />
    <link rel="icon" href="/logo.png" />
    <style>
      :root { color-scheme: dark; --bg:#0d1210; --panel:#151c19; --panel-2:#1b2521; --text:#f2f0e8; --muted:#a4b0a9; --line:#2c3a34; --accent:#d7ff64; --accent-ink:#11170f; }
      * { box-sizing:border-box; }
      body { margin:0; background:radial-gradient(circle at 12% 0%,rgba(215,255,100,.1),transparent 34rem),radial-gradient(circle at 92% 18%,rgba(94,234,212,.06),transparent 28rem),var(--bg); color:var(--text); font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif; line-height:1.55; }
      a { color:inherit; }
      .page { width:min(1180px,calc(100% - 2rem)); margin:0 auto; }
      header { display:flex; align-items:center; justify-content:space-between; gap:1.5rem; padding:1.25rem 0; border-bottom:1px solid var(--line); }
      .brand { display:flex; align-items:center; gap:.7rem; text-decoration:none; }
      .brand img { width:auto; height:2rem; border-radius:.4rem; }
      .brand strong { font-size:1.05rem; letter-spacing:-.03em; }
      .header-actions { display:flex; flex-wrap:wrap; gap:.5rem; }
      .header-actions a { display:inline-flex; align-items:center; gap:.4rem; padding:.45rem .7rem; border:1px solid var(--line); border-radius:999px; color:var(--muted); font-size:.82rem; text-decoration:none; }
      .header-actions a:hover { border-color:var(--accent); color:var(--text); }
      .header-actions svg { width:.95rem; height:.95rem; fill:currentColor; }
      .npm-mark,.ph-mark { display:grid; height:1rem; min-width:1rem; place-items:center; border-radius:.25rem; font-family:ui-monospace,"SFMono-Regular",Consolas,monospace; font-size:.58rem; font-weight:800; }
      .npm-mark { padding:0 .15rem; background:#cb3837; color:white; }
      .ph-mark { background:#da552f; color:white; }
      .hero { padding:clamp(3rem,7vw,5.5rem) 0 2.5rem; }
      .eyebrow { margin:0 0 .9rem; color:var(--accent); font-family:ui-monospace,"SFMono-Regular",Consolas,monospace; font-size:.75rem; letter-spacing:.12em; text-transform:uppercase; }
      h1 { max-width:16ch; margin:0; font-size:clamp(2.8rem,7vw,5.5rem); line-height:.95; letter-spacing:-.055em; }
      .lede { max-width:64ch; margin:1.4rem 0 0; color:var(--muted); font-size:clamp(1rem,2vw,1.15rem); }
      .release-layout { display:grid; grid-template-columns:220px minmax(0,1fr); gap:2.5rem; padding-bottom:4rem; }
      .version-nav { position:sticky; top:1.5rem; align-self:start; display:flex; flex-direction:column; gap:.25rem; border-left:1px solid var(--line); padding-left:1rem; }
      .version-nav a { display:flex; justify-content:space-between; gap:.6rem; padding:.35rem 0; color:var(--muted); font-family:ui-monospace,"SFMono-Regular",Consolas,monospace; font-size:.75rem; text-decoration:none; }
      .version-nav a span { color:#637169; font-size:.65rem; }
      .version-nav a:hover,.version-nav a.active { color:var(--accent); }
      .release { padding:1.5rem 0 1.8rem; border-top:1px solid var(--line); }
      .release:first-child { border-top:0; padding-top:0; }
      .release header { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; padding:0 0 1rem; border:0; }
      .release-version { display:block; font-size:1.4rem; font-weight:700; letter-spacing:-.04em; }
      .release--latest .release-version { color:var(--accent); }
      .release time { display:block; margin-top:.15rem; color:var(--muted); font-family:ui-monospace,"SFMono-Regular",Consolas,monospace; font-size:.68rem; }
      .release header a { flex:none; color:var(--muted); font-family:ui-monospace,"SFMono-Regular",Consolas,monospace; font-size:.66rem; text-decoration:none; }
      .release header a:hover { color:var(--accent); }
      .release h3 { margin:1.35rem 0 .5rem; color:var(--accent); font-family:ui-monospace,"SFMono-Regular",Consolas,monospace; font-size:.7rem; letter-spacing:.1em; text-transform:uppercase; }
      .release ul { margin:.3rem 0 .9rem; padding-left:1.1rem; }
      .release li { margin:.35rem 0; color:#cbd4ce; font-size:.9rem; }
      .release p { max-width:78ch; margin:.5rem 0; color:#cbd4ce; font-size:.9rem; }
      .release code { padding:.1rem .28rem; border-radius:.25rem; background:var(--panel-2); color:var(--accent); font-family:ui-monospace,"SFMono-Regular",Consolas,monospace; font-size:.85em; }
      .release-note { padding:.8rem 1rem; border:1px solid rgba(215,255,100,.25); border-radius:.7rem; background:rgba(215,255,100,.045); color:var(--muted)!important; }
      footer { display:flex; justify-content:space-between; gap:1rem; padding:1.25rem 0 2.5rem; border-top:1px solid var(--line); color:var(--muted); font-size:.8rem; }
      @media (max-width:800px) { .release-layout { grid-template-columns:1fr; gap:1.5rem; } .version-nav { position:static; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.35rem .9rem; border-left:0; border-bottom:1px solid var(--line); padding:0 0 .9rem; } .version-nav a { gap:.4rem; } }
      @media (max-width:480px) { .header-actions { display:none; } .release header { flex-direction:column; } }
    </style>
  </head>
  <body>
    <div class="page">
      <header>
        <a class="brand" href="/"><img src="/logo.png" alt="" /><strong>snappy-prerender</strong></a>
        <div class="header-actions">
          <a href="/">Live demo</a>
          <a href="https://github.com/sayakmukherjee080/snappy-prerender" target="_blank" rel="noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .7a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.2.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.6 11.6 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.2c0 .4.2.7.8.6A11.5 11.5 0 0 0 12 .7Z"/></svg>GitHub</a>
          <a href="https://www.npmjs.com/package/snappy-prerender" target="_blank" rel="noreferrer" aria-label="npm package"><span class="npm-mark" aria-hidden="true">npm</span></a>
          <a href="https://www.producthunt.com/products/snappy-prerender" target="_blank" rel="noreferrer"><span class="ph-mark" aria-hidden="true">P</span>Product Hunt</a>
        </div>
      </header>
      <main>
        <section class="hero">
          <p class="eyebrow">Changelog</p>
          <h1>Release notes.</h1>
          <p class="lede">Every release of the maintained react-snap alternative, generated from the repository's CHANGELOG.md.</p>
        </section>
        <div class="release-layout">
          <nav class="version-nav" aria-label="Versions">${versionNav}</nav>
          <div>${releaseHtml}</div>
        </div>
      </main>
      <footer><span>snappy-prerender</span><span>© smoldev</span></footer>
    </div>
  </body>
</html>`;

  await fs.mkdir(path.join(site, 'releases'), { recursive: true });
  await fs.writeFile(path.join(site, 'releases', 'index.html'), page);
}

/**
 * Writes a root sitemap and robots.txt for the demo's crawlable pages.
 * @param {string} origin
 */
async function writeDiscoveryFiles(origin) {
  const routes = ['/', '/releases/', '/after/', '/after/pricing/', '/after/docs/'];
  const urls = routes
    .map((route) => `  <url><loc>${new URL(route, origin).href}</loc></url>`)
    .join('\n');
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  await fs.writeFile(path.join(site, 'sitemap.xml'), sitemap);
  const robots = `User-agent: *\nAllow: /\nDisallow: /before/\nDisallow: /playback/\n\nSitemap: ${origin}/sitemap.xml\n`;
  await fs.writeFile(path.join(site, 'robots.txt'), robots);
}

/**
 * Escapes captured HTML for a raw source viewer.
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/**
 * Writes a standalone source viewer used by the two raw-HTML iframes.
 * @param {string} name
 * @param {string} title
 * @param {string} source
 */
async function writeRawFrame(name, title, source) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: #0b100e; color: #d7e0da; }
    body { padding: 16px; font: 12px/1.65 ui-monospace, "SFMono-Regular", Consolas, monospace; }
    .meta { display: flex; justify-content: space-between; gap: 1rem; padding-bottom: 10px; margin-bottom: 12px; border-bottom: 1px solid #26312b; color: #8d9c94; font-size: 11px; }
    pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
    .tag { color: #d7ff64; }
  </style></head><body><div class="meta"><span>${title}</span><span>${Buffer.byteLength(source)} bytes</span></div><pre>${escapeHtml(source)}</pre></body></html>`;
  await fs.writeFile(path.join(site, 'playback', name), html);
}

/**
 * Removes scripts from a captured document and pins relative URLs to the build base.
 * @param {string} html
 * @param {string} basePath
 * @returns {string}
 */
function snapshotHtml(html, basePath) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<head([^>]*)>/i, `<head$1><base href="${basePath}">`);
}

/**
 * Captures the SPA loading stages and the prerendered HTML/hydrated states for the
 * landing page's playback timeline.
 * @param {string} beforeHtml
 * @param {string} afterHtml
 */
async function capturePlayback(beforeHtml, afterHtml) {
  const playbackDir = path.join(site, 'playback');
  await fs.mkdir(playbackDir, { recursive: true });

  const write = async (name, html, basePath) => {
    await fs.writeFile(path.join(playbackDir, name), snapshotHtml(html, basePath));
  };
  await write('before-0.html', beforeHtml, '/before/');
  await write('after-0.html', afterHtml, '/after/');

  const config = resolveConfig({ logLevel: 'silent' });
  const started = await startStaticServer({ dir: site, base: '/' });
  const { browser } = await launchBrowser(config, {
    info() {},
    warn() {},
    error() {},
    debug() {},
  });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 900 });
    await page.goto(`${started.origin}/before/?playback=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForSelector('.topbar', { timeout: 10000 });
    await write('before-1.html', await page.content(), '/before/');
    await page.waitForSelector('h1', { timeout: 10000 });
    await write('before-2.html', await page.content(), '/before/');
    await page.waitForSelector('.cards', { timeout: 10000 });
    await write('before-3.html', await page.content(), '/before/');

    await page.goto(`${started.origin}/after/`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForSelector('.cards', { timeout: 10000 });
    await write('after-1.html', await page.content(), '/after/');
  } finally {
    await browser.close();
    await started.close();
  }

  const stages = [
    {
      time: 0,
      before: '/playback/before-0.html',
      after: '/playback/after-0.html',
      beforeState: 'empty #root',
      afterState: 'HTML content',
    },
    {
      time: 500,
      before: '/playback/before-1.html',
      after: '/playback/after-0.html',
      beforeState: 'header rendered',
      afterState: 'HTML content',
    },
    {
      time: 1100,
      before: '/playback/before-2.html',
      after: '/playback/after-1.html',
      beforeState: 'hero rendered',
      afterState: 'hydrated SPA',
    },
    {
      time: 1800,
      before: '/playback/before-3.html',
      after: '/playback/after-1.html',
      beforeState: 'full content',
      afterState: 'hydrated SPA',
    },
  ];
  await fs.writeFile(path.join(site, 'playback.json'), `${JSON.stringify({ stages }, null, 2)}\n`);
}

/**
 * Draws the social share card used by the after build's OG tags.
 * @param {string} file
 */
async function createOgImage(file) {
  const config = resolveConfig({ logLevel: 'silent' });
  const { browser } = await launchBrowser(config, {
    info() {},
    warn() {},
    error() {},
    debug() {},
  });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 630 });
    await page.setContent(`<!doctype html><html><head><style>
      * { box-sizing: border-box; }
      body {
        width: 1200px; height: 630px; margin: 0; overflow: hidden;
        background: radial-gradient(circle at 10% 0%, #263328, transparent 45%),
          radial-gradient(circle at 95% 90%, #1d3a33, transparent 45%), #0d1210;
        color: #f2f0e8; font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      .card { display: flex; height: 100%; flex-direction: column; justify-content: space-between; padding: 64px; }
      .brand { display: flex; align-items: center; gap: 16px; color: #d7ff64; font-size: 24px; font-weight: 800; letter-spacing: -0.03em; }
      .mark { display: grid; width: 48px; height: 48px; place-items: center; border-radius: 12px; background: #d7ff64; color: #11170f; }
      h1 { max-width: 900px; margin: 0; font-size: 76px; line-height: 0.95; letter-spacing: -0.06em; }
      p { max-width: 760px; margin: 20px 0 0; color: #a4b0a9; font-size: 28px; line-height: 1.35; }
      .foot { display: flex; justify-content: space-between; color: #a4b0a9; font-family: ui-monospace, monospace; font-size: 18px; letter-spacing: 0.06em; text-transform: uppercase; }
      .accent { color: #d7ff64; }
    </style></head><body><div class="card">
      <div class="brand"><span class="mark">S</span> snappy-prerender</div>
      <div><h1>The page is in<br />the HTML.</h1><p>The maintained react-snap alternative for React and Vite SPAs. Each route is static HTML at build time, so crawlers read it before the app script runs.</p></div>
      <div class="foot"><span>react-snap alternative</span><span>MIT · snappy-prerender</span></div>
    </div></body></html>`);
    await page.screenshot({ path: file, type: 'png' });
  } finally {
    await browser.close();
  }
}

await fs.rm(site, { recursive: true, force: true });
await fs.mkdir(site, { recursive: true });

await buildVariant('before');
await buildVariant('after');

const result = spawnSync(
  process.execPath,
  [
    path.join(repo, 'src', 'cli.js'),
    '--config',
    path.join(here, 'snappy.after.config.mjs'),
    '--log-level',
    'warn',
  ],
  {
    cwd: here,
    env: { ...process.env, DEMO_ORIGIN: origin },
    stdio: 'inherit',
  },
);
if (result.status !== 0) {
  throw new Error(`snappy-prerender exited with status ${result.status}`);
}

const beforeHtml = await fs.readFile(path.join(site, 'before', 'index.html'), 'utf8');
const afterHtml = await fs.readFile(path.join(site, 'after', 'index.html'), 'utf8');
const before = measure(beforeHtml);
const after = measure(afterHtml);
await createOgImage(path.join(site, 'og-card.png'));
await capturePlayback(beforeHtml, afterHtml);
await writeRawFrame('raw-before.html', 'Without snappy-prerender: raw HTML', beforeHtml);
await writeRawFrame('raw-after.html', 'With snappy-prerender: raw HTML', afterHtml);
await fs.copyFile(path.join(repo, 'assets', 'snappy-logo.png'), path.join(site, 'logo.png'));
await writeReleasesPage();
await writeDiscoveryFiles(origin);

const social = {
  before: {
    title: before.title,
    description: before.description,
    image: before.ogImage,
    url: before.ogUrl,
    site: before.ogSiteName,
  },
  after: {
    title: after.ogTitle,
    description: after.ogDescription,
    image: after.ogImage,
    url: after.ogUrl,
    site: after.ogSiteName,
  },
};
await fs.writeFile(
  path.join(site, 'comparison.json'),
  `${JSON.stringify({ before, after, social, origin }, null, 2)}\n`,
);
const landing = await fs.readFile(path.join(here, 'landing', 'index.html'), 'utf8');
await fs.writeFile(path.join(site, 'index.html'), landing.replaceAll('__DEMO_ORIGIN__', origin));

console.log('Built before, after, playback, raw source, releases, OG card and comparison page.');
console.log(`Before: h1=${before.h1}, text=${before.textLength}, bytes=${before.htmlBytes}`);
console.log(`After:  h1=${after.h1}, text=${after.textLength}, bytes=${after.htmlBytes}`);
console.log(`OG image: ${after.ogImage ?? 'missing'}`);

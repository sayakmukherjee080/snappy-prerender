import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { launchBrowser } from '../src/core/browser.js';
import { resolveConfig } from '../src/core/config.js';
import { prerender } from '../src/core/index.js';
import { startStaticServer } from '../src/core/server.js';
import { FEATURES } from './app/src/features.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const testcase = path.join(repo, 'testcase', 'react');
const site = path.join(here, 'site');
const origin = process.env.DEMO_ORIGIN ?? 'https://snappy-demo.example';

/**
 * Builds the React testcase under one public base. The before variant stays a plain SPA
 * build; the after variant is prerendered in place by the CLI afterwards.
 * @param {'before' | 'after'} variant
 */
async function buildVariant(variant) {
  await build({
    root: testcase,
    base: `/${variant}/`,
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
    <title>snappy-prerender releases: the framework-agnostic react-snap alternative</title>
    <meta name="description" content="Release notes for snappy-prerender, the maintained react-snap alternative for React, Vue, Svelte, Preact, Angular, Solid, Lit, Ember and vanilla single-page apps." />
    <meta name="robots" content="index,follow" />
    <link rel="canonical" href="${origin}/releases/" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="snappy-prerender" />
    <meta property="og:title" content="snappy-prerender releases: react-snap alternative for every SPA" />
    <meta property="og:description" content="Release notes for snappy-prerender, the maintained react-snap alternative for React, Vue, Svelte, Preact, Angular, Solid, Lit, Ember and vanilla single-page apps." />
    <meta property="og:url" content="${origin}/releases/" />
    <meta property="og:image" content="${origin}/og-card.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="snappy-prerender releases" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="snappy-prerender releases" />
    <meta name="twitter:description" content="Release notes for the framework-agnostic react-snap alternative." />
    <meta name="twitter:image" content="${origin}/og-card.png" />
    <meta name="twitter:image:alt" content="snappy-prerender releases" />
    <link rel="icon" href="/logo.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <script>
      try {
        const savedTheme = localStorage.getItem('snappy-demo-theme');
        if (savedTheme === 'light' || savedTheme === 'dark') {
          document.documentElement.dataset.theme = savedTheme;
        }
      } catch {}
    </script>
    <style>
      :root { color-scheme: dark; --bg:#1e1e1e; --panel:#252526; --panel-2:#2d2d2d; --text:#d4d4d4; --muted:#858585; --line:#3c3c3c; --accent:#7ee787; --accent-ink:#07120b; --body:#d4d4d4; }
      :root[data-theme="light"] { color-scheme: light; --bg:#ffffff; --panel:#f3f3f3; --panel-2:#ececec; --text:#333333; --muted:#6e7681; --line:#e5e5e5; --accent:#1a7f37; --accent-ink:#ffffff; --body:#333333; }
      * { box-sizing:border-box; }
      html { scrollbar-color:var(--line) var(--bg); scrollbar-width:thin; }
      *::-webkit-scrollbar { width:12px; height:12px; }
      *::-webkit-scrollbar-track { background:var(--bg); }
      *::-webkit-scrollbar-thumb { border:3px solid var(--bg); border-radius:999px; background:var(--line); }
      *::-webkit-scrollbar-thumb:hover { background:var(--accent); }
      body { margin:0; background:var(--bg); color:var(--text); font-family:"JetBrains Mono","Cascadia Code","SFMono-Regular",Menlo,Consolas,monospace; line-height:1.6; }
      a { color:inherit; }
      .page { width:min(1180px,calc(100% - 2rem)); margin:0 auto; }
      header { display:flex; align-items:center; justify-content:space-between; gap:1.5rem; padding:1.25rem 0; border-bottom:1px solid var(--line); }
      .brand { display:flex; align-items:center; gap:.7rem; text-decoration:none; }
      .brand img { width:auto; height:2rem; border-radius:.4rem; }
      .brand strong { font-size:1.05rem; letter-spacing:-.03em; }
      .header-actions { display:flex; flex-wrap:wrap; gap:.5rem; }
      .header-actions a, .header-actions button { display:inline-flex; align-items:center; gap:.4rem; padding:.45rem .7rem; border:1px solid var(--line); border-radius:999px; background:transparent; color:var(--muted); cursor:pointer; font:inherit; font-size:.82rem; text-decoration:none; }
      .header-actions a:hover, .header-actions button:hover { border-color:var(--accent); color:var(--text); }
      .header-actions svg { width:.95rem; height:.95rem; fill:currentColor; }
      .header-actions .icon-link { width:2.1rem; height:2.1rem; padding:0; justify-content:center; border-radius:50%; }
      .header-actions .icon-link svg { width:1rem; height:1rem; }
      .header-actions .icon-link .npm-mark { height:1.15rem; min-width:1.15rem; background:var(--panel-2); color:var(--text); }
      .theme-icon--moon { display:none; }
      :root[data-theme="light"] .theme-icon--sun { display:none; }
      :root[data-theme="light"] .theme-icon--moon { display:block; }
      .npm-mark { display:grid; height:1rem; min-width:1rem; padding:0 .15rem; place-items:center; border-radius:.25rem; background:var(--panel-2); color:var(--text); font-family:"JetBrains Mono","Cascadia Code","SFMono-Regular",Consolas,monospace; font-size:.58rem; font-weight:800; }
      .hero { padding:clamp(3rem,7vw,5.5rem) 0 2.5rem; }
      .eyebrow { margin:0 0 .9rem; color:var(--accent); font-family:"JetBrains Mono","Cascadia Code","SFMono-Regular",Consolas,monospace; font-size:.75rem; letter-spacing:.12em; text-transform:uppercase; }
      h1 { max-width:16ch; margin:0; font-size:clamp(2.8rem,7vw,5.5rem); line-height:.95; letter-spacing:-.055em; }
      .lede { margin:1.4rem 0 0; color:var(--muted); font-size:clamp(1rem,2vw,1.15rem); }
      .features { padding:1.5rem 0 1rem; border-top:1px solid var(--line); }
      .features h2 { margin:.25rem 0 .7rem; font-size:1.4rem; letter-spacing:-.03em; }
      .feature-list { display:grid; gap:.5rem; margin:0; padding-left:1.1rem; color:var(--body); font-size:.9rem; }
      .feature-list strong { color:var(--accent); }
      .release-layout { display:grid; grid-template-columns:220px minmax(0,1fr); gap:2.5rem; padding-bottom:4rem; }
      .version-nav { position:sticky; top:1.5rem; align-self:start; display:flex; flex-direction:column; gap:.25rem; border-left:1px solid var(--line); padding-left:1rem; }
      .version-nav a { display:flex; justify-content:space-between; gap:.6rem; padding:.35rem 0; color:var(--muted); font-family:"JetBrains Mono","Cascadia Code","SFMono-Regular",Consolas,monospace; font-size:.75rem; text-decoration:none; }
      .version-nav a span { color:var(--muted); font-size:.65rem; }
      .version-nav a:hover,.version-nav a.active { color:var(--accent); }
      .release { padding:1.5rem 0 1.8rem; border-top:1px solid var(--line); }
      .release:first-child { border-top:0; padding-top:0; }
      .release header { display:flex; align-items:flex-start; justify-content:space-between; gap:1rem; padding:0 0 1rem; border:0; }
      .release-version { display:block; font-size:1.4rem; font-weight:700; letter-spacing:-.04em; }
      .release--latest .release-version { color:var(--accent); }
      .release time { display:block; margin-top:.15rem; color:var(--muted); font-family:"JetBrains Mono","Cascadia Code","SFMono-Regular",Consolas,monospace; font-size:.68rem; }
      .release header a { flex:none; color:var(--muted); font-family:"JetBrains Mono","Cascadia Code","SFMono-Regular",Consolas,monospace; font-size:.66rem; text-decoration:none; }
      .release header a:hover { color:var(--accent); }
      .release h3 { margin:1.35rem 0 .5rem; color:var(--accent); font-family:"JetBrains Mono","Cascadia Code","SFMono-Regular",Consolas,monospace; font-size:.7rem; letter-spacing:.1em; text-transform:uppercase; }
      .release ul { margin:.3rem 0 .9rem; padding-left:1.1rem; }
      .release li { margin:.35rem 0; color:var(--body); font-size:.9rem; }
      .release p { margin:.5rem 0; color:var(--body); font-size:.9rem; }
      .release code { padding:.1rem .28rem; border-radius:.25rem; background:var(--panel-2); color:var(--accent); font-family:"JetBrains Mono","Cascadia Code","SFMono-Regular",Consolas,monospace; font-size:.85em; }
      .release-note { padding:.8rem 1rem; border:1px solid var(--line); border-radius:.7rem; background:var(--panel-2); color:var(--muted)!important; }
      footer { display:flex; justify-content:space-between; gap:1rem; padding:1.25rem 0 2.5rem; border-top:1px solid var(--line); color:var(--muted); font-size:.8rem; }
      @media (max-width:800px) { .release-layout { grid-template-columns:1fr; gap:1.5rem; } .version-nav { position:static; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:.35rem .9rem; border-left:0; border-bottom:1px solid var(--line); padding:0 0 .9rem; } .version-nav a { gap:.4rem; } }
      @media (max-width:480px) { header { flex-wrap:wrap; } .header-actions { width:100%; } .header-actions a, .header-actions button { flex:1 1 auto; justify-content:center; } .header-actions .icon-link { flex:0 0 2.1rem; } .release header { flex-direction:column; } }
    </style>
  </head>
  <body>
    <div class="page">
      <header>
        <a class="brand" href="/"><img src="/logo.png" alt="" /><strong>snappy-prerender</strong></a>
        <div class="header-actions">
          <a href="/">Live demo</a>
          <a class="icon-link" href="https://github.com/sayakmukherjee080/snappy-prerender" target="_blank" rel="noreferrer" aria-label="GitHub" title="GitHub"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .7a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.2.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.6 11.6 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.2c0 .4.2.7.8.6A11.5 11.5 0 0 0 12 .7Z"/></svg></a>
          <a class="icon-link" href="https://www.npmjs.com/package/snappy-prerender" target="_blank" rel="noreferrer" aria-label="npm package" title="npm"><span class="npm-mark" aria-hidden="true">npm</span></a>
          <a class="icon-link" href="https://www.producthunt.com/products/snappy-prerender" target="_blank" rel="noreferrer" aria-label="Product Hunt" title="Product Hunt"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-1.3 5h3.1a3.1 3.1 0 0 1 0 6.2h-1.5V17h-1.6V7Zm1.6 1.5v3.2h1.5a1.6 1.6 0 0 0 0-3.2h-1.5Z"/></svg></a>
          <button class="icon-link" type="button" id="theme-toggle" aria-label="Switch to light theme" title="Switch to light theme"><svg class="theme-icon theme-icon--sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4m0-14.2-1.4 1.4M6.3 17.7l-1.4 1.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><svg class="theme-icon theme-icon--moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"/></svg></button>
        </div>
      </header>
      <main>
        <section class="hero">
          <p class="eyebrow">Changelog</p>
          <h1>Release notes.</h1>
          <p class="lede">Every release of the framework-agnostic react-snap alternative. The build generates this page from the repository's CHANGELOG.md.</p>
        </section>
        <section class="features">
          <p class="eyebrow">Features</p>
          <h2>What snappy-prerender does.</h2>
          <ul class="feature-list">
            ${FEATURES.map(
              ([title, copy]) =>
                `<li><strong>${escapeHtml(title)}:</strong> ${escapeHtml(copy)}</li>`,
            ).join('\n            ')}
          </ul>
        </section>
        <div class="release-layout">
          <nav class="version-nav" aria-label="Versions">${versionNav}</nav>
          <div>${releaseHtml}</div>
        </div>
      </main>
      <footer><span>snappy-prerender</span><span>© smoldev</span></footer>
    </div>
    <script>
      const themeToggle = document.getElementById('theme-toggle');
      const savedTheme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
      const savedLabel = 'Switch to ' + (savedTheme === 'dark' ? 'light' : 'dark') + ' theme';
      themeToggle.setAttribute('aria-label', savedLabel);
      themeToggle.setAttribute('title', savedLabel);
      themeToggle.addEventListener('click', () => {
        const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
        document.documentElement.dataset.theme = next;
        try { localStorage.setItem('snappy-demo-theme', next); } catch {}
        const label = 'Switch to ' + (next === 'dark' ? 'light' : 'dark') + ' theme';
        themeToggle.setAttribute('aria-label', label);
        themeToggle.setAttribute('title', label);
      });
    </script>
  </body>
</html>`;

  await fs.mkdir(path.join(site, 'releases'), { recursive: true });
  await fs.writeFile(path.join(site, 'releases', 'index.html'), page);
}

/**
 * Builds the site checker page from the landing shell so both pages share the same
 * header, footer and theme styles.
 * @param {string} origin
 */
async function writeCheckPage(origin) {
  const landing = await fs.readFile(path.join(here, 'landing', 'index.html'), 'utf8');
  const style = landing.match(/<style>([\s\S]*?)<\/style>/i)?.[1] ?? '';
  const header = landing.match(/<header class="topbar">[\s\S]*?<\/header>/i)?.[0] ?? '';
  const footer = landing.match(/<footer>[\s\S]*?<\/footer>/i)?.[0] ?? '';
  const template = await fs.readFile(path.join(here, 'landing', 'check.html'), 'utf8');
  const apiOrigin = (process.env.DEMO_API_ORIGIN ?? '').replace(/\/+$/, '');
  const page = template
    .replace('__SHARED_STYLE__', style)
    .replace('__HEADER__', header)
    .replace('__FOOTER__', footer)
    .replaceAll('__DEMO_ORIGIN__', origin)
    .replaceAll('__CHECK_API_ORIGIN__', apiOrigin);
  await fs.mkdir(path.join(site, 'check'), { recursive: true });
  await fs.writeFile(path.join(site, 'check', 'index.html'), page);
}

/**
 * Writes a root sitemap and robots.txt for the demo's crawlable pages.
 * @param {string} origin
 */
async function writeDiscoveryFiles(origin) {
  const afterSitemap = await fs.readFile(path.join(site, 'after', 'sitemap.xml'), 'utf8');
  const afterUrls = (afterSitemap.match(/<url>[\s\S]*?<\/url>/g) ?? []).map(
    (entry) => `  ${entry.replace(/\n\s*/g, '\n  ')}`,
  );
  const landingUrls = ['/', '/releases/', '/check/'].map(
    (route) => `  <url><loc>${new URL(route, origin).href}</loc></url>`,
  );
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...landingUrls, ...afterUrls].join('\n')}\n</urlset>\n`;
  await fs.writeFile(path.join(site, 'sitemap.xml'), sitemap);
  const robots = `User-agent: *\nAllow: /\nDisallow: /before/\nDisallow: /playback/\n\nSitemap: ${origin}/sitemap.xml\n`;
  await fs.writeFile(path.join(site, 'robots.txt'), robots);
  const llms = `# snappy-prerender\n\n> Build-time static prerendering for existing single-page apps. MIT-licensed react-snap alternative.\n\n## Demo\n- [Home](${origin}/): before/after playback and the package overview.\n- [Site checker](${origin}/check/): see the crawler metadata and llms.txt for any URL.\n- [Releases](${origin}/releases/): release notes generated from CHANGELOG.md.\n- [Prerendered demo](${origin}/after/): the same SPA after snappy-prerender.\n- [Full route index](${origin}/after/llms.txt): every prerendered route with its title and description.\n- [Pricing demo](${origin}/after/pricing/): a second prerendered route.\n- [Docs demo](${origin}/after/docs/): how the two builds are made.\n\n## Project\n- [README](https://github.com/sayakmukherjee080/snappy-prerender/blob/main/README.md)\n- [Configuration](https://github.com/sayakmukherjee080/snappy-prerender/blob/main/docs/configuration.md)\n- [npm package](https://www.npmjs.com/package/snappy-prerender)\n`;
  await fs.writeFile(path.join(site, 'llms.txt'), llms);
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
    html { scrollbar-color: #3c3c3c #000000; scrollbar-width: thin; }
    *::-webkit-scrollbar { width: 10px; height: 10px; }
    *::-webkit-scrollbar-track { background: #000000; }
    *::-webkit-scrollbar-thumb { border: 2px solid #000000; border-radius: 999px; background: #3c3c3c; }
    *::-webkit-scrollbar-thumb:hover { background: #007acc; }
    html, body { margin: 0; min-height: 100%; background: #000000; color: #e5e5e5; }
    body { padding: 16px; font: 12px/1.65 ui-monospace, "SFMono-Regular", "Cascadia Code", "JetBrains Mono", Menlo, Consolas, monospace; }
    .meta { display: flex; justify-content: space-between; gap: 1rem; padding-bottom: 10px; margin-bottom: 12px; border-bottom: 1px solid #2a2a2a; color: #a3a3a3; font-size: 11px; }
    pre { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
    .tag { color: #ffffff; }
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
  const scrollbar = `<style>
    html { overflow-y: scroll; }
    *::-webkit-scrollbar { width: 10px; height: 10px; }
    *::-webkit-scrollbar-track { background: #f2f0e9; }
    *::-webkit-scrollbar-thumb { border: 2px solid #f2f0e9; border-radius: 999px; background: #b8b2a5; }
    *::-webkit-scrollbar-thumb:hover { background: #b5522f; }
  </style>`;
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/(href|src)="\/before\/assets\//gi, '$1="/after/assets/')
    .replace(/<head([^>]*)>/i, `<head$1><base href="${basePath}">${scrollbar}`);
}

/**
 * Captures the SPA loading stages and the prerendered HTML/hydrated states for the
 * landing page's playback timeline.
 * @param {string} beforeHtml
 * @param {string} afterHtml
 */
async function capturePlayback({ beforeHtml, afterHtml }) {
  const playbackDir = path.join(site, 'playback');
  await fs.mkdir(playbackDir, { recursive: true });

  const write = async (name, html, basePath = '/') => {
    await fs.writeFile(path.join(playbackDir, name), snapshotHtml(html, basePath));
  };
  await write('before-0.html', beforeHtml);
  await write('after-0.html', afterHtml);

  const config = resolveConfig({ logLevel: 'silent' });
  const { browser } = await launchBrowser(config, {
    info() {},
    warn() {},
    error() {},
    debug() {},
  });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1200, height: 900 });
    const server = await startStaticServer({ dir: site, base: '/' });
    try {
      await page.goto(`${server.origin}/before/`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await page.waitForSelector('header', { timeout: 10000 });
      await write('before-1.html', await page.content());
      await page.waitForSelector('h1', { timeout: 10000 });
      await write('before-2.html', await page.content());
      await page.waitForSelector('footer', { timeout: 10000 });
      await write('before-3.html', await page.content());

      await page.goto(`${server.origin}/after/`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await page.waitForSelector('footer', { timeout: 10000 });
      await write('after-1.html', await page.content());
    } finally {
      await server.close();
    }
  } finally {
    await browser.close();
  }

  const stages = [
    {
      time: 0,
      afterTime: 0,
      before: '/playback/before-0.html',
      after: '/playback/after-0.html',
      beforeState: 'empty #root',
      afterState: 'HTML content',
    },
    {
      time: 500,
      afterTime: 0,
      before: '/playback/before-1.html',
      after: '/playback/after-0.html',
      beforeState: 'header rendered',
      afterState: 'HTML content',
    },
    {
      time: 1100,
      afterTime: 1100,
      before: '/playback/before-2.html',
      after: '/playback/after-1.html',
      beforeState: 'hero rendered',
      afterState: 'hydrated SPA',
    },
    {
      time: 1800,
      afterTime: 1100,
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
  const logo = (await fs.readFile(path.join(repo, 'assets', 'snappy-logo.png'))).toString('base64');
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
        background: #000000;
        color: #ffffff; font-family: ui-monospace, "SFMono-Regular", "Cascadia Code", "JetBrains Mono", Menlo, Consolas, monospace;
      }
      .card { display: flex; height: 100%; flex-direction: column; justify-content: space-between; padding: 64px; }
      .brand { display: flex; align-items: center; gap: 24px; color: #ffffff; font-size: 34px; font-weight: 800; letter-spacing: -0.03em; }
      .brand-logo { display: block; width: 190px; height: 190px; object-fit: contain; }
      h1 { max-width: 900px; margin: 0; font-size: 76px; line-height: 0.95; letter-spacing: -0.06em; }
      p { max-width: 760px; margin: 20px 0 0; color: #a3a3a3; font-size: 28px; line-height: 1.35; }
      .foot { display: flex; justify-content: space-between; color: #a3a3a3; font-family: ui-monospace, monospace; font-size: 18px; letter-spacing: 0.06em; text-transform: uppercase; }
      .accent { color: #ffffff; }
    </style></head><body><div class="card">
      <div class="brand"><img class="brand-logo" src="data:image/png;base64,${logo}" alt="" /> snappy-prerender</div>
      <div><h1>The page content<br />is in the HTML.</h1><p>The framework-agnostic react-snap alternative for React, Vue, Svelte, Preact, Angular, Solid, Lit, Ember and vanilla SPAs. Each route is static HTML at build time, so crawlers read it before the app script runs.</p></div>
      <div class="foot"><span>react-snap alternative</span><span>MIT · snappy-prerender</span></div>
    </div></body></html>`);
    await page.screenshot({ path: file, type: 'png' });
  } finally {
    await browser.close();
  }
}

await fs.rm(site, { recursive: true, force: true });
await fs.mkdir(site, { recursive: true });
await fs.copyFile(path.join(repo, 'assets', 'snappy-logo.png'), path.join(site, 'logo.png'));
await createOgImage(path.join(site, 'og-card.png'));

await buildVariant('before');
await buildVariant('after');
for (const variant of ['before', 'after']) {
  await fs.copyFile(
    path.join(repo, 'assets', 'snappy-logo.png'),
    path.join(site, variant, 'logo.png'),
  );
  await fs.copyFile(path.join(site, 'og-card.png'), path.join(site, variant, 'og-card.png'));
}

const localCli = path.join(here, 'node_modules', '.bin', 'snappy-prerender');
const cliPath = await fs
  .access(localCli)
  .then(() => localCli)
  .catch(() => path.join(repo, 'src', 'cli.js'));
const result = spawnSync(
  process.execPath,
  [cliPath, '--config', path.join(here, 'snappy.after.config.mjs'), '--log-level', 'warn'],
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
await capturePlayback({ beforeHtml, afterHtml });
await writeRawFrame('raw-before.html', 'Without snappy-prerender: raw HTML', beforeHtml);
await writeRawFrame('raw-after.html', 'With snappy-prerender: raw HTML', afterHtml);
await writeReleasesPage();
await writeCheckPage(origin);
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
const featureCards = FEATURES.map(
  ([title, copy, href]) =>
    `<article class="benefit-card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(copy)}</p><a href="${href}" target="_blank" rel="noreferrer">Read the docs ↗</a></article>`,
).join('\n          ');
const landing = await fs.readFile(path.join(here, 'landing', 'index.html'), 'utf8');
await fs.writeFile(
  path.join(site, 'index.html'),
  landing.replaceAll('__DEMO_ORIGIN__', origin).replace('__FEATURES__', featureCards),
);
await prerender({
  sourceDir: site,
  include: ['/', '/check', '/releases'],
  notFoundRoute: null,
  crawl: false,
  verify: false,
  audit: false,
  sitemap: false,
  llmsTxt: false,
  preloadManifest: false,
  logLevel: 'warn',
  metadata: { siteUrl: origin, siteName: 'snappy-prerender', trailingSlash: 'always' },
  routeOverrides: [
    { match: '/', waitFor: '.benefit-grid' },
    { match: '/check', waitFor: '.check-form' },
  ],
});

console.log('Built before, after, playback, raw source, releases, OG card and comparison page.');
console.log(`Before: h1=${before.h1}, text=${before.textLength}, bytes=${before.htmlBytes}`);
console.log(`After:  h1=${after.h1}, text=${after.textLength}, bytes=${after.htmlBytes}`);
console.log(`OG image: ${after.ogImage ?? 'missing'}`);

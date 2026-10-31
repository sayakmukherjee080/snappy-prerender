import { html, render } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import '../../shared/styles/site.css';
import { mountIslands } from '../../shared/runtime/islands.js';
import { createSiteApp } from '../../shared/runtime/site.js';

const root = document.getElementById('root');

// Lit renders into the container without adopting existing markup, so remove the
// prerendered shell first or the booted app would append a second copy of the page.
root.replaceChildren();

const site = createSiteApp({
  async renderHtml(value) {
    render(html`<div>${unsafeHTML(value)}</div>`, root);
    await new Promise((resolve) => requestAnimationFrame(resolve));
  },
  mountIslands,
  getRoot: () => root,
});

site.start();

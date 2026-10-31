import '../../shared/styles/site.css';
import { mountIslands } from '../../shared/runtime/islands.js';
import { createSiteApp } from '../../shared/runtime/site.js';

const root = document.getElementById('root');

const app = createSiteApp({
  renderHtml(html) {
    root.innerHTML = html;
  },
  mountIslands,
});

app.start();

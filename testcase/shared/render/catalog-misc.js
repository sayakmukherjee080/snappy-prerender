import { link } from './base.js';

export function notFoundPage() {
  return `<section class="not-found"><div class="shell not-found__inner">
  <p class="eyebrow">404 / Off course</p>
  <h1>This page lost signal.</h1>
  <p class="lede">The route does not exist, or the satellite moved. Either way, the network is still up.</p>
  ${link('/', 'Return to orbit <span aria-hidden="true">→</span>', { className: 'button button--orange' })}
</div></section>`;
}

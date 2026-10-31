import { Head } from '../../../../src/head/index.js';

/**
 * Declares a noindex page so the sitemap and metadata checks have a real page to
 * exclude.
 */
export default function Private() {
  return (
    <section className="shell">
      <Head
        title="Private fixture"
        description="A page that must stay out of the sitemap."
        robots="noindex"
      />
      <p className="eyebrow">Test route</p>
      <h1>Private fixture</h1>
      <p className="lede">This route declares robots noindex.</p>
    </section>
  );
}

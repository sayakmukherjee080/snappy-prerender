import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import { prerender } from '../../src/core/index.js';
import { cleanup, makeStaticSite } from './support.js';

after(cleanup);

const options = (overrides = {}) => ({
  crawl: false,
  verify: true,
  audit: false,
  logLevel: 'silent',
  captureFormState: false,
  captureRuntimeStyles: false,
  ...overrides,
});

describe('prerender integration: framework parity and custom containers', () => {
  it('detects Angular, Ember and Lit, and accepts an explicit Solid framework', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': `<!doctype html><html><head><title>Angular</title></head><body>
        <app-root ng-version="22.2.4"><h1>Angular</h1></app-root>
      </body></html>`,
      'ember/index.html': `<!doctype html><html><head><title>Ember</title></head><body class="ember-application">
        <script>window.emberLoaded = true;</script>
        <div class="site-root"><h1>Ember</h1></div>
      </body></html>`,
      'lit/index.html': `<!doctype html><html><head><title>Lit</title></head><body>
        <div id="root"><h1>Lit</h1></div>
        <script>document.querySelector('#root')._$litPart$ = {};</script>
      </body></html>`,
      'solid/index.html': `<!doctype html><html><head><title>Solid</title></head><body>
        <div id="root"><h1>Solid</h1></div>
      </body></html>`,
    });
    const report = await prerender({
      ...options(),
      sourceDir,
      include: ['/', '/ember', '/lit', '/solid'],
      routeOverrides: [{ match: '/solid', framework: 'solid' }],
    });

    assert.equal(report.ok, true);
    assert.deepEqual(report.verification.frameworks, {
      angular: 1,
      ember: 1,
      lit: 1,
      solid: 1,
    });
    for (const entry of report.verification.routes) {
      assert.equal(entry.mode, 'hydrated', entry.route);
      assert.equal(entry.ok, true, entry.route);
    }
  });

  it('uses a custom container instead of the first body script', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': `<!doctype html><html><head><title>Custom</title></head><body>
        <script>window.loaded = true;</script>
        <div id="app-root"><h1>Custom root</h1></div>
      </body></html>`,
    });
    const report = await prerender({
      ...options(),
      sourceDir,
      include: ['/'],
      framework: 'react',
      container: '#app-root',
    });
    const entry = report.verification.routes.find((route) => route.route === '/');
    assert.equal(entry.framework, 'react');
    assert.equal(entry.mode, 'hydrated');
    assert.equal(entry.ok, true);
  });

  it('locates the first mismatch inside a custom container', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': `<!doctype html><html><head><title>Mismatch</title></head><body>
        <div id="app-root"><h1>Before</h1></div>
        <script>if (window.__snappyBoot) document.querySelector('#app-root').innerHTML = '<h1>After</h1>';</script>
      </body></html>`,
    });
    const report = await prerender({
      ...options(),
      sourceDir,
      include: ['/'],
      framework: 'react',
      container: '#app-root',
    });
    const entry = report.verification.routes.find((route) => route.route === '/');
    assert.equal(entry.mode, 're-rendered');
    assert.equal(entry.firstMismatch.kind, 'text');
    assert.equal(entry.firstMismatch.expected, 'Before');
    assert.equal(entry.firstMismatch.actual, 'After');
  });

  it('reports a missing custom container instead of silently using the body', async () => {
    const sourceDir = await makeStaticSite({
      'index.html': `<!doctype html><html><head><title>Missing</title></head><body>
        <div id="root"><h1>Missing root</h1></div>
      </body></html>`,
    });
    const report = await prerender({
      ...options(),
      sourceDir,
      include: ['/'],
      framework: 'react',
      container: '#not-there',
    });
    assert.equal(report.ok, false);
    assert.match(report.errors.map((error) => error.message).join('\n'), /container selector/);
  });
});

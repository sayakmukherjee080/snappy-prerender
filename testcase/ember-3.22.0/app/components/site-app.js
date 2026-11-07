import Component from '@ember/component';
import { mountIslands } from '../shared/runtime/islands';
import { createSiteApp } from '../shared/runtime/site';

/**
 * Hosts the shared site controller and renders its HTML through Ember 3.22.
 */
export default Component.extend({
  classNames: ['site-root'],

  didInsertElement() {
    this._super(...arguments);
    const element = this.element;
    try {
      const site = createSiteApp({
        async renderHtml(value) {
          element.innerHTML = value;
          await new Promise((resolve) => setTimeout(resolve, 0));
        },
        mountIslands,
        getRoot: () => element,
      });
      site.start();
    } catch (error) {
      element.innerHTML = `<pre style="padding:2rem;white-space:pre-wrap">${error.stack}</pre>`;
    }
  },
});

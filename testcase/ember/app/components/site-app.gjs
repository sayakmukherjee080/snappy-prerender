import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { htmlSafe } from '@ember/template';
import { modifier } from 'ember-modifier';
import '../../../shared/styles/site.css';
import { mountIslands } from '../../../shared/runtime/islands.js';
import { createSiteApp } from '../../../shared/runtime/site.js';

/**
 * Hosts the framework-agnostic site controller and renders its HTML through Ember.
 */
export default class SiteApp extends Component {
  @tracked html = htmlSafe('');

  setup = modifier((element) => {
    const component = this;
    component.root = element;
    component.site = createSiteApp({
      async renderHtml(value) {
        component.html = htmlSafe(value);
        await new Promise((resolve) => setTimeout(resolve, 0));
      },
      mountIslands,
      getRoot: () => component.root,
    });
    component.site.start();
  });

  <template>
    <div class="site-root" {{this.setup}}>{{this.html}}</div>
  </template>
}

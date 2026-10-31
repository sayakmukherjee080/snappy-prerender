import '@warp-drive/ember/install';
import Application from '@ember/application';
import setupInspector from '@embroider/legacy-inspector-support/ember-source-4.12';
import { importSync, isDevelopingApp, macroCondition } from '@embroider/macros';
import compatModules from '@embroider/virtual/compat-modules';
import config from 'aether-ember/config/environment';
import loadInitializers from 'ember-load-initializers';
import Resolver from 'ember-resolver';

// Ember mounts into <body> and appends its tree, so remove the prerendered app shell first
// or the booted app would render a second copy of the page underneath it.
document.querySelectorAll('body > .site-root').forEach((node) => node.remove());

if (macroCondition(isDevelopingApp())) {
  importSync('./deprecation-workflow');
}

export default class App extends Application {
  modulePrefix = config.modulePrefix;
  podModulePrefix = config.podModulePrefix;
  Resolver = Resolver.withModules(compatModules);
  inspector = setupInspector(this);
}

loadInitializers(App, config.modulePrefix, compatModules);

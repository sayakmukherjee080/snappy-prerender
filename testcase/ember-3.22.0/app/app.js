import Application from '@ember/application';
import loadInitializers from 'ember-load-initializers/index';
import config from 'ember322-test/config/environment';
import Resolver from 'ember322-test/resolver';

export default class App extends Application {
  modulePrefix = config.modulePrefix;
  podModulePrefix = config.podModulePrefix;
  Resolver = Resolver;
}

loadInitializers(App, config.modulePrefix);

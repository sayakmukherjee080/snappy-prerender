import EmberRouter from '@ember/routing/router';
import config from 'ember322-test/config/environment';

export default class Router extends EmberRouter {
  location = 'none';
  rootURL = config.rootURL;
}

Router.map(() => {});

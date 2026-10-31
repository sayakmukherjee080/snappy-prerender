import EmberRouter from '@embroider/router';
import config from 'aether-ember/config/environment';

export default class Router extends EmberRouter {
  location = 'none';
  rootURL = config.rootURL;
}

Router.map(() => {});

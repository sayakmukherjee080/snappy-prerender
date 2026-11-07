const EmberApp = require('ember-cli/lib/broccoli/ember-app');

module.exports = (defaults) => {
  const app = new EmberApp(defaults, {
    // The bundled clean-css in Ember CLI 3.22 calls the removed util.isRegExp API on
    // modern Node. The shared stylesheet is already written as compact, production CSS.
    minifyCSS: { enabled: false },
    minifyJS: { enabled: false },
  });

  return app.toTree();
};

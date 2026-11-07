// A prerendered document keeps the root class and application view from the capture
// pass. A static reload must begin with a clean Ember root before boot.
(function () {
  document.body.classList.remove('ember-application');
  document.querySelectorAll('body > .ember-view').forEach(function (element) {
    element.remove();
  });
})();

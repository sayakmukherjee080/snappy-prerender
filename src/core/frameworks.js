const REACT = (container) =>
  Object.keys(container).some(
    (key) => key.startsWith('__reactContainer') || key === '_reactRootContainer',
  );
const VUE = (container) =>
  Boolean(
    container.__vue_app__ ||
      container.__vueParentComponent ||
      container._vnode ||
      container.__vue__,
  );
const PREACT = (container) =>
  Boolean(
    container.__k ||
      container._children ||
      container.firstElementChild?.__k ||
      container.firstElementChild?._children,
  );
const SVELTE = (container) =>
  Boolean(
    container.__svelte_meta ||
      container.querySelector?.('[data-svelte-h]') ||
      container.ownerDocument?.defaultView?.__svelte ||
      (container.childNodes &&
        [...container.childNodes].some(
          (node) => node.nodeType === 8 && (node.data === '[' || node.data === '[!'),
        )),
  );

const DETECTORS = { react: REACT, vue: VUE, preact: PREACT, svelte: SVELTE };
const AUTO_ORDER = ['react', 'vue', 'preact', 'svelte'];

/**
 * Detects the framework that mounted into a container from its DOM markers. This is
 * observation only: no framework is imported or executed by the prerenderer.
 */
export function detectFramework(container, requested = 'auto') {
  if (!container) return { name: null, mounted: false };
  if (requested !== 'auto') {
    return { name: requested, mounted: Boolean(DETECTORS[requested]?.(container)) };
  }
  const markers = {
    react: REACT(container),
    vue: VUE(container),
    preact: PREACT(container),
    svelte: SVELTE(container),
  };
  return frameworkFromMarkers(markers, requested);
}

/**
 * Selects a framework from a plain marker map produced inside the page, where DOM
 * object identity is not available to Node.
 */
export function frameworkFromMarkers(markers, requested = 'auto') {
  if (requested !== 'auto') {
    return { name: requested, mounted: markers?.[requested] === true };
  }
  for (const name of AUTO_ORDER) {
    if (markers?.[name] === true) return { name, mounted: true };
  }
  return { name: null, mounted: false };
}

const COMMON_PATTERNS = [
  /react\.dev\/errors\/(418|419|421|422|423|424|425)/i,
  /Minified React error #(418|419|421|422|423|424|425)\b/i,
];

const FRAMEWORK_PATTERNS = {
  react: [
    ...COMMON_PATTERNS,
    /hydrat/i,
    /text content did not match/i,
    /prop [`"].+?[`"] did not match/i,
    /server-rendered HTML/i,
    /did not expect server HTML/i,
    /expected server HTML to contain/i,
  ],
  preact: [
    ...COMMON_PATTERNS,
    /hydrat/i,
    /text content did not match/i,
    /did not expect server HTML/i,
  ],
  vue: [/hydration (?:node|text|children) mismatch/i, /hydration-mismatch/i, /hydrat/i],
  svelte: [/hydration_mismatch/i, /hydration failed/i],
};

/**
 * Classifies a console or page error as a hydration failure for the detected framework.
 * Patterns stay narrow so an unrelated application error is not treated as a build gate.
 * With `auto`, every framework set is tried because the framework was not established.
 */
export function isHydrationError(message, framework = 'auto') {
  const text = String(message);
  const patterns =
    framework === 'auto'
      ? Object.values(FRAMEWORK_PATTERNS).flat()
      : [...(FRAMEWORK_PATTERNS[framework] ?? [])];
  return patterns.some((pattern) => pattern.test(text));
}

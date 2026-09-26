import { useEffect, useLayoutEffect, useRef } from 'react';
import { registerHead, unregisterHead } from './manager.js';
import { buildHeadEntries } from './tags.js';

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

let sequence = 0;

/**
 * Declares document metadata for the route being rendered: title, description, robots,
 * canonical, Open Graph and Twitter card tags. The head is reconciled on every render while
 * the component is mounted, so client-side navigation gives each route its own head exactly
 * like a site that renders a page per request.
 *
 * Renders nothing, so it never affects hydration of the page content.
 */
export function Head(props) {
  const idRef = useRef(null);
  const sequenceRef = useRef(0);

  if (idRef.current === null) {
    sequence += 1;
    idRef.current = `snappy-head-${sequence}`;
    // Render order decides precedence: a page's Head is rendered after the layout's, so it
    // wins for any tag they both set.
    sequenceRef.current = sequence;
  }

  const entries = buildHeadEntries(props, readDefaults());

  // A layout effect so a route change updates the head before the browser paints, and a
  // plain effect on the server, where layout effects never run.
  useIsomorphicLayoutEffect(() => {
    registerHead(idRef.current, sequenceRef.current, entries);
  });

  useEffect(() => () => unregisterHead(idRef.current), []);

  return null;
}

/**
 * Imperative equivalent for code that is not a React component, for example a vanilla
 * router or an analytics callback.
 */
export function setHead(id, props) {
  sequence += 1;
  registerHead(id, sequence, buildHeadEntries(props, readDefaults()));
}

/**
 * Removes metadata previously set with setHead.
 */
export function clearHead(id) {
  unregisterHead(id);
}

// Reads the defaults the prerenderer injected, so metadata composed during a build uses the
// public site URL rather than the local preview server.
function readDefaults() {
  return typeof window === 'undefined' ? {} : (window.__SNAPPY_META__ ?? {});
}

import { useEffect, useLayoutEffect, useRef } from 'react';
import { readMetadataDefaults, registerHead, unregisterHead } from './manager.js';
import { buildHeadEntries } from './tags.js';

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

let sequence = 0;

/**
 * Attribute names and values accepted by html, body, title and arbitrary head tags.
 * @typedef {Object<string, string | number | boolean | null | undefined>} HeadAttributes
 */

/**
 * One arbitrary head element.
 * @typedef {Object} HeadTag
 * @property {'script' | 'style' | 'noscript' | 'base'} tag
 * @property {HeadAttributes} [attrs]
 * @property {string | number} [text]
 * @property {string} [html] Trusted inner HTML for noscript only.
 * @property {string} [key]
 */

/**
 * One hreflang alternate.
 * @typedef {Object} HeadAlternate
 * @property {string} href
 * @property {string} [hreflang]
 * @property {string} [lang]
 * @property {string} [type]
 */

/**
 * Extra meta or link attributes. keys and duplicates are consumed by the head layer.
 * @typedef {Object<string, string | number | boolean | null | undefined>} HeadExtra
 */

/**
 * One merged head entry reported to onChangeClientState.
 * @typedef {Object} HeadEntry
 * @property {string} kind
 * @property {string} key
 * @property {Record<string, string>} [attrs]
 * @property {string} [text]
 * @property {string} [html]
 * @property {string} [value]
 */

/**
 * Entries grouped by kind for onChangeClientState.
 * @typedef {Object} HeadChangeState
 * @property {HeadEntry | null} title
 * @property {HeadEntry[]} meta
 * @property {HeadEntry[]} link
 * @property {HeadEntry[]} script
 * @property {HeadEntry[]} style
 * @property {HeadEntry[]} noscript
 * @property {HeadEntry[]} base
 * @property {HeadEntry[]} htmlAttributes
 * @property {HeadEntry[]} bodyAttributes
 * @property {HeadEntry[]} titleAttributes
 */

/**
 * @typedef {(state: HeadChangeState, added: HeadEntry[], removed: HeadEntry[]) => void} HeadChange
 */

/**
 * Props accepted by Head and setHead.
 * @typedef {Object} HeadProps
 * @property {string} [title]
 * @property {string} [defaultTitle]
 * @property {string} [titleTemplate]
 * @property {string} [siteName]
 * @property {string} [description]
 * @property {string} [robots]
 * @property {string} [type]
 * @property {string} [locale]
 * @property {string | false} [canonical]
 * @property {string} [image]
 * @property {string[]} [images]
 * @property {string[]} [alternateLocales]
 * @property {string} [lang]
 * @property {'ltr' | 'rtl' | 'auto'} [dir]
 * @property {boolean} [openGraph]
 * @property {boolean} [twitter]
 * @property {HeadAlternate[]} [alternates]
 * @property {unknown} [structuredData]
 * @property {HeadExtra[]} [extra]
 * @property {HeadTag[]} [tags]
 * @property {HeadAttributes} [htmlAttributes]
 * @property {HeadAttributes} [bodyAttributes]
 * @property {HeadAttributes} [titleAttributes]
 * @property {HeadChange} [onChangeClientState]
 */

/**
 * Declares document metadata for the route being rendered: title, description, robots,
 * canonical, Open Graph and Twitter card tags, plus arbitrary head tags and html, body and
 * title attributes. The head is reconciled on every render while the component is mounted,
 * so client-side navigation gives each route its own head exactly like a site that renders a
 * page per request.
 *
 * Renders nothing, so it never affects hydration of the page content.
 * @param {HeadProps} props
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

  const entries = buildHeadEntries(props, readMetadataDefaults(), idRef.current);

  // A layout effect so a route change updates the head before the browser paints, and a
  // plain effect on the server, where layout effects never run.
  useIsomorphicLayoutEffect(() => {
    registerHead(idRef.current, sequenceRef.current, entries, props.onChangeClientState ?? null);
  });

  useEffect(() => () => unregisterHead(idRef.current), []);

  return null;
}

/**
 * Imperative equivalent for code that is not a React component, for example a vanilla
 * router or an analytics callback.
 * @param {string} id
 * @param {HeadProps} props
 */
export function setHead(id, props) {
  sequence += 1;
  registerHead(
    id,
    sequence,
    buildHeadEntries(props, readMetadataDefaults(), id),
    props.onChangeClientState ?? null,
  );
}

/**
 * Removes metadata previously set with setHead.
 * @param {string} id
 */
export function clearHead(id) {
  unregisterHead(id);
}

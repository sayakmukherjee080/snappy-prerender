import CleanCSS from 'clean-css';
import { minify as minifyMarkup } from 'html-minifier-terser';

/**
 * Options matching react-snap's defaults, kept as the baseline so behaviour is
 * familiar. Whitespace collapsing can change text nodes, which React notices during
 * hydration, so minification stays opt-in and the hydration verifier is the check.
 */
const HTML_MINIFY_DEFAULTS = {
  collapseBooleanAttributes: true,
  collapseWhitespace: true,
  decodeEntities: true,
  keepClosingSlash: true,
  sortAttributes: true,
  sortClassName: false,
};

/**
 * Minifies serialised HTML. `minifyCss` options are forwarded so styles inlined into
 * the document are minified in the same pass. html-minifier-terser is async, so this
 * resolves to the minified markup.
 */
export async function minifyHtml(html, options = {}, minifyCssOptions = false) {
  const merged = {
    ...HTML_MINIFY_DEFAULTS,
    ...(options === true ? {} : options),
  };
  if (minifyCssOptions) merged.minifyCSS = minifyCssOptions === true ? {} : minifyCssOptions;
  return minifyMarkup(html, merged);
}

/**
 * Minifies a CSS string with clean-css, used for stylesheets inlined by the
 * inlineCss feature.
 */
export function minifyCss(css, options = {}) {
  const result = new CleanCSS(options === true ? {} : options).minify(css);
  if (result.errors.length > 0) {
    throw new Error(`CSS minification failed: ${result.errors.join('; ')}`);
  }
  return result.styles;
}

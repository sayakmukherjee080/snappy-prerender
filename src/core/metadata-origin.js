const BUILD_ORIGIN = /https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?![\w.:-])/gi;

/**
 * Recognises the metadata tags whose value is an absolute URL, and finds URLs pointing at a
 * local build server inside them. Dependency-free on purpose, so the browser-side head entry
 * can share the same pattern instead of shipping a second copy of it.
 */
export function isMetadataUrlNode(node) {
  if (node.tagName === 'link') return attributeValue(node, 'rel').toLowerCase() === 'canonical';
  if (node.tagName !== 'meta') return false;
  return isUrlKey(attributeValue(node, 'property') || attributeValue(node, 'name'));
}

// Reads the URL a metadata tag carries.
export function metadataUrlValue(node) {
  return node.tagName === 'link' ? attributeValue(node, 'href') : attributeValue(node, 'content');
}

/**
 * Collects the build server origins a value points at, de-duplicated and capped so one long
 * value cannot flood a warning.
 */
export function collectBuildOrigins(text, limit = 3) {
  const matches = String(text ?? '').match(BUILD_ORIGIN) ?? [];
  return [...new Set(matches)].slice(0, limit);
}

/**
 * Scans a serialized document for build-server origins. Used only when the optional
 * `failOnBuildOriginMetadata` gate is enabled, so a caller that turns stripping off can
 * still make loopback metadata a build failure.
 */
export function findBuildOriginUrls(html) {
  return collectBuildOrigins(html);
}

// Reports whether a meta key names a URL, such as og:url, og:image or twitter:image.
function isUrlKey(key) {
  const [prefix, ...rest] = key.toLowerCase().split(':');
  if (prefix !== 'og' && prefix !== 'twitter') return false;
  const last = rest.at(-1);
  return last === 'url' || last === 'image' || last === 'secure_url';
}

// Reads an attribute value, defaulting to an empty string.
function attributeValue(node, name) {
  return node.attrs?.find((attribute) => attribute.name === name)?.value ?? '';
}

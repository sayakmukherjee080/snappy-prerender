import { parse } from 'parse5';
import { collectBuildOrigins, isMetadataUrlNode, metadataUrlValue } from './metadata-origin.js';

/**
 * Collects build-server origins from the metadata URLs in a serialized document.
 * Only canonical and URL-bearing social tags are inspected, so a loopback API URL in
 * application state does not trip the optional build-origin gate.
 */
export function findBuildOriginUrls(html) {
  const origins = new Set();
  const walk = (node) => {
    if (isMetadataUrlNode(node)) {
      for (const origin of collectBuildOrigins(metadataUrlValue(node))) origins.add(origin);
    }
    for (const child of node.childNodes ?? []) walk(child);
  };
  walk(parse(html));
  return [...origins].slice(0, 3);
}

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectBuildOrigins,
  isMetadataUrlNode,
  metadataUrlValue,
} from '../../src/core/metadata-origin.js';

// Builds the minimal parse5-shaped node the scanner reads.
const node = (tagName, attrs = {}) => ({
  tagName,
  attrs: Object.entries(attrs).map(([name, value]) => ({ name, value })),
});

describe('metadata URL scanning', () => {
  it('recognises canonical links and URL-bearing metas only', () => {
    assert.equal(
      isMetadataUrlNode(node('link', { rel: 'canonical', href: 'https://a.example/x' })),
      true,
    );
    assert.equal(
      isMetadataUrlNode(node('meta', { property: 'og:url', content: 'https://a.example' })),
      true,
    );
    assert.equal(
      isMetadataUrlNode(node('meta', { name: 'twitter:image', content: 'https://a.example/i' })),
      true,
    );
    assert.equal(
      isMetadataUrlNode(node('meta', { property: 'og:title', content: 'https://a.example' })),
      false,
    );
    assert.equal(
      isMetadataUrlNode(node('meta', { name: 'description', content: 'http://localhost:1' })),
      false,
    );
    assert.equal(isMetadataUrlNode(node('script')), false);
    assert.equal(isMetadataUrlNode(node('link', { rel: 'preload', href: '/a.js' })), false);
  });

  it('reads the URL-bearing attribute for each tag', () => {
    assert.equal(metadataUrlValue(node('link', { rel: 'canonical', href: '/a' })), '/a');
    assert.equal(metadataUrlValue(node('meta', { property: 'og:url', content: '/b' })), '/b');
    assert.equal(metadataUrlValue(node('meta', { property: 'og:url' })), '');
  });

  it('collects, de-duplicates and caps build origins', () => {
    assert.deepEqual(collectBuildOrigins('http://127.0.0.1:5500/a and http://127.0.0.1:5500/b'), [
      'http://127.0.0.1:5500',
    ]);
    assert.deepEqual(
      collectBuildOrigins(
        'http://localhost:1 http://localhost:2 http://localhost:3 http://localhost:4',
      ),
      ['http://localhost:1', 'http://localhost:2', 'http://localhost:3'],
    );
    assert.deepEqual(collectBuildOrigins('/assets/app.js'), []);
    assert.deepEqual(collectBuildOrigins(undefined), []);
  });
});

import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { createLogger } from '../../src/core/log.js';

const originals = new Map([
  [process.stdout, process.stdout.write],
  [process.stderr, process.stderr.write],
]);
const initialEnv = { FORCE_COLOR: process.env.FORCE_COLOR, NO_COLOR: process.env.NO_COLOR };

afterEach(() => {
  for (const [stream, write] of originals) stream.write = write;
  for (const key of ['FORCE_COLOR', 'NO_COLOR']) {
    if (initialEnv[key] === undefined) delete process.env[key];
    else process.env[key] = initialEnv[key];
  }
});

/**
 * Captures everything written to one stream for the duration of a single call, so
 * logger behaviour can be asserted without touching the real terminal.
 */
function capture(stream, run) {
  let output = '';
  stream.write = (chunk) => {
    output += chunk;
    return true;
  };
  try {
    run();
  } finally {
    stream.write = originals.get(stream);
  }
  return output;
}

describe('createLogger', () => {
  it('colours stderr independently of stdout being a TTY', () => {
    process.env.FORCE_COLOR = '1';
    delete process.env.NO_COLOR;
    const log = createLogger('info');
    const output = capture(process.stderr, () => log.warn('careful'));
    assert.equal(output.includes('\u001b['), true);
    assert.match(output, /careful/);
  });

  it('disables colour when FORCE_COLOR is 0', () => {
    process.env.FORCE_COLOR = '0';
    const log = createLogger('info');
    const output = capture(process.stderr, () => log.warn('plain'));
    assert.equal(output.includes('\u001b['), false);
    assert.match(output, /plain/);
  });

  it('suppresses output below the configured level', () => {
    process.env.FORCE_COLOR = '0';
    const log = createLogger('warn');
    const info = capture(process.stdout, () => log.info('hidden'));
    const warn = capture(process.stderr, () => log.warn('shown'));
    assert.equal(info, '');
    assert.match(warn, /shown/);
  });

  it('writes nothing at silent level', () => {
    const log = createLogger('silent');
    assert.equal(
      capture(process.stdout, () => log.info('no')),
      '',
    );
    assert.equal(
      capture(process.stderr, () => log.error('no')),
      '',
    );
  });
});

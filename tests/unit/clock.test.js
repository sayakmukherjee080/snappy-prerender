import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { resolveFixedTime } from '../../src/core/clock.js';

const originalSourceDate = process.env.SOURCE_DATE_EPOCH;

afterEach(() => {
  if (originalSourceDate === undefined) delete process.env.SOURCE_DATE_EPOCH;
  else process.env.SOURCE_DATE_EPOCH = originalSourceDate;
});

describe('resolveFixedTime', () => {
  it('leaves the clock alone when freezeTime is false', () => {
    assert.equal(resolveFixedTime({ freezeTime: false }), null);
  });

  it('uses an explicit ISO string', () => {
    assert.equal(
      resolveFixedTime({ freezeTime: '2026-05-04T12:00:00Z' }),
      Date.parse('2026-05-04T12:00:00Z'),
    );
  });

  it('uses an explicit epoch value', () => {
    assert.equal(resolveFixedTime({ freezeTime: 1777896000000 }), 1777896000000);
  });

  it('prefers SOURCE_DATE_EPOCH over the run start when freezeTime is true', () => {
    process.env.SOURCE_DATE_EPOCH = '1777896000';
    assert.equal(resolveFixedTime({ freezeTime: true }, 1), 1777896000000);
  });

  it('falls back to the run start when SOURCE_DATE_EPOCH is absent', () => {
    delete process.env.SOURCE_DATE_EPOCH;
    assert.equal(resolveFixedTime({ freezeTime: true }, 1234), 1234);
  });

  it('ignores a malformed SOURCE_DATE_EPOCH', () => {
    process.env.SOURCE_DATE_EPOCH = 'not-a-number';
    assert.equal(resolveFixedTime({ freezeTime: true }, 1234), 1234);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldRunCheck } from './validate-change.ts';

describe('validate-change hook', () => {
  it('skips the check when the session did not edit packages', () => {
    assert.equal(shouldRunCheck({ session_id: 'session-1' }, []), false);
  });

  it('runs the check when the session edited packages', () => {
    assert.equal(shouldRunCheck({ session_id: 'session-1' }, ['samples/simple']), true);
  });

  it('skips the check when the stop hook is already active', () => {
    assert.equal(
      shouldRunCheck({ session_id: 'session-1', stop_hook_active: true }, ['samples/simple']),
      false,
    );
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { idleSessionID, isFileEditingTool } from './validate-change.ts';

describe('validate-change plugin', () => {
  for (const tool of ['edit', 'write', 'apply_patch']) {
    it(`treats the ${tool} tool as a file edit`, () => {
      assert.equal(isFileEditingTool(tool), true);
    });
  }

  for (const tool of ['read', 'bash', 'grep', 'glob', 'webfetch']) {
    it(`does not treat the ${tool} tool as a file edit`, () => {
      assert.equal(isFileEditingTool(tool), false);
    });
  }

  it('returns the session id when the session becomes idle', () => {
    assert.equal(
      idleSessionID({
        type: 'session.status',
        properties: { sessionID: 'session-1', status: { type: 'idle' } },
      }),
      'session-1',
    );
  });

  it('does not return a session id when the session becomes busy', () => {
    assert.equal(
      idleSessionID({
        type: 'session.status',
        properties: { sessionID: 'session-1', status: { type: 'busy' } },
      }),
      undefined,
    );
  });

  it('does not return a session id for other events', () => {
    assert.equal(
      idleSessionID({ type: 'session.compacted', properties: { sessionID: 'session-1' } }),
      undefined,
    );
  });
});

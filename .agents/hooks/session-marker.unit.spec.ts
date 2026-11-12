import assert from 'node:assert/strict';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  markerPath,
  parseHookInput,
  sessionMarkerName,
} from './session-marker.ts';

describe('session marker', () => {
  it('reads the hook fields from JSON input', () => {
    assert.deepEqual(
      parseHookInput(
        JSON.stringify({
          cwd: '/repository',
          session_id: 'session-1',
          stop_hook_active: true,
          tool_input: { file_path: '/repository/samples/simple/index.ts' },
        }),
      ),
      {
        cwd: '/repository',
        session_id: 'session-1',
        stop_hook_active: true,
        tool_input: { file_path: '/repository/samples/simple/index.ts' },
      },
    );
  });

  for (const text of ['', 'not json', 'null', '42']) {
    it(`treats hook input ${JSON.stringify(text)} as empty`, () => {
      assert.deepEqual(parseHookInput(text), {});
    });
  }

  it('uses a session id made of letters, digits, dashes and underscores as the marker name', () => {
    assert.equal(sessionMarkerName({ session_id: 'Session_1-a' }), 'Session_1-a');
  });

  for (const sessionId of ['', '../escape', 'nested/session', '..', 'C:\\session', 42]) {
    it(`does not use session id ${JSON.stringify(sessionId)} as the marker name`, () => {
      assert.equal(
        sessionMarkerName({ session_id: sessionId as string }),
        undefined,
      );
    });
  }

  it('places the session marker in the agent check cache of the repository', () => {
    assert.equal(
      markerPath({ session_id: 'session-1' }, '/repository'),
      join('/repository', 'node_modules/.cache/agent-check/session-1'),
    );
  });

  it('has no session marker when the session id is not valid', () => {
    assert.equal(markerPath({ session_id: '../escape' }, '/repository'), undefined);
  });
});

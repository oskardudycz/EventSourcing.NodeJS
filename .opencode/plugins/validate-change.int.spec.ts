import type { PluginInput } from '@opencode-ai/plugin';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { checkRuns, createRepository, removeRepositories } from '../../.agents/hooks/fake-repository.ts';
import { ValidateChangePlugin } from './validate-change.ts';

const failedToast = {
  body: {
    message: '`npm run fix` and `npm run build:ts` failed. See the OpenCode log.',
    variant: 'error',
  },
};

const startPlugin = async (packages: Record<string, 0 | 1>) => {
  const worktree = await createRepository(packages);
  const toasts: unknown[] = [];
  const logs: { body: { message: string } }[] = [];
  const client = {
    app: {
      log: async (options: { body: { message: string } }) => {
        logs.push(options);
        return true;
      },
    },
    tui: {
      showToast: async (options: unknown) => {
        toasts.push(options);
        return true;
      },
    },
  };

  const hooks = await ValidateChangePlugin({
    client,
    worktree,
    directory: worktree,
  } as unknown as PluginInput);

  const useTool = (sessionID: string, tool: string, args: Record<string, unknown> = {}) =>
    hooks['tool.execute.after']!(
      { tool, sessionID, callID: `${tool}-call`, args },
      { title: tool, output: '', metadata: {} },
    );

  const editFile = (sessionID: string, file: string) =>
    useTool(sessionID, 'edit', { filePath: join(worktree, file) });

  const becomeIdle = (sessionID: string) =>
    hooks.event!({
      event: {
        type: 'session.status',
        properties: { sessionID, status: { type: 'idle' } },
      },
    });

  return { worktree, toasts, logs, useTool, editFile, becomeIdle };
};

describe('validate-change OpenCode plugin', { concurrency: true }, () => {
  after(removeRepositories);

  it('does not run the check when the session goes idle without edits', async () => {
    const plugin = await startPlugin({ 'samples/simple': 1 });

    await plugin.becomeIdle('session-1');

    assert.deepEqual(await checkRuns(plugin.worktree), []);
    assert.deepEqual(plugin.toasts, []);
  });

  it('does not run the check when the session only used tools that do not edit files', async () => {
    const plugin = await startPlugin({ 'samples/simple': 1 });

    await plugin.useTool('session-1', 'read', { filePath: join(plugin.worktree, 'samples/simple/src/index.ts') });
    await plugin.useTool('session-1', 'bash');
    await plugin.becomeIdle('session-1');

    assert.deepEqual(await checkRuns(plugin.worktree), []);
  });

  it('runs the check once in the edited package when it passes', async () => {
    const plugin = await startPlugin({ 'samples/simple': 0, 'samples/decider': 1 });

    await plugin.editFile('session-1', 'samples/simple/src/index.ts');
    await plugin.becomeIdle('session-1');
    await plugin.becomeIdle('session-1');

    assert.deepEqual(await checkRuns(plugin.worktree), ['samples/simple fix', 'samples/simple build:ts']);
    assert.deepEqual(plugin.toasts, []);
    assert.deepEqual(plugin.logs, []);
  });

  it('runs the check in every package a patch changes', async () => {
    const plugin = await startPlugin({ 'samples/simple': 0, 'samples/decider': 0 });

    await plugin.useTool('session-1', 'apply_patch', {
      patchText: [
        '*** Begin Patch',
        '*** Update File: samples/simple/src/index.ts',
        '*** Add File: samples/decider/src/added.ts',
        '*** End Patch',
      ].join('\n'),
    });
    await plugin.becomeIdle('session-1');

    assert.deepEqual(await checkRuns(plugin.worktree), [
      'samples/simple fix',
      'samples/simple build:ts',
      'samples/decider fix',
      'samples/decider build:ts',
    ]);
  });

  it('shows an error toast when the check fails, and checks again on the next idle', async () => {
    const plugin = await startPlugin({ 'samples/simple': 1 });

    await plugin.editFile('session-1', 'samples/simple/src/index.ts');
    await plugin.becomeIdle('session-1');
    await plugin.becomeIdle('session-1');

    assert.equal((await checkRuns(plugin.worktree)).length, 4);
    assert.deepEqual(plugin.toasts, [failedToast, failedToast]);
    assert.equal(plugin.logs.length, 2);
    assert.match(plugin.logs[0]!.body.message, /build:ts output in .*samples\/simple/);
  });

  it('does not start a second check when the session goes idle again while the check runs', async () => {
    const plugin = await startPlugin({ 'samples/simple': 0 });

    await plugin.editFile('session-1', 'samples/simple/src/index.ts');
    await Promise.all([plugin.becomeIdle('session-1'), plugin.becomeIdle('session-1')]);

    assert.deepEqual(await checkRuns(plugin.worktree), ['samples/simple fix', 'samples/simple build:ts']);
  });

  it('runs the check only for the session that edited files', async () => {
    const plugin = await startPlugin({ 'samples/simple': 0 });

    await plugin.editFile('session-a', 'samples/simple/src/index.ts');
    await plugin.becomeIdle('session-b');
    const runsAfterOtherSessionIdle = await checkRuns(plugin.worktree);
    await plugin.becomeIdle('session-a');

    assert.deepEqual(runsAfterOtherSessionIdle, []);
    assert.equal((await checkRuns(plugin.worktree)).length, 2);
  });
});

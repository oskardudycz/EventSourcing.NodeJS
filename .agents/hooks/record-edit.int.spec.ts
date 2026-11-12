import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { createRepository, removeRepositories, runHook } from './fake-repository.ts';
import { recordEdit } from './record-edit.ts';

const hookScript = join(import.meta.dirname, 'record-edit.ts');

const marker = (root: string) =>
  join(root, 'node_modules/.cache/agent-check/session-1');

const recordedPackages = async (root: string) => {
  try {
    return (await readFile(marker(root), 'utf8')).split('\n').filter(Boolean);
  } catch {
    return undefined;
  }
};

const edit = (root: string, file: string, cwd = root) => ({
  cwd,
  session_id: 'session-1',
  tool_input: { file_path: join(root, file) },
});

describe('record-edit hook', { concurrency: true }, () => {
  after(removeRepositories);

  it('records the package of the edited file from the hook script input', async () => {
    const root = await createRepository({ 'samples/simple': 0 });

    const run = await runHook(hookScript, edit(root, 'samples/simple/src/index.ts'));

    assert.deepEqual(run, { exitCode: 0, stdout: '', stderr: '' });
    assert.deepEqual(await recordedPackages(root), ['samples/simple']);
  });

  it('records each edited package once', async () => {
    const root = await createRepository({ 'samples/simple': 0, 'samples/decider': 0 });

    recordEdit(edit(root, 'samples/simple/src/index.ts'));
    recordEdit(edit(root, 'samples/decider/src/index.ts'));
    recordEdit(edit(root, 'samples/simple/src/other.ts'));

    assert.deepEqual(await recordedPackages(root), ['samples/simple', 'samples/decider']);
  });

  it('records every package a patch changes, relative to the working directory', async () => {
    const root = await createRepository({ 'samples/simple': 0, 'workshops/event_driven_architecture': 0 });

    recordEdit({
      cwd: join(root, 'samples'),
      session_id: 'session-1',
      tool_input: {
        command: [
          '*** Begin Patch',
          '*** Update File: simple/src/index.ts',
          '*** Add File: ../workshops/event_driven_architecture/src/added.ts',
          '*** End Patch',
        ].join('\n'),
      },
    });

    assert.deepEqual(await recordedPackages(root), [
      'samples/simple',
      'workshops/event_driven_architecture',
    ]);
  });

  it('records the edit in the repository root when the session works in a subdirectory', async () => {
    const root = await createRepository({ 'samples/simple': 0 });

    recordEdit(edit(root, 'samples/simple/src/index.ts', join(root, 'samples/simple')));

    assert.deepEqual(await recordedPackages(root), ['samples/simple']);
  });

  it('does not record an edit outside of any package', async () => {
    const root = await createRepository({ 'samples/simple': 0 });

    recordEdit(edit(root, 'README.md'));

    assert.equal(await recordedPackages(root), undefined);
  });

  it('does not record the edit when the session id is not valid', async () => {
    const root = await createRepository({ 'samples/simple': 0 });

    recordEdit({ ...edit(root, 'samples/simple/src/index.ts'), session_id: '../escape' });

    assert.equal(await recordedPackages(root), undefined);
  });

  it('does not fail when the edit cannot be recorded', async () => {
    const root = await createRepository({ 'samples/simple': 0 });
    await writeFile(join(root, 'node_modules'), '');

    assert.doesNotThrow(() => recordEdit(edit(root, 'samples/simple/src/index.ts')));
  });
});

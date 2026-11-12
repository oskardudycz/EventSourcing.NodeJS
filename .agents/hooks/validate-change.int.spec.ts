import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { checkRuns, createRepository, removeRepositories, runHook } from './fake-repository.ts';
import { recordEdit } from './record-edit.ts';
import { validateChangedSession } from './validate-change.ts';

const stopScript = join(import.meta.dirname, 'validate-change.ts');
const recordEditScript = join(import.meta.dirname, 'record-edit.ts');

const stop = (root: string) => ({ cwd: root, session_id: 'session-1' });

const edit = (root: string, file: string) => ({
  ...stop(root),
  tool_input: { file_path: join(root, file) },
});

describe('validate-change hook', { concurrency: true }, () => {
  after(removeRepositories);

  it('passes without running the check when the session did not edit files', async () => {
    const root = await createRepository({ 'samples/simple': 1 });

    const result = await validateChangedSession(stop(root));

    assert.deepEqual(result, { ok: true, output: '' });
    assert.deepEqual(await checkRuns(root), []);
  });

  it('runs fix and build only in the edited packages, once, when they pass', async () => {
    const root = await createRepository({
      'samples/simple': 0,
      'samples/decider': 0,
      'samples/snapshots': 1,
    });

    recordEdit(edit(root, 'samples/simple/src/index.ts'));
    recordEdit(edit(root, 'samples/decider/src/index.ts'));
    const firstResult = await validateChangedSession(stop(root));
    const secondResult = await validateChangedSession(stop(root));

    assert.equal(firstResult.ok, true);
    assert.deepEqual(secondResult, { ok: true, output: '' });
    assert.deepEqual(await checkRuns(root), [
      'samples/simple fix',
      'samples/simple build:ts',
      'samples/decider fix',
      'samples/decider build:ts',
    ]);
  });

  it('checks again on the next stop only the packages that failed', async () => {
    const root = await createRepository({ 'samples/simple': 0, 'samples/decider': 1 });

    recordEdit(edit(root, 'samples/simple/src/index.ts'));
    recordEdit(edit(root, 'samples/decider/src/index.ts'));
    const firstResult = await validateChangedSession(stop(root));
    const secondResult = await validateChangedSession(stop(root));

    assert.equal(firstResult.ok, false);
    assert.match(firstResult.output, /Check failed in samples\/decider\./);
    assert.match(firstResult.output, /build:ts output in .*samples\/decider/);
    assert.doesNotMatch(firstResult.output, /samples\/simple/);
    assert.equal(secondResult.ok, false);
    assert.deepEqual(await checkRuns(root), [
      'samples/simple fix',
      'samples/simple build:ts',
      'samples/decider fix',
      'samples/decider build:ts',
      'samples/decider fix',
      'samples/decider build:ts',
    ]);
  });

  it('does not build when fix fails', async () => {
    const root = await createRepository({ 'samples/simple': 0 });
    await writeFile(
      join(root, 'samples/simple/package.json'),
      JSON.stringify({ scripts: { fix: 'node check.cjs fix && exit 1', 'build:ts': 'node check.cjs build:ts' } }),
    );

    recordEdit(edit(root, 'samples/simple/src/index.ts'));
    const result = await validateChangedSession(stop(root));

    assert.equal(result.ok, false);
    assert.deepEqual(await checkRuns(root), ['samples/simple fix']);
  });
});

describe('validate-change hook script', { concurrency: true }, () => {
  after(removeRepositories);

  it('passes without running the check when the session did not edit files', async () => {
    const root = await createRepository({ 'samples/simple': 1 });

    const run = await runHook(stopScript, stop(root));

    assert.deepEqual(run, { exitCode: 0, stdout: '', stderr: '' });
    assert.deepEqual(await checkRuns(root), []);
  });

  it('passes after an edit when the check passes', async () => {
    const root = await createRepository({ 'samples/simple': 0 });

    const mark = await runHook(recordEditScript, edit(root, 'samples/simple/src/index.ts'));
    const run = await runHook(stopScript, stop(root));

    assert.deepEqual(mark, { exitCode: 0, stdout: '', stderr: '' });
    assert.deepEqual(run, { exitCode: 0, stdout: '', stderr: '' });
    assert.deepEqual(await checkRuns(root), ['samples/simple fix', 'samples/simple build:ts']);
  });

  it('blocks with the check output after an edit when the check fails', async () => {
    const root = await createRepository({ 'samples/simple': 1 });

    await runHook(recordEditScript, edit(root, 'samples/simple/src/index.ts'));
    const run = await runHook(stopScript, stop(root));

    assert.equal(run.exitCode, 2);
    assert.match(run.stderr, /`npm run fix` and `npm run build:ts` failed\./);
    assert.match(run.stderr, /Check failed in samples\/simple\./);
    assert.match(run.stderr, /build:ts output/);
  });

  it('skips the check when the stop hook is already active', async () => {
    const root = await createRepository({ 'samples/simple': 1 });

    await runHook(recordEditScript, edit(root, 'samples/simple/src/index.ts'));
    const run = await runHook(stopScript, { ...stop(root), stop_hook_active: true });

    assert.deepEqual(run, { exitCode: 0, stdout: '', stderr: '' });
    assert.deepEqual(await checkRuns(root), []);
  });
});

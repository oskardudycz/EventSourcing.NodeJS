import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { editedFiles, packageOf } from './edited-packages.ts';

describe('edited files', () => {
  it('reads the file path of a Claude Code edit', () => {
    assert.deepEqual(
      editedFiles({ file_path: '/repository/samples/simple/src/index.ts' }, '/repository'),
      ['/repository/samples/simple/src/index.ts'],
    );
  });

  it('reads the notebook path of a Claude Code notebook edit', () => {
    assert.deepEqual(
      editedFiles({ notebook_path: '/repository/samples/simple/notes.ipynb' }, '/repository'),
      ['/repository/samples/simple/notes.ipynb'],
    );
  });

  it('reads the file path of an OpenCode edit relative to the working directory', () => {
    assert.deepEqual(
      editedFiles({ filePath: 'samples/simple/src/index.ts' }, '/repository'),
      ['/repository/samples/simple/src/index.ts'],
    );
  });

  it('reads every file a patch adds, updates, moves or deletes', () => {
    const patch = [
      '*** Begin Patch',
      '*** Add File: samples/simple/src/added.ts',
      '+export const added = 1;',
      '*** Update File: samples/decider/src/updated.ts',
      '*** Move to: samples/decider/src/moved.ts',
      '@@',
      '-old',
      '+new',
      '*** Delete File: workshops/event_driven_architecture/src/deleted.ts',
      '*** End Patch',
    ].join('\n');

    const expected = [
      '/repository/samples/simple/src/added.ts',
      '/repository/samples/decider/src/updated.ts',
      '/repository/samples/decider/src/moved.ts',
      '/repository/workshops/event_driven_architecture/src/deleted.ts',
    ];

    assert.deepEqual(editedFiles({ command: patch }, '/repository'), expected);
    assert.deepEqual(editedFiles({ patchText: patch }, '/repository'), expected);
  });

  for (const toolInput of [undefined, null, 'text', {}, { file_path: 42 }]) {
    it(`finds no files in tool input ${JSON.stringify(toolInput)}`, () => {
      assert.deepEqual(editedFiles(toolInput, '/repository'), []);
    });
  }
});

describe('package of an edited file', () => {
  let root = '';

  before(async () => {
    root = await mkdtemp(join(tmpdir(), 'edited-packages-unit-'));
    await writeFile(join(root, 'package.json'), '{}');
    await mkdir(join(root, 'samples/simple/src/core'), { recursive: true });
    await writeFile(join(root, 'samples/simple/package.json'), '{}');
    await mkdir(join(root, 'samples/simple/node_modules/library'), { recursive: true });
    await writeFile(join(root, 'samples/simple/node_modules/library/package.json'), '{}');
    await mkdir(join(root, 'docs'), { recursive: true });
  });

  after(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('is the nearest folder with package.json', () => {
    assert.equal(
      packageOf(join(root, 'samples/simple/src/core/index.ts'), root),
      join('samples', 'simple'),
    );
  });

  it('is the package folder for its own package.json', () => {
    assert.equal(packageOf(join(root, 'samples/simple/package.json'), root), join('samples', 'simple'));
  });

  it('is found for a file that does not exist yet', () => {
    assert.equal(
      packageOf(join(root, 'samples/simple/src/new_folder/new.ts'), root),
      join('samples', 'simple'),
    );
  });

  it('is not the repository root', () => {
    assert.equal(packageOf(join(root, 'README.md'), root), undefined);
    assert.equal(packageOf(join(root, 'docs/guide.md'), root), undefined);
  });

  it('is not a dependency in node_modules', () => {
    assert.equal(
      packageOf(join(root, 'samples/simple/node_modules/library/index.js'), root),
      undefined,
    );
  });

  it('is not outside the repository', () => {
    assert.equal(packageOf(join(tmpdir(), 'elsewhere/index.ts'), root), undefined);
  });
});

import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const patchFileLine = /^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/gm;

const patchFiles = (patch: string) =>
  [...patch.matchAll(patchFileLine)].map((match) => match[1]!.trim());

export function editedFiles(toolInput: unknown, cwd: string) {
  if (typeof toolInput !== 'object' || toolInput === null) {
    return [];
  }

  const input = toolInput as Record<string, unknown>;
  const paths = [input.file_path, input.notebook_path, input.filePath].filter(
    (path) => typeof path === 'string',
  );
  const patches = [input.command, input.patchText].filter(
    (patch) => typeof patch === 'string',
  );

  return [...paths, ...patches.flatMap(patchFiles)].map((path) =>
    resolve(cwd, path),
  );
}

export function packageOf(file: string, root: string) {
  const path = relative(root, file);

  if (path.startsWith('..') || isAbsolute(path) || path.split(sep).includes('node_modules')) {
    return undefined;
  }

  for (let directory = dirname(path); directory !== '.'; directory = dirname(directory)) {
    if (existsSync(join(root, directory, 'package.json'))) {
      return directory;
    }
  }

  return undefined;
}

export function editedPackages(toolInput: unknown, cwd: string, root: string) {
  return [
    ...new Set(
      editedFiles(toolInput, cwd).flatMap((file) => packageOf(file, root) ?? []),
    ),
  ];
}

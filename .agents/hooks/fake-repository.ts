import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

type BuildExitCode = 0 | 1;

const repositories: string[] = [];

export const createRepository = async (
  packages: Record<string, BuildExitCode> = {},
) => {
  const root = await mkdtemp(join(tmpdir(), 'agent-check-'));
  repositories.push(root);

  await execFileAsync('git', ['init', '--quiet'], { cwd: root });
  await writeFile(join(root, 'package.json'), '{}');

  for (const [path, buildExitCode] of Object.entries(packages)) {
    const directory = join(root, path);
    await mkdir(join(directory, 'src'), { recursive: true });
    await writeFile(
      join(directory, 'check.cjs'),
      [
        `const script = process.argv[2];`,
        `require('node:fs').appendFileSync(${JSON.stringify(join(root, 'runs'))}, ${JSON.stringify(path)} + ' ' + script + '\\n');`,
        `console.error(script + ' output in ' + process.cwd());`,
        `process.exit(script === 'build:ts' ? ${buildExitCode} : 0);`,
      ].join('\n'),
    );
    await writeFile(
      join(directory, 'package.json'),
      JSON.stringify({
        private: true,
        scripts: {
          fix: 'node check.cjs fix',
          'build:ts': 'node check.cjs build:ts',
        },
      }),
    );
  }

  return root;
};

export const checkRuns = async (root: string) => {
  try {
    return (await readFile(join(root, 'runs'), 'utf8'))
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
};

export const removeRepositories = () =>
  Promise.all(
    repositories.map((root) => rm(root, { recursive: true, force: true })),
  );

export type HookRun = { exitCode: number; stdout: string; stderr: string };

export const runHook = (script: string, input: unknown) =>
  new Promise<HookRun>((resolve) => {
    const child = execFile(
      process.execPath,
      [script],
      (error, stdout, stderr) =>
        resolve({
          exitCode: typeof error?.code === 'number' ? error.code : 0,
          stdout,
          stderr,
        }),
    );
    child.stdin?.end(JSON.stringify(input));
  });

import { spawn } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  markerPath,
  readHookInput,
  readMarker,
  resolveRoot,
  type HookInput,
} from './session-marker.ts';

type CheckResult = { ok: boolean; output: string };

export const checkFailedMessage =
  '`npm run fix` and `npm run build:ts` failed.';

export function shouldRunCheck(input: HookInput, editedPackages: string[]) {
  return !input.stop_hook_active && editedPackages.length > 0;
}

const runScript = (directory: string, script: string) => {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

  return new Promise<CheckResult>((done) => {
    const child = spawn(npm, ['run', script], {
      cwd: directory,
      windowsHide: true,
    });
    let output = '';

    child.stdout.setEncoding('utf8').on('data', (text) => (output += text));
    child.stderr.setEncoding('utf8').on('data', (text) => (output += text));
    child.on('error', (error) =>
      done({
        ok: false,
        output: [output, error.message].filter(Boolean).join('\n').trim(),
      }),
    );
    child.on('close', (code) =>
      done({ ok: code === 0, output: output.trim() }),
    );
  });
};

export async function validatePackage(root: string, packagePath: string) {
  const directory = resolve(root, packagePath);
  const fix = await runScript(directory, 'fix');

  return fix.ok ? runScript(directory, 'build:ts') : fix;
}

export async function validatePackages(root: string, packages: string[]) {
  const failed: string[] = [];
  const output: string[] = [];

  for (const packagePath of packages) {
    const result = await validatePackage(root, packagePath);

    if (!result.ok) {
      failed.push(packagePath);
      output.push(`Check failed in ${packagePath}.\n\n${result.output}`);
    }
  }

  return { ok: failed.length === 0, failed, output: output.join('\n\n') };
}

export async function validateChangedSession(input: HookInput) {
  const root = resolveRoot(input);
  const marker = markerPath(input, root);
  const packages = readMarker(marker);

  if (!marker || !shouldRunCheck(input, packages)) {
    return { ok: true, output: '' };
  }

  const result = await validatePackages(root, packages);

  if (result.ok) {
    rmSync(marker, { force: true });
  } else {
    writeFileSync(marker, result.failed.join('\n'));
  }

  return { ok: result.ok, output: result.output };
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const result = await validateChangedSession(readHookInput());

  if (!result.ok) {
    console.error([checkFailedMessage, result.output].join('\n\n'));
    process.exitCode = 2;
  }
}

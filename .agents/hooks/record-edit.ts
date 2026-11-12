import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { editedPackages } from './edited-packages.ts';
import {
  markerPath,
  readHookInput,
  readMarker,
  resolveRoot,
  type HookInput,
} from './session-marker.ts';

export function recordEdit(input: HookInput) {
  try {
    const root = resolveRoot(input);
    const marker = markerPath(input, root);
    const packages = editedPackages(input.tool_input, input.cwd ?? root, root);

    if (marker && packages.length > 0) {
      const recorded = new Set([...readMarker(marker), ...packages]);
      mkdirSync(dirname(marker), { recursive: true });
      writeFileSync(marker, [...recorded].join('\n'));
    }
  } catch {
    // Recording edits must never block the agent.
  }
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  recordEdit(readHookInput());
}

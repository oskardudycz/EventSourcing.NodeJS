import type { Plugin } from '@opencode-ai/plugin';
import type { Event } from '@opencode-ai/sdk';
import { editedPackages } from '../../.agents/hooks/edited-packages.ts';
import {
  checkFailedMessage,
  validatePackages,
} from '../../.agents/hooks/validate-change.ts';

const fileEditingTools = new Set(['edit', 'write', 'apply_patch']);

export function isFileEditingTool(tool: string) {
  return fileEditingTools.has(tool);
}

export function idleSessionID(event: Event) {
  return event.type === 'session.status' &&
    event.properties.status.type === 'idle'
    ? event.properties.sessionID
    : undefined;
}

export const ValidateChangePlugin: Plugin = async ({
  client,
  directory,
  worktree,
}) => {
  const editedSessions = new Map<string, Set<string>>();
  let validationInProgress = false;

  return {
    'tool.execute.after': async ({ tool, sessionID, args }) => {
      if (!isFileEditingTool(tool)) {
        return;
      }

      const packages = editedSessions.get(sessionID) ?? new Set<string>();
      for (const packagePath of editedPackages(args, directory, worktree)) {
        packages.add(packagePath);
      }
      if (packages.size > 0) {
        editedSessions.set(sessionID, packages);
      }
    },
    event: async ({ event }) => {
      const sessionID = idleSessionID(event);
      const packages =
        sessionID === undefined ? undefined : editedSessions.get(sessionID);

      if (
        sessionID === undefined ||
        packages === undefined ||
        validationInProgress
      ) {
        return;
      }

      validationInProgress = true;

      try {
        const result = await validatePackages(worktree, [...packages]);

        if (result.ok) {
          editedSessions.delete(sessionID);
          return;
        }

        editedSessions.set(sessionID, new Set(result.failed));
        await client.app.log({
          body: {
            service: 'validate-change',
            level: 'error',
            message: result.output,
          },
        });
        await client.tui.showToast({
          body: {
            message: `${checkFailedMessage} See the OpenCode log.`,
            variant: 'error',
          },
        });
      } finally {
        validationInProgress = false;
      }
    },
  };
};

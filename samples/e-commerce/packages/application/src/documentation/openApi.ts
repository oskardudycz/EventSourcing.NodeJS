import { ValidationError } from '@event-driven-io/emmett';
import type { WebApiSetup } from '@event-driven-io/emmett-honojs';
import { OpenAPIHono, z } from '@hono/zod-openapi';
import { problemDetailsSchema } from './httpContracts';

export type MessageType = 'query' | 'command';

export const eventCatalogMessageType = (type: MessageType) => ({
  'x-eventcatalog-message-type': type,
});

export const problem = (description: string) => ({
  description,
  content: { 'application/problem+json': { schema: problemDetailsSchema } },
});

export const openApiRouter = () =>
  new OpenAPIHono({
    defaultHook: (result) => {
      if (!result.success)
        throw new ValidationError(
          result.error.issues
            .map(({ path, message }) => `${path.join('.')}: ${message}`)
            .join('; '),
        );
    },
  });

export const webApiOf =
  (api: OpenAPIHono): WebApiSetup =>
  (router) =>
    router.route('/', api);

export { z };

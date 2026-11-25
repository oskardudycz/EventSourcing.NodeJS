import type { SendToChannel } from '@e-commerce/core';
import { NotFoundError, ValidationError } from '@event-driven-io/emmett';
import type { WebApiSetup } from '@event-driven-io/emmett-honojs';
import { swaggerUI } from '@hono/swagger-ui';
import { z } from 'zod';
import { allModules, type ModuleName } from '../modules';
import { asyncApiDocument, publishableMessages } from './asyncApiDocument';
import {
  openApiDocument,
  openApiModuleNames,
  type OpenApiModuleName,
  type OpenApiModules,
} from './openApiDocument';
import { asyncApiPage, publishPage } from './documentationPages';

const publishRequest = z.object({
  type: z.string(),
  data: z.unknown(),
});

const moduleOf = (name: string): ModuleName => {
  const found = allModules.find((module) => module === name);

  if (found === undefined)
    throw new NotFoundError({ type: 'Module', id: name });

  return found;
};

const openApiModuleOf = (name: string): OpenApiModuleName => {
  const found = openApiModuleNames.find((module) => module === name);

  if (found === undefined)
    throw new NotFoundError({ type: 'Module', id: name });

  return found;
};

export const documentationApi =
  (dependencies: {
    publish: SendToChannel;
    openApi: OpenApiModules;
  }): WebApiSetup =>
  (router) => {
    const messages = publishableMessages();

    router.get('/openapi.json', (context) =>
      context.json(openApiDocument(dependencies.openApi)),
    );
    router.get('/openapi/modules/:module', (context) =>
      context.json(
        openApiDocument(
          dependencies.openApi,
          openApiModuleOf(context.req.param('module')),
        ),
      ),
    );
    router.get('/swagger', swaggerUI({ url: '/openapi.json' }));
    router.get('/asyncapi.json', (context) => context.json(asyncApiDocument()));
    router.get('/asyncapi/modules/:module', (context) =>
      context.json(asyncApiDocument(moduleOf(context.req.param('module')))),
    );
    router.get('/asyncapi', (context) => context.html(asyncApiPage()));
    router.get('/asyncapi/publish', (context) =>
      context.html(
        publishPage(
          messages.map(({ contract, channel }) => ({
            type: contract.type,
            channel,
            example: contract.allFields,
          })),
        ),
      ),
    );

    router.post('/asyncapi/publish', async (context) => {
      const request = publishRequest.safeParse(
        await context.req.json().catch(() => undefined),
      );

      if (!request.success)
        throw new ValidationError('Body has to have a type and data');

      const found = messages.find(
        ({ contract }) => contract.type === request.data.type,
      );

      if (!found)
        throw new ValidationError(`Unknown message type ${request.data.type}`);

      const data = found.contract.schema.safeParse(request.data.data);

      if (!data.success)
        throw new ValidationError(
          `The data is not a ${found.contract.type}: ${data.error.message}`,
        );

      await dependencies.publish(found.channel, found.key, {
        type: found.contract.type,
        data: data.data,
        metadata: { messageId: crypto.randomUUID() },
      });

      return context.body(null, 202);
    });
  };

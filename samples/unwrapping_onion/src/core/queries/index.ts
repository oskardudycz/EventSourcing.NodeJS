export class Query {}

export interface QueryBus {
  send<Q extends Query, Result>(query: Q): Promise<Result>;
}

export interface QueryHandler<Q extends Query, Result> {
  handle(query: Q): Promise<Result>;
}

type RegisteredHandler =
  | {
      canHandle: true;
      handle: (query: Query) => Promise<unknown>;
    }
  | { canHandle: false };

// eslint-disable-next-line  @typescript-eslint/no-explicit-any
type Constructor<T> = new (...args: any[]) => T;

let queryBus: QueryBus | undefined;
const queryHandlers: ((query: Query) => RegisteredHandler)[] = [];

export const QueryBusFactory = (): QueryBus => {
  if (queryBus === undefined) {
    queryBus = {
      send: async <Q extends Query, Result>(query: Q): Promise<Result> => {
        const handler = queryHandlers
          .map((handler) => handler(query))
          .find((handler) => handler.canHandle);

        if (handler === undefined || !handler.canHandle) {
          return Promise.reject(
            new Error(`Query handler for ${JSON.stringify(query)} not found!`)
          );
        }
        return (await handler.handle(query)) as Result;
      },
    };
  }

  return queryBus;
};

export const RegisterQueryHandler = <C extends Query, Result>(
  queryType: Constructor<C>,
  queryHandler: QueryHandler<C, Result>
) => {
  return queryHandlers.push((query: Query) => {
    if (!(query instanceof queryType)) {
      return {
        canHandle: false,
      };
    }

    return {
      canHandle: true,
      handle: () => queryHandler.handle(query),
    };
  });
};

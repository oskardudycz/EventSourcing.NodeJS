import { HonoResponse, type TestRequest } from '@event-driven-io/emmett-honojs';

type Fetch = (request: Request) => Response | Promise<Response>;

type PageOptions = { as?: string; headers?: Record<string, string> };

export const shopRequests = (fetch: Fetch) => {
  const call =
    (
      method: 'GET' | 'POST',
      path: string,
      { as, headers = {} }: PageOptions,
      form?: Record<string, string>,
    ): TestRequest =>
    async () =>
      new HonoResponse(
        await fetch(
          new Request(`http://localhost${path}`, {
            method,
            headers: {
              ...(as ? { cookie: `customer=${encodeURIComponent(as)}` } : {}),
              ...(form
                ? { 'content-type': 'application/x-www-form-urlencoded' }
                : {}),
              ...headers,
            },
            ...(form ? { body: new URLSearchParams(form).toString() } : {}),
          }),
        ),
      );

  return {
    getPage: (path: string, options: PageOptions = {}) =>
      call('GET', path, options),
    postForm: (
      path: string,
      form: Record<string, string> = {},
      options: PageOptions = {},
    ) => call('POST', path, options, form),
  };
};

export type ShopRequests = ReturnType<typeof shopRequests>;

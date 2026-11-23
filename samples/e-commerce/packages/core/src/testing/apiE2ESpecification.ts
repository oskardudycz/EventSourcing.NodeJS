import {
  HonoTestAgent,
  type HonoResponse,
  type TestRequest,
} from '@event-driven-io/emmett-honojs';
import {
  assertDeepEqual,
  assertEqual,
  assertFails,
  assertMatches,
  assertTrue,
  getInMemoryEventStore,
  WrapEventStore,
  type EventStore,
  type InMemoryEventStore,
  type Message,
  type ProblemDocument,
  type TestEventStream,
} from '@event-driven-io/emmett';

type Fetch = (request: Request) => Response | Promise<Response>;

export type TestClock = {
  now: () => Date;
  advanceBy: (milliseconds: number) => void | Promise<void>;
};

export type TestWorker = {
  handle: (now: Date) => void | Promise<void>;
};

export type AppendedEvents = ReadonlyMap<string, TestEventStream>;

export type TestApplication = {
  fetch: Fetch;
  sendMessages?: (messages: readonly Message[]) => void | Promise<void>;
  clock?: TestClock;
  workers?: readonly TestWorker[];
  published?: () => readonly Message[];
  catchUp?: () => Promise<boolean>;
  start?: () => Promise<void>;
  stop?: () => Promise<void>;
};

type FetchOptions = { fetch: Fetch } & Omit<TestApplication, 'fetch'>;

type ApplicationOptions<Store extends EventStore> = {
  getEventStore: () => Store;
  getApplication: (eventStore: Store) => TestApplication;
};

type InMemoryApplicationOptions = {
  getApplication: (eventStore: InMemoryEventStore) => TestApplication;
};

export type MessagesStep = { type: 'messages'; messages: readonly Message[] };
export type TimeStep = { type: 'time'; milliseconds: number };
export type AttemptStep = { type: 'attempt'; request: TestRequest };
export type ActionStep = {
  type: 'action';
  run: () => void | Promise<void>;
};
export type TestStep =
  TestRequest | MessagesStep | TimeStep | AttemptStep | ActionStep;

export const send = (...messages: Message[]): MessagesStep => ({
  type: 'messages',
  messages,
});

export const timePasses = (milliseconds: number): TimeStep => ({
  type: 'time',
  milliseconds,
});

export const action = (run: () => void | Promise<void>): ActionStep => ({
  type: 'action',
  run,
});

export const attempt = (request: TestRequest): AttemptStep => ({
  type: 'attempt',
  request,
});

export type TestResponse = {
  status: number;
  headers: Record<string, string>;
  body: string;
  json: () => unknown;
};

export type Outcome = {
  response: TestResponse | undefined;
  published: readonly Message[];
  appended: readonly TestEventStream[] | undefined;
};

export type Expectation = (outcome: Outcome) => void | Promise<void>;

export type ApiE2ESpecification = (...givenSteps: TestStep[]) => {
  when: (step: TestStep) => {
    then: (...expectations: Expectation[]) => Promise<void>;
  };
};

const readResponse = async (response: HonoResponse): Promise<TestResponse> => {
  const body = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body,
    json: () => JSON.parse(body) as unknown,
  };
};

const appendedCounts = (appendedEvents: AppendedEvents | undefined) =>
  new Map(
    [...(appendedEvents ?? [])].map(([name, [, events]]) => [
      name,
      events.length,
    ]),
  );

const appendedSince = (
  appendedEvents: AppendedEvents | undefined,
  countsBefore: ReadonlyMap<string, number>,
): TestEventStream[] =>
  [...(appendedEvents ?? [])]
    .map(([name, [, events]]): TestEventStream => [
      name,
      events.slice(countsBefore.get(name) ?? 0),
    ])
    .filter(([, events]) => events.length > 0);

const specificationFor = (
  options: TestApplication,
  appendedEvents: AppendedEvents | undefined,
): ApiE2ESpecification => {
  const published = () => options.published?.() ?? [];

  const sendRequest = async (
    request: TestRequest,
    agent: HonoTestAgent,
  ): Promise<TestResponse> => {
    const result = request(agent);
    const response =
      result instanceof Promise ? await result : await result.execute();
    return readResponse(response);
  };

  const makeTimePass = async (milliseconds: number) => {
    const { clock, workers = [] } = options;
    if (!clock) throw new Error('Making time pass needs the clock option');

    await clock.advanceBy(milliseconds);
    for (const worker of workers) await worker.handle(clock.now());
  };

  const sendMessages = async (messages: readonly Message[]) => {
    if (!options.sendMessages)
      throw new Error('Sending messages needs the sendMessages option');

    await options.sendMessages(messages);
  };

  const catchUp = async () => {
    if (!options.catchUp) return;

    while (await options.catchUp());
  };

  const run = async (
    step: TestStep,
    agent: HonoTestAgent,
  ): Promise<TestResponse | undefined> => {
    let response: TestResponse | undefined;

    if (typeof step === 'function') response = await sendRequest(step, agent);
    else if (step.type === 'attempt')
      response = await sendRequest(step.request, agent).catch(() => undefined);
    else if (step.type === 'messages') await sendMessages(step.messages);
    else if (step.type === 'action') await step.run();
    else await makeTimePass(step.milliseconds);

    await catchUp();
    return response;
  };

  return (...givenSteps) => ({
    when: (step) => ({
      then: async (...expectations) => {
        const agent = new HonoTestAgent({ fetch: options.fetch });

        try {
          await options.start?.();
          for (const givenStep of givenSteps) await run(givenStep, agent);

          const publishedBefore = published().length;
          const countsBefore = appendedCounts(appendedEvents);

          const response = await run(step, agent);

          const outcome: Outcome = {
            response,
            published: published().slice(publishedBefore),
            appended: appendedEvents
              ? appendedSince(appendedEvents, countsBefore)
              : undefined,
          };

          for (const expectation of expectations) await expectation(outcome);
        } finally {
          await options.stop?.();
        }
      },
    }),
  });
};

function apiE2ESpecificationFor(options: FetchOptions): ApiE2ESpecification;
function apiE2ESpecificationFor<Store extends EventStore>(
  options: ApplicationOptions<Store>,
): ApiE2ESpecification;
function apiE2ESpecificationFor(
  options: InMemoryApplicationOptions,
): ApiE2ESpecification;
function apiE2ESpecificationFor<Store extends EventStore>(
  options:
    FetchOptions | InMemoryApplicationOptions | ApplicationOptions<Store>,
): ApiE2ESpecification {
  return (...givenSteps) => {
    if ('getEventStore' in options) {
      const eventStore = WrapEventStore(options.getEventStore());
      return specificationFor(
        options.getApplication(eventStore),
        eventStore.appendedEvents,
      )(...givenSteps);
    }

    if ('fetch' in options)
      return specificationFor(options, undefined)(...givenSteps);

    const eventStore = WrapEventStore(getInMemoryEventStore());
    return specificationFor(
      options.getApplication(eventStore),
      eventStore.appendedEvents,
    )(...givenSteps);
  };
}

export const ApiE2ESpecification = {
  for: apiE2ESpecificationFor,
};

const responseOf = (outcome: Outcome): TestResponse => {
  if (!outcome.response)
    throw new Error(
      'The when step got no response, because it did not send a request',
    );
  return outcome.response;
};

export const expectResponse =
  <Body = unknown>(
    status: number,
    options?: { body?: Body; headers?: Record<string, string> },
  ): Expectation =>
  (outcome) => {
    const response = responseOf(outcome);
    assertEqual(
      status,
      response.status,
      `Response status, with body: ${response.body}`,
    );

    if (options?.body !== undefined)
      assertMatches(response.json(), options.body);

    for (const [name, value] of Object.entries(options?.headers ?? {}))
      assertEqual(
        value,
        response.headers[name.toLowerCase()],
        `Header ${name}`,
      );
  };

export const expectError = (
  status: number,
  problemDetails?: Partial<ProblemDocument>,
): Expectation =>
  expectResponse(status, problemDetails ? { body: problemDetails } : undefined);

export const expectPublished =
  (...messages: Message[]): Expectation =>
  (outcome) =>
    assertDeepEqual(
      outcome.published,
      messages,
      `Published messages: ${JSON.stringify(outcome.published)}`,
    );

export const expectNothingPublished = (): Expectation => expectPublished();

export const expectAppended =
  (...streams: TestEventStream[]): Expectation =>
  ({ appended }) => {
    if (!appended)
      return assertFails(
        'Checking appended events needs the getEventStore option',
      );

    assertEqual(
      JSON.stringify(streams.map(([name, events]) => [name, events.length])),
      JSON.stringify(appended.map(([name, events]) => [name, events.length])),
      'Streams and counts of appended events',
    );
    assertMatches(appended, streams);
  };

export const expectNothingAppended = (): Expectation => expectAppended();

const htmlOf = (outcome: Outcome): string => {
  const response = responseOf(outcome);
  assertTrue(
    response.headers['content-type']?.includes('text/html') === true,
    `Content type ${response.headers['content-type']} is not HTML`,
  );
  return response.body;
};

export const htmlContaining =
  (...fragments: string[]): Expectation =>
  (outcome) => {
    const html = htmlOf(outcome);
    for (const fragment of fragments)
      assertTrue(html.includes(fragment), `HTML has no '${fragment}'`);
  };

export const htmlNotContaining =
  (...fragments: string[]): Expectation =>
  (outcome) => {
    const html = htmlOf(outcome);
    for (const fragment of fragments)
      assertTrue(!html.includes(fragment), `HTML has '${fragment}'`);
  };

export const redirectsTo =
  (path: string): Expectation =>
  (outcome) => {
    const location = responseOf(outcome).headers['location'];
    if (location === undefined)
      throw new Error('The response has no Location header');

    assertEqual(
      path,
      new URL(location, 'http://localhost').pathname,
      `Path of Location ${location}`,
    );
  };

[![Twitter Follow](https://img.shields.io/twitter/follow/oskar_at_net?style=social)](https://twitter.com/oskar_at_net) [![Github Sponsors](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&link=https://github.com/sponsors/oskardudycz/)](https://github.com/sponsors/oskardudycz/) [![blog](https://img.shields.io/badge/blog-event--driven.io-brightgreen)](https://event-driven.io/?utm_source=event_sourcing_nodejs)

# EventSourcing.NodeJS

- [EventSourcing.NodeJS](#eventsourcingnodejs)
  - [Event Sourcing](#event-sourcing)
    - [What is Event Sourcing?](#what-is-event-sourcing)
    - [What is Event?](#what-is-event)
    - [What is Stream?](#what-is-stream)
    - [Event representation](#event-representation)
    - [Retrieving the current state from events](#retrieving-the-current-state-from-events)
    - [Event Store](#event-store)
  - [Samples](#samples)
  - [Node.js project configuration](#nodejs-project-configuration)
    - [General configuration](#general-configuration)
    - [VSCode debug configuration](#vscode-debug-configuration)
    - [Unit tests with Jest](#unit-tests-with-jest)
    - [API tests with SuperTest](#api-tests-with-supertest)
    - [Continuous Integration - Run tests with Github Actions](#continuous-integration---run-tests-with-github-actions)
    - [Continuous Delivery - Build Docker image and publish to Docker Hub and GitHub Container Registry](#continuous-delivery---build-docker-image-and-publish-to-docker-hub-and-github-container-registry)
      - [Docker](#docker)
      - [Image](#image)
      - [Useful commands](#useful-commands)
      - [Container registry](#container-registry)
      - [Docker Hub publishing setup](#docker-hub-publishing-setup)
      - [Github Container Registry publishing setup](#github-container-registry-publishing-setup)
      - [Publish through GitHub Actions](#publish-through-github-actions)
  - [Tasks List](#tasks-list)

## Event Sourcing

### What is Event Sourcing?

Event Sourcing is a design pattern in which results of business operations are stored as a series of events. 

It is an alternative way to persist data. In contrast with state-oriented persistence that only keeps the latest version of the entity state, Event Sourcing stores each state change as a separate event.

Thanks for that, no business data is lost. Each operation results in the event stored in the databse. That enables extended auditing and diagnostics capabilities (both technically and business-wise). What's more, as events contains the business context, it allows wide business analysis and reporting.

In this repository I'm showing different aspects, patterns around Event Sourcing. From the basic to advanced practices.

Read more in my article:
-   📝 [How using events helps in a teams' autonomy](https://event-driven.io/en/how_using_events_help_in_teams_autonomy/?utm_source=event_sourcing_nodejs)

### What is Event?

Events, represent facts in the past. They carry information about something accomplished. It should be named in the past tense, e.g. _"user added"_, _"order confirmed"_. Events are not directed to a specific recipient - they're broadcasted information. It's like telling a story at a party. We hope that someone listens to us, but we may quickly realise that no one is paying attention.

Events:
- are immutable: _"What has been seen, cannot be unseen"_.
- can be ignored but cannot be retracted (as you cannot change the past).
- can be interpreted differently. The basketball match result is a fact. Winning team fans will interpret it positively. Losing team fans - not so much.

Read more in my articles:
-   📝 [What's the difference between a command and an event?](https://event-driven.io/en/whats_the_difference_between_event_and_command/?utm_source=event_sourcing_nodejs)
-   📝 [Events should be as small as possible, right?](https://event-driven.io/en/whats_the_difference_between_event_and_command/?utm_source=event_sourcing_nodejs)

### What is Stream?

Events are logically grouped into streams. In Event Sourcing, streams are the representation of the entities. All the entity state mutations ends up as the persisted events. Entity state is retrieved by reading all the stream events and applying them one by one in the order of appearance.

A stream should have a unique identifier representing the specific object. Each event has its own unique position within a stream. This position is usually represented by a numeric, incremental value. This number can be used to define the order of the events while retrieving the state. It can be also used to detect concurrency issues. 

### Event representation

Technically events are messages. 

They may be represented, e.g. in JSON, Binary, XML format. Besides the data, they usually contain:
- **id**: unique event identifier.
- **type**: name of the event, e.g. _"invoice issued"_.
- **stream id**: object id for which event was registered (e.g. invoice id).
- **stream position** (also named _version_, _order of occurrence_, etc.): the number used to decide the order of the event's occurrence for the specific object (stream).
- **timestamp**: representing a time at which the event happened.
- other metadata like `correlation id`, `causation id`, etc.

Sample event JSON can look like:

```json
{
  "id": "e44f813c-1a2f-4747-aed5-086805c6450e",
  "type": "invoice-issued",
  "streamId": "INV/2021/11/01",
  "streamPosition": 1,
  "timestamp": "2021-11-01T00:05:32.000Z",

  "data":
  {
    "issuedTo": {
      "name": "Oscar the Grouch",
      "address": "123 Sesame Street",
    },
    "amount": 34.12,
    "number": "INV/2021/11/01",
    "issuedAt": "2021-11-01T00:05:32.000Z"
  },

  "metadata": 
  {
    "correlationId": "1fecc92e-3197-4191-b929-bd306e1110a4",
    "causationId": "c3cf07e8-9f2f-4c2d-a8e9-f8a612b4a7f1"
  }
}
```

This structure could be translated directly into the TypeScript class. However, to make the code less redundant and ensure that all events follow the same convention, it's worth adding the base type. It could look as follows:

```typescript
export type Event<
  EventType extends string = string,
  EventData extends Record<string, unknown> = Record<string, unknown>
> = Readonly<{
  type: Readonly<EventType>;
  data: Readonly<EventData>;
}>;
```
Several things are going on there:
1. Event type definition is not directly string, but it might be defined differently (`EventType extends string = string`). It's added to be able to define the alias for the event type. Thanks to that, we're getting compiler check and IntelliSense support,
2. Event data is defined as [Record](https://www.typescriptlang.org/docs/handbook/utility-types.html#recordkeystype) (`EventData extends Record<string, unknown> = Record<string, unknown>`). It is the way of telling the TypeScript compiler that it may expect any type but allows you to specify your own and get a proper type check.
3. We're using [Readonly<>](https://www.typescriptlang.org/docs/handbook/utility-types.html#readonlytype) wrapper around the Event type definition. We want to be sure that our event is immutable. Neither type nor data should change once it was initialised. `Readonly<>` constructs a type with all properties set as `readonly`. Syntax:

```typescript
Readonly<{
  type: EventType;
  data: EventData;
}>;
```
is equal to:

```typescript
{
  readonly type: EventType;
  readonly data: EventData;
};
```

I prefer the former, as, in my opinion, it's making the type definition less cluttered. 

We're also wrapping the `EventType` and `EventData` with `Readonly<>`. This is needed as `Readonly<>` does only shallow type copy. It won't change the nested types definition. So:

```typescript
Readonly<{
  type: 'invoice-issued';
  data: {    
    number: string;
    issuedBy: string;
    issuedAt: Date;
  }
}>;
```

is the equivalent of:

```typescript
{
  readonly type: 'invoice-issued';
  readonly data: {    
    number: string;
    issuedBy: string;
    issuedAt: Date;
  }
};
```

while we want to have:

```typescript
{
  readonly type: 'invoice-issued';
  readonly data: {    
    readonly number: string;
    readonly issuedBy: string;
    readonly issuedAt: Date;
  }
};
```

Wrapping `EventType` and `EventType` and `EventData` with `Readonly<>` does that for us and enables immutability. 

_**Note**: we still need to remember to wrap nested structures inside the event data into `Readonly<>` to have all properties set as `readonly`._

Having that, we can define the event as eg.:

```typescript
// alias for event type
type INVOICE_ISSUED = 'invoice-issued';

// person DTO used in issued by event data
type Person = Readonly<{
  name: string;
  address: string;
}>

// event type definition
type InvoiceIssued = Event<
  INVOICE_ISSUED,
  {
    issuedTo: Person,
    amount: number,
    number: string,
    issuedAt: Date
  }
>
```

then create it as:

```typescript
const invoiceIssued: InvoiceIssued = {
  type: 'invoice-issued',
  data: {
    issuedTo: {
      name: 'Oscar the Grouch',
      address: '123 Sesame Street',
    },
    amount: 34.12,
    number: 'INV/2021/11/01',
    issuedAt: new Date()
  },
}
```

### Retrieving the current state from events

In Event Sourcing, the state is stored in events. Events are logically grouped into streams. Streams can be thought of as the entities' representation. Traditionally (e.g. in relational or document approach), each entity is stored as a separate record.

| Id       | IssuerName       | IssuerAddress     | Amount | Number         | IssuedAt   |
| -------- | ---------------- | ----------------- | ------ | -------------- | ---------- |
| e44f813c | Oscar the Grouch | 123 Sesame Street | 34.12  | INV/2021/11/01 | 2021-11-01 |

 In Event Sourcing, the entity is stored as the series of events that happened for this specific object, e.g. `InvoiceInitiated`, `InvoiceIssued`, `InvoiceSent`. 

```json          
[
    {
        "id": "e44f813c-1a2f-4747-aed5-086805c6450e",
        "type": "invoice-initiated",
        "streamId": "INV/2021/11/01",
        "streamPosition": 1,
        "timestamp": "2021-11-01T00:05:32.000Z",

        "data":
        {
            "issuedTo": {
                "name": "Oscar the Grouch",
                "address": "123 Sesame Street",
            },
            "amount": 34.12,
            "number": "INV/2021/11/01",
            "initiatedAt": "2021-11-01T00:05:32.000Z"
        }
    },        
    {
        "id": "5421d67d-d0fe-4c4c-b232-ff284810fb59",
        "type": "invoice-issued",
        "streamId": "INV/2021/11/01",
        "streamPosition": 2,
        "timestamp": "2021-11-01T00:11:32.000Z",

        "data":
        {
            "issuedTo": "Cookie Monster",
            "issuedAt": "2021-11-01T00:11:32.000Z"
        }
    },        
    {
        "id": "637cfe0f-ed38-4595-8b17-2534cc706abf",
        "type": "invoice-sent",
        "streamId": "INV/2021/11/01",
        "streamPosition": 3,
        "timestamp": "2021-11-01T00:12:01.000Z",

        "data":
        {
            "sentVia": "email",
            "sentAt": "2021-11-01T00:12:01.000Z"
        }
    }
]
```

All of those events shares the stream id (`"streamId": "INV/2021/11/01"`), and have incremented stream position.

We can get to conclusion that in Event Sourcing entity is represented by stream, so sequence of event correlated by the stream id ordered by stream position.

To get the current state of entity we need to perform the stream aggregation process. We're translating the set of events into a single entity. This can be done with the following the steps:
1. Read all events for the specific stream.
2. Order them ascending in the order of appearance (by the event's stream position).
3. Apply each event on the entity.

This process is called also _stream aggregation_ or _state rehydration_.

For this process we'll use the [reduce function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/Reduce). It executes a reducer function (that you can provide) on each array element, resulting in a single output value. TypeScript extends it with the type guarantees:
1. reduce in TypeScript is a generic method. It allows to provide the result type as a parameter. It doesn’t have to be the same as type of the array elements.
2. You can also use optional param to provide the default value for accumulation.
3. Use [Partial<Type>](https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype) as the generic reduce param. It constructs a type with all properties of Type set to optional. This utility will return a type that represents all subsets of a given type. This is extremely important, as TypeScript forces you to define all required properties. We'll be merging different states of the aggregate state into the final one. Only the first event (`InvoiceInitiated`) will provide all required fields. The other events will just do a partial update (`InvoiceSent` only changes the status and sets the sending method and date).

Having event types defined as:

```typescript
type InvoiceInitiated = Event<
  'invoice-initiated',
  {
    number: string;
    amount: number;
    issuedTo: Person;
    initiatedAt: Date;
  }
>;

type InvoiceIssued = Event<
  'invoice-issued',
  {
    number: string;
    issuedBy: string;
    issuedAt: Date;
  }
>;

type InvoiceSent = Event<
  'invoice-sent',
  {
    number: string;
    sentVia: InvoiceSendMethod;
    sentAt: Date;
  }
>;
```

Entity as:

```typescript
type Invoice = Readonly<{
  number: string;
  amount: number;
  status: InvoiceStatus;

  issuedTo: Person;
  initiatedAt: Date;

  issued?: Readonly<{
    by?: string;
    at?: Date;
  }>;

  sent?: Readonly<{
    via?: InvoiceSendMethod;
    at?: Date;
  }>;
}>;
```

We can rebuild the state with events using the reduce function:

```typescript
const result = events.reduce<Partial<Invoice>>((currentState, event) => {
  switch (event.type) {
    case 'invoice-initiated':
      return {
        number: event.data.number,
        amount: event.data.amount,
        status: InvoiceStatus.INITIATED,
        issuedTo: event.data.issuedTo,
        initiatedAt: event.data.initiatedAt,
      };
    case 'invoice-issued': {
      return {
        ...currentState,
        status: InvoiceStatus.ISSUED,
        issued: {
          by: event.data.issuedBy,
          at: event.data.issuedAt,
        },
      };
    }
    case 'invoice-sent': {
      return {
        ...currentState,
        status: InvoiceStatus.SENT,
        sent: {
          via: event.data.sentVia,
          at: event.data.sentAt,
        },
      };
    }
    default:
      throw 'Unexpected event type';
  }
}, {});
```

The only thing left is to translate `Partial<Invoice>` into properly typed `Invoice`. We'll use [type guard](https://www.typescriptlang.org/docs/handbook/advanced-types.html#type-guards-and-differentiating-types) for that:

```typescript
function isInvoice(invoice: Partial<Invoice>): invoice is Invoice {
  return (
    !!invoice.number &&
    !!invoice.amount &&
    !!invoice.status &&
    !!invoice.issuedTo &&
    !!invoice.initiatedAt &&
    (!invoice.issued || (!!invoice.issued.at && !!invoice.issued.by)) &&
    (!invoice.sent || (!!invoice.sent.via && !!invoice.sent.at))
  );
}

if(!isInvoice(result))
    throw "Invoice state is not valid!";

const reservation: Invoice = result;
```

Thanks to that, we have a proper type definition. We can make the stream aggregation more generic and reusable:

```typescript
export function aggregateStream<Aggregate, StreamEvents extends Event>(
  events: StreamEvents[],
  when: (
    currentState: Partial<Aggregate>,
    event: StreamEvents,
    currentIndex: number,
    allEvents: StreamEvents[]
  ) => Partial<Aggregate>,
  check?: (state: Partial<Aggregate>) => state is Aggregate
): Aggregate {
  const state = events.reduce<Partial<Aggregate>>(when, {});

  if (!check) {
    console.warn('No type check method was provided in the aggregate method');
    return <Aggregate>state;
  }

  if (!check(state)) throw 'Aggregate state is not valid';

  return state;
}
```

See full sample: [link](./samples/foundations/src/invoices/invoice.unit.test.ts).

Read more in my article:
-   📝 [Why Partial<Type> is an extremely useful TypeScript feature?](https://event-driven.io/en/partial_typescript//?utm_source=event_sourcing_nodejs)

### Event Store

Event Sourcing is not related to any type of storage implementation. As long as it fulfils the assumptions, it can be implemented having any backing database (relational, document, etc.). The state has to be represented by the append-only log of events. The events are stored in chronological order, and new events are appended to the previous event. Event Stores are the databases' category explicitly designed for such purpose. 

The simplest (dummy and in-memory) Event Store can be defined in TypeScript as:

```typescript
class EventStore {
  private events: { readonly streamId: string; readonly data: string }[] = [];

  appendToStream(streamId: string, ...events: any[]): void {
    const serialisedEvents = events.map((event) => {
      return { streamId: streamId, data: JSON.stringify(event) };
    });

    this.events.push(...serialisedEvents);
  }

  readFromStream<T = any>(streamId: string): T[] {
    return this.events
      .filter((event) => event.streamId === streamId)
      .map<T>((event) => JSON.parse(event.data));
  }
}
```

In the further samples, I'll use [EventStoreDB](https://developers.eventstore.com/). It's the battle-tested OSS database created and maintained by the Event Sourcing authorities. It supports many dev environments via gRPC clients, including NodeJS.

Read more in my article:
-   📝 [What if I told you that Relational Databases are in fact Event Stores?](https://event-driven.io/en/relational_databases_are_event_stores/=event_sourcing_nodejs)

## Samples

1. Simple Event Sourcing sample: [samples/simple](./samples/simple).
## Node.js project configuration

### General configuration

1. Install Node.js - https://Node.js.org/en/download/. Recommended NVM.
2. Create project:
    ```bash
    npm init -y
    ```
3. [ExpressJS](https://expressjs.com/) - Web Server for REST API.
    - install:
    ```bash
    npm i express
    ```
4. [TypeScript](typescriptlang.org/) - We'll be doing Type Driven Development
    - install together with types for `Node.js` and `Express` and [TS Node](https://github.com/TypeStrong/ts-node)
    ```bash
    npm i -D typescript @types/express @types/node ts-node
    ```
    - you can also install TypeScript compiler globally by running:
    ```bash
    npm i -g typescript
    ```
    - add TypeScript compiler buid command to NPM:
    ```json
    { 
        "scripts": {
            "build:ts": "tsc",
        }
    }
    ```
    - if you installed `tsc` globally you can init TypeScript config by running:
    ```bash
    tsc --init
    ```
    - or you can just create the [tsconfig.json](./samples/simple/tsconfig.json) file, e.g.:
    ```json
    {
        "compilerOptions": {
            "target": "es2020", 
            "module": "commonjs",
            "outDir": "./dist",
            "strict": true, 
            "strictNullChecks": true,
            "noUnusedLocals": true,
            "noImplicitReturns": true,
            "esModuleInterop": true,
            "skipLibCheck": true,
            "forceConsistentCasingInFileNames": true,
        },
        "include": ["./src"],
    }
    ```
5. [ESLint](https://eslint.org) - We'd like to have static code analysis:
    - install using [npx](https://blog.npmjs.org/post/162869356040/introducing-npx-an-npm-package-runner) and going through wizard. This will generate install all packages and generate needed files (suggested is to use ECMA Modules, TypeScript, )
    ```bash
    npx eslint --init

    √ How would you like to use ESLint? · style       
    √ What type of modules does your project use? · esm
    √ Which framework does your project use? · none
    √ Does your project use TypeScript? · No / Yes
    √ Where does your code run? · node
    √ How would you like to define a style for your project? · guide
    √ Which style guide do you want to follow? · standard    
    √ What format do you want your config file to be in? · JSON
    ```
    - or using the `npm`:
    ```bash
    npm i -D @typescript-eslint/eslint-plugin eslint-config-standard eslint eslint-plugin-import eslint-plugin-node eslint-plugin-promise @typescript-eslint/parser
    ```
    - this should generate [.eslintrc.json](./samples/simple/.eslintrc.json) file with ESLint configuration:
    ```json
    {
        "env": {
            "es2020": true,
            "node": true
        },
        "extends": [
            "standard"
        ],
        "parser": "@typescript-eslint/parser",
        "parserOptions": {
            "ecmaVersion": 12,
            "sourceType": "module"
        },
        "plugins": [
            "@typescript-eslint"
        ],
        "rules": {
        }
    }
    ```
    - add [.eslintignore](./samples/simple/.eslintignore) to configure exclusion for files that we don't want to analyse:
    ```bash
    /node_modules/*
    
    # build artifacts
    dist/*coverage/*

    # data definition files
    **/*.d.ts

    # custom definition files
    /src/types/
    ```

6. [Prettier](https://prettier.io), as we aim to write pretty code:
    - install:
    ```bash
    npm i -D prettier eslint-config-prettier eslint-plugin-prettier
    ```
    - add [.prettierrc.json](./samples/simple/.prettierrc.json) with Prettier config:
    ```json
    {
        "tabWidth": 2,
        "singleQuote": true
    }
    ```
    - add Prettier plugin to [.eslintrc.json](./samples/simple/.eslintrc.json) to make sure that then collide with each other:
    ```json
    {
        "env": {
            "es2020": true,
            "node": true
        },
        "extends": [
            "plugin:@typescript-eslint/recommended", <-- updated
            "prettier/@typescript-eslint", <-- added
            "plugin:prettier/recommended" <-- added
        ],
        "parser": "@typescript-eslint/parser",
        "parserOptions": {
            "ecmaVersion": 12,
            "sourceType": "module"
        },
        "plugins": [
            "@typescript-eslint"
        ],
        "rules": {
        }
    }
    ``` 
    - if you're using VSCode, I recommend to install [Prettier plugin](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
7. Define tasks for ESLint and Prettier in [package.json](./samples/simple/package.json):
    - checks:
    ```json
    {
        "scripts": {
            "lint": "npm run lint:eslint && npm run lint:prettier",
            "lint:prettier": "prettier --check \"src/**/**/!(*.d).{ts,json,md}\"",
            "lint:eslint": "eslint src/**/*.ts",
        }
    }
    ```
    - fixes:
    ```json
    { 
        "scripts": {
            "lint:eslint": "eslint src/**/*.ts",
            "prettier:fix": "prettier --write \"src/**/**/!(*.d).{ts,json,md}\"",
        }
    }
    ```
8. [Husky](https://github.com/typicode/husky#readme) is a tool that enables to run scripts on precommit git hook. We'll use it to run `ESLint` and `Prettier` to make sure that code is formatted and following rules.
   - install version 4 (Starting for version 5 it's free only for OSS projects):
   ```bash
   npm i -D husky@4
   ```
   - add Husky configuration to [package.json](./samples/simple/package.json):
   ```json
   {
        "husky": {
            "hooks": {
                "pre-commit": "npm run lint"
            }
        }
   }
   ```
9. To make sure that all is working fine we'll create the new app (e.g. in the `src/index.ts`)
```typescript
import express, { Application, Request, Response } from 'express';
import http from 'http';

const app: Application = express();
const server = http.createServer(app);

app.get('/', (req: Request, res: Response) => {
  res.json({ greeting: 'Hello World!' });
});

const PORT = 5000;

server.listen(PORT);

server.on('listening', () => {
  console.info('server up listening');
});

```
This will create an Express application that will be listening on port `5000` and return the JSON (with dummy data greeting with `"Hello World!"`).
10. [Nodemon](https://nodemon.io/) to have hot-reload of the running Express server code.
    - install:
    ```bash
    npm i -D nodemon
    ```
    - add script to [package.json](./samples/simple/package.json) to run Express server with Nodemon:
     ```json
    {
        "scripts": {
            "dev:start": "nodemon src/index.ts",
        }
    }
    ```
    - you can run dev script as:
    ```bash
    npm run dev:start
    ```
    - open in browser http://localhost:5000/ and check if you see result:
    ```json
    { "greeting": "Hello World!" }
    ```
### VSCode debug configuration

To configure VSCode debug you need to add [launch.json](./samples/simple/.vscode/launch.json) file in the [.vscode](./samples/simple/.vscode) folder.

To not need to synchronise two separate configurations, we'll reuse the existing NPM script `dev:start` that starts the application. 

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run-script", "dev:start", "--", "--inspect-brk=9229"],
      "port": 9229
    }
  ]
}
```

As we have TypeScript configured, then we don't need any additional setup. We're reusing the native node debugging capabilities by using the `--inspect-brk=9229` parameter. Read more in the [Node.js documentation](https://Node.js.org/en/docs/guides/debugging-getting-started/)

### Unit tests with Jest

1. Install [Jest](https://jestjs.io/) together with [ts-jest](https://kulshekhar.github.io/ts-jest/) package and needed typings to make it work with TypeScript.
```bash
npm i -D jest @types/jest ts-jest
```
2. Configure Jest with using npx installer:
```bash
npx ts-jest config:init
```
3. This will create [jest.config.js](./samples/simple/jest.config.js) with Jest needed configuration:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
};
```
We'll update it to match our configuration. Without that it'll match both source `ts` files and generated `js` running tests twice.
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // tells Jest where are our test files
  roots: ['<rootDir>/src'],
  // tells Jest to use only TypeScript files
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
};
```
1. Let's add some dummy code to make sure that our tests are working. This can be e.g. `src/greetings/getGreeting.ts`
```typescript
export function getGreeting() {
  return {
    greeting: 'Hello World!',
  };
}
```
5. Let's add also some dummy unit test running this code. I'll put it in the same directory, as in my opinion it makes easier development and focus on the specific test instead of jumping from one place to another. In this case it will be `src/greetings/getGreetings.unit.test.ts`
```typescript
import { getGreeting } from './getGreeting';

describe('getGreeting', () => {
  it('should return greeting "Hello World!"', () => {
    const result = getGreeting();

    expect(result).toBeDefined();
    expect(result.greeting).toBe('Hello World!');
  });
});
```
6. To run Jest we need to add new NPM script to [package.json](./samples/simple/package.json):
```json
{
    "scripts": {        
        "test:unit": "jest unit",
    }
}
```
Now you can run them with:
```bash
npm run test:unit
```
Jest will be smart enough to find by convention all files with `.unit.test.ts` suffix.
7. To be able to debug our tests we have to add new debug configurations to [launch.json](./samples/simple/.vscode/launch.json). We'll be using `watch` settings, so we don't have re-run tests when we updated logic or test code. 
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Jest all tests",
      "type": "node",
      "request": "launch",
      "program": "${workspaceRoot}/node_modules/jest/bin/jest.js",
      "args": ["--verbose", "-i", "--no-cache", "--watchAll"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    },
    {
      "name": "Jest current test",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/jest/bin/jest",
      "args": [
        "${fileBasename}",
        "--verbose",
        "-i",
        "--no-cache",
        "--watchAll"
      ],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### API tests with SuperTest

[SuperTest](https://github.com/visionmedia/supertest#readme) is a useful library that allows testing Express HTTP applications.

To install it run:
```bash
npm i -D supertest @types/supertest
```

`SuperTest` takes as input Express application. We have to structure our code to return it, e.g.

```typescript
import express, { Application, Request, Response } from 'express';
import { getGreeting } from './greetings/getGreeting';

const app: Application = express();

app.get('/', (_req: Request, res: Response) => {
  res.json(getGreeting());
});

export default app;
```

Our updated intex will look like:

```typescript
import app from './app';
import http from 'http';

const server = http.createServer(app);

const PORT = 5000;

server.listen(PORT);

server.on('listening', () => {
  console.info('server up listening');
});

```

Let's create the test for the default route. For that, create a file, e.g. `getGreetings.api.test.ts`. We'll be using a different prefix, `api.test.ts`, as those tests are not unit but integration/acceptance. They will be running the Express server. Having the Express app extracted, we can use the `SuperTest` library as:

```typescript
import request from 'supertest';
import app from '../app';

describe('GET /', () => {
  it('should return greeting "Hello World!"', () => {
    return request(app)
      .get('/')
      .expect('Content-Type', /json/)
      .expect(200, { greeting: 'Hello World!' });
  });
});
```

`SuperTest` wraps the Express app and making the API calls easier. It also provides a set of useful methods to check the response params.

As the final step we'll add a separate NPM script to [package.json](./samples/simple/package.json) for running API tests and also script to run all of them.

```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:api", // <-- added
    "test:unit": "jest unit",
    "test:api": "jest api" // <-- added
  }
}
```

### Continuous Integration - Run tests with Github Actions

It's important to have your changes be verified during the pull request process. We'll use GitHub Actions as a sample of how to do that. You need to create the [.github/workflows](./.github/workflows) folder and putt there new file (e.g. [samples_simple.yml](./.github/workflows/samples_simple.yml)). This file will contain YAML configuration for your action:

The simplest setup will look like this:

```yaml
name: Node.js Continuous Integration

on:
  # run it on push to the default repository branch
  push:
    branches: [main]
  # run it during pull request
  pull_request:

defaults:
  run:
    # relative path to the place where source code (with package.json) is located
    working-directory: samples/simple

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2
      - name: Use Node.js 14.x
        uses: actions/setup-node@v1
        with:
          node-version: 14.x
      # install dependencies based on the package log
      - run: npm ci
      # run linting (ESlint and Prettier)
      - run: npm run lint
      # run build
      - run: npm run build:ts
      # run tests
      - run: npm test
```

If you want to make sure that your code will be running properly for a few Node.js versions and different operating systems (e.g. because developers may have different environment configuration) then you can use matrix tests:

```yaml
name: Node.js Continuous Integration

on:
  # run it on push to the default repository branch
  push:
    branches: [main]
  # run it during pull request
  pull_request:

defaults:
  run:
    # relative path to the place where source code (with package.json) is located
    working-directory: samples/simple

jobs:
  build:
    # use system defined below in the tests matrix
    runs-on: ${{ matrix.os }}

    strategy:
      # define the test matrix
      matrix:
        # selected operation systems to run Continuous Integration
        os: [windows-latest, ubuntu-latest, macos-latest]
        # selected node version to run Continuous Integration
        node-version: [14.x, 15.x]

    steps:
      - uses: actions/checkout@v2
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v1
        with:
          # use the node version defined in matrix above
          node-version: ${{ matrix.node-version }}
      # install dependencies
      - run: npm ci
      # run linting (ESlint and Prettier)
      - run: npm run lint
      # run build
      - run: npm run build:ts
      # run tests
      - run: npm test
```

### Continuous Delivery - Build Docker image and publish to Docker Hub and GitHub Container Registry

#### Docker

Docker allows creating lightweight images with preconfigured services. Thanks to its immutable nature, it allows having the same experience in runtime configuration independent of the operating systems. It makes deployment and testing easier and more predictable. Most of the hosting (both cloud and on-premise) supports Docker images deployment.

#### Image

The basis of the Docker configuration is an image definition. It's defined as the text file and usually named by convention as `Dockerfile`. It starts with information of which base image we'll be using and then customisation.  Most of the technologies provide various types of base images. We'll use `node:lts-alpine`. Which represent the latest Long-Term Support version. Alpine type of image is recommended as usually the smallest with a minimum set of dependencies.

The best practice for building the docker image is to use [multistage build](https://docs.docker.com/develop/develop-images/multistage-build/) feature. It allows to use at the first image with all build dependencies, build artefacts and copy it to the final *"smaller"* image.

Each line in the Dockerfile will create a separate _layer_. Such _layer_ is immutable, and if the file, if this line was not changed or, e.g. copied file in this file, was not changed, it won't be rebuilt and reused. That's why it's essential to at first copy files that are changed rarely (e.g. `package.json` file and running installing node modules), then copy source codes.

[Sample Dockerfile](./samples/simple/Dockerfile) looks like:

```dockerfile
########################################
#  First stage of multistage build
########################################
#  Use Build image with label `builder
########################################
# use 
FROM node:lts-alpine AS builder

# Setup working directory for project
WORKDIR /app

COPY ./package.json ./
COPY ./package-lock.json ./
COPY ./tsconfig.json ./

# install node modules
# use `npm ci` instead of `npm install`
# to install exact version from `package-lock.json`
RUN npm ci

# Copy project files
COPY src ./src

# Build project
RUN npm run build:ts

# sets environment to production
# and removes packages from devDependencies
RUN npm prune --production

########################################
#  Second stage of multistage build
########################################
#  Use other build image as the final one
#    that won't have source codes
########################################
FROM node:lts-alpine

# Setup working directory for project
WORKDIR /app

# Copy published in previous stage binaries
# from the `builder` image
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Set URL that App will be exposed
EXPOSE 5000

# sets entry point command to automatically
# run application on `docker run`
ENTRYPOINT ["node", "./dist/index.js"]
```

It's also worth adding [.dockerignore](./samples/simple/.dockerignore) file and exclude local built artefacts (e.g. from `dist` folder) and dependencies (e.g. `node_modules` folder). It will speed up the build time and ensure that platform-specific files won't clash with each other.

```
**/dist/
**/node_modules/
```

Docker also allows orchestration of multiple Docker containers with [Docker Compose](https://docs.docker.com/compose/) YAML file. It should be named by convention as `docker-compose.yml`. For our single service, [sample docker-compose.yml](./samples/simple/docker-compose.yml) will look as such:

```yaml
version: '3.5'
services:
  app:
    build:
      # use local image
      dockerfile: Dockerfile
      context: .
    container_name: eventsourcing_js
    ports:
      - '5555:5000'
```

#### Useful commands

1. Build an image with tag `eventsourcing.js.simple` based on the `Dockerfile` in the current directory:
```bash
$ docker build -t . eventsourcing.js.simple
```
2. Run image with tag `eventsourcing.js.simple`
```bash
$ docker run -it eventsourcing.js.simple
```
3. Pulling image from registry
```bash
$ docker pull oskardudycz/eventsourcing.js.simple
```
4. Build Docker Compose based on the `docker-compose.yml` file in the current directory
```bash
$ docker-compose build
```
5. Show running containers
```bash
$ docker ps
```
6. Show all containers (also stopped)
```bash
$ docker ps -a
```
7. Start services with docker-compose
```bash
$ docker-compose up
```
8. Kill all services from docker-compose
```bash
$ docker-compose kill
```
6. Remove all services and clean the data from docker-compose
```bash
$ docker-compose down -v
```

#### Container registry

As an example of continuous delivery, we'll use deployment do Docker registry. 

Docker Hub is the default, free registry that Docker provides, and it's commonly used for the public available images. However, from November 2020, it has [significant limits for free accounts](https://www.docker.com/blog/docker-hub-image-retention-policy-delayed-and-subscription-updates/).

GitHub introduced its own [container registry](https://github.com/features/packages). It allows both public and private hosting (which is crucial for commercial projects).

#### Docker Hub publishing setup

1. Create an account and sign in to [Docker Hub](https://hub.docker.com).
2. Go to Account Settings => Security: [link](https://hub.docker.com/settings/security) and click **New Access Token**.
3. Provide the name of your access token, save it and copy the value (you won't be able to see it again, you'll need to regenerate it).
4. Go to your GitHub secrets settings (Settings => Secrets, url `https://github.com/{your_username}/{your_repository_name}/settings/secrets/actions`).
5. Create two secrets (they won't be visible for other users and will be used in the non-forked builds)
- `DOCKERHUB_USERNAME` - with the name of your Docker Hub account (do not mistake it with GitHub account)
- `DOCKERHUB_TOKEN` - with the pasted value of a token generated in point 3.

#### Github Container Registry publishing setup

1. [Enable GitHub Container Registry](https://docs.github.com/en/packages/guides/enabling-improved-container-support). Profile => Feature Preview => Improved Container Support => Enable.
2. Create [GitHub Personal Access Token](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token) in your profile [developer settings page](https://github.com/settings/tokens). Copy the value (you won't be able to see it again, you'll need to regenerate it). Select at least following scopes:
- `repo`
- `read:packages`
- `write:packages`
4. Go to your GitHub secrets settings (Settings => Secrets, url `https://github.com/{your_username}/{your_repository_name}/settings/secrets/actions`).
5. Create secret (they won't be visible for other users and will be used in the non-forked builds)
- `GHCR_PAT` - with the pasted value of a token generated in point 2.

#### Publish through GitHub Actions

Let's add a new step to the GitHub Action to publish to both containers. It should be only run if the first step with build and tests passed. Updated worfklow ([samples_simple.yml](./.github/workflows/samples_simple.yml)):

```yaml
name: Node.js Continuous Integration and Continuous Delivery

on:
  # run it on push to the default repository branch
  push:
    branches: [main]
  # run it during pull request
  pull_request:

defaults:
  run:
    # relative path to the place where source code (with package.json) is located
    working-directory: samples/simple

jobs:
  build-and-test-code:
    name: Build and test application code
    # use system defined below in the tests matrix
    runs-on: ${{ matrix.os }}

    strategy:
      # define the test matrix
      matrix:
        # selected operation systems to run CI
        os: [windows-latest, ubuntu-latest, macos-latest]
        # selected node version to run CI
        node-version: [14.x, 15.x]

    steps:
      - uses: actions/checkout@v2
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v1
        with:
          # use the node version defined in matrix above
          node-version: ${{ matrix.node-version }}
      # install dependencies
      - run: npm ci
      # run linting (ESlint and Prettier)
      - run: npm run lint
      # run build
      - run: npm run build:ts
      # run tests
      - run: npm test

  build-and-push-docker-image:
    name: Build Docker image and push to repositories
    # run only when code is compiling and tests are passing
    needs: build-and-test-code
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      # setup Docker buld action
      - name: Set up Docker Buildx
        id: buildx
        uses: docker/setup-buildx-action@v1

      - name: Login to DockerHub
        uses: docker/login-action@v1
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Login to Github Packages
        uses: docker/login-action@v1
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GHCR_PAT }}
      
      - name: Build image and push to Docker Hub and GitHub Container Registry
        uses: docker/build-push-action@v2
        with:
          # relative path to the place where source code (with package.json) is located
          context: ./samples/simple
          # Note: tags has to be all lower-case
          tags: |
            oskardudycz/eventsourcing.nodejs.simple:latest 
            ghcr.io/oskardudycz/eventsourcing.nodejs/simple:latest
          # build on feature branches, push only on main branch
          push: ${{ github.ref == 'refs/heads/main' }}

      - name: Image digest
        run: echo ${{ steps.docker_build.outputs.digest }}
```

## Tasks List

- [ ] Event Sourcing
  - [x] Description of Event Sourcing foundations [PR](https://github.com/oskardudycz/EventSourcing.NodeJS/pull/8)
  - [ ] Add samples of stream operations
    - [x] Retrieving the current state from events [PR](https://github.com/oskardudycz/EventSourcing.NodeJS/pull/9)
  - [ ] Add samples of Event Schema Versioning
    - [ ] Breaking changes examples
    - [ ] Basic versioning strategies
      - [ ] Double write
    - [ ] Weak Schema
  - [ ] Add EventStoreDB gRPC client samples with basic streams operations
  - [ ] Add samples of Subscriptions and projections
- [ ] Configuration
  - [x] Initial ExpressJS boilerplate configuration [PR](https://github.com/oskardudycz/EventSourcing.NodeJS/pull/1)
  - [x] Add VSCode debugging configuration [PR](https://github.com/oskardudycz/EventSourcing.NodeJS/pull/2)
  - [x] Add Jest unit test configuration with VSCode debug settings [PR](https://github.com/oskardudycz/EventSourcing.NodeJS/pull/3)
  - [x] Continuous Integration - Run tests with Github Actions [PR](https://github.com/oskardudycz/EventSourcing.NodeJS/pull/4)
  - [x] Add Jest API tests with SuperTest [PR](https://github.com/oskardudycz/EventSourcing.NodeJS/pull/5)
  - [x] Continuous Delivery - Build Docker image and publish to Docker Hub and GitHub Container Registry [PR](https://github.com/oskardudycz/EventSourcing.NodeJS/pull/6)
  - [ ] Configure Swagger
- [ ] Start Live Coding on Twitch
- [ ] Create project template like `Create React App` for creating `EventStoreDB Node.js App`
  - Links:
    - https://dev.to/duwainevandriel/build-your-own-project-template-generator-59k4
    - https://medium.com/@pongsatt/how-to-build-your-own-project-templates-using-node-cli-c976d3109129
    - https://medium.com/northcoders/creating-a-project-generator-with-node-29e13b3cd309
    - https://github.com/jondot/hygen
- [ ] Add React application

[<img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" height="20px" />](https://www.linkedin.com/in/oskardudycz/) [![Subscribe](https://img.shields.io/badge/%F0%9F%9A%80-subscribe!-important)](https://www.architecture-weekly.com/?utm_source=github_architecture_weekly) [![Github Sponsors](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&link=https://github.com/sponsors/oskardudycz/)](https://github.com/sponsors/oskardudycz/) [![blog](https://img.shields.io/badge/blog-event--driven.io-brightgreen)](https://event-driven.io/?utm_source=architecture_weekly) 

# EventSourcing.NodeJS

Tutorial, practical samples and other resources about Event Sourcing in NodeJS. See also my similar repositories for [.NET](https://github.com/oskardudycz/EventSourcing.NetCore) and [JVM](https://github.com/oskardudycz/EventSourcing.JVM).

- [EventSourcing.NodeJS](#eventsourcingnodejs)
  - [Event Sourcing](#event-sourcing)
    - [What is Event Sourcing?](#what-is-event-sourcing)
    - [What is Event?](#what-is-event)
    - [What is Stream?](#what-is-stream)
    - [Event representation](#event-representation)
    - [Retrieving the current state from events](#retrieving-the-current-state-from-events)
    - [Event Store](#event-store)
  - [Videos](#videos)
    - [Introduction to Event Sourcing in TypeScript and NodeJS with EventStoreDB](#introduction-to-event-sourcing-in-typescript-and-nodejs-with-eventstoredb)
    - [Event-Driven revolution, from CRUD to Event Sourcing](#event-driven-revolution-from-crud-to-event-sourcing)
    - [Let's build the worst Event Sourcing system!](#lets-build-the-worst-event-sourcing-system)
    - [The Light and The Dark Side of the Event-Driven Design](#the-light-and-the-dark-side-of-the-event-driven-design)
    - [Conversation with Yves Lorphelin about CQRS](#conversation-with-yves-lorphelin-about-cqrs)
  - [Articles](#articles)
  - [Samples](#samples)
  - [Self-paced training Kit Introduction to Event Sourcing](#self-paced-training-kit-introduction-to-event-sourcing)
  - [Exercises](#exercises)
  - [Node.js project configuration](#nodejs-project-configuration)
    - [General configuration](#general-configuration)
    - [VSCode debug configuration](#vscode-debug-configuration)
    - [Unit tests with Vitest](#unit-tests-with-vitest)
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

Thanks for that, no business data is lost. Each operation results in the event stored in the database. That enables extended auditing and diagnostics capabilities (both technically and business-wise). What's more, as events contains the business context, it allows wide business analysis and reporting.

In this repository I'm showing different aspects, patterns around Event Sourcing. From the basic to advanced practices.

Read more in my article:

- 📝 [How using events helps in a teams' autonomy](https://event-driven.io/en/how_using_events_help_in_teams_autonomy/?utm_source=event_sourcing_nodejs)
- 📝 [When not to use Event Sourcing?](https://event-driven.io/en/when_not_to_use_event_sourcing/?utm_source=event_sourcing_nodejs)

### What is Event?

Events, represent facts in the past. They carry information about something accomplished. It should be named in the past tense, e.g. _"user added"_, _"order confirmed"_. Events are not directed to a specific recipient - they're broadcasted information. It's like telling a story at a party. We hope that someone listens to us, but we may quickly realise that no one is paying attention.

Events:

- are immutable: _"What has been seen, cannot be unseen"_.
- can be ignored but cannot be retracted (as you cannot change the past).
- can be interpreted differently. The basketball match result is a fact. Winning team fans will interpret it positively. Losing team fans - not so much.

Read more in my articles:

- 📝 [What's the difference between a command and an event?](https://event-driven.io/en/whats_the_difference_between_event_and_command/?utm_source=event_sourcing_nodejs)
- 📝 [Events should be as small as possible, right?](https://event-driven.io/en/events_should_be_as_small_as_possible/?utm_source=event_sourcing_nodejs)

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

  "data": {
    "issuedTo": {
      "name": "Oscar the Grouch",
      "address": "123 Sesame Street"
    },
    "amount": 34.12,
    "number": "INV/2021/11/01",
    "issuedAt": "2021-11-01T00:05:32.000Z"
  },

  "metadata": {
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

Several things are going on here:

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
  type: "invoice-issued";
  data: {
    number: string;
    issuedBy: string;
    issuedAt: Date;
  };
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
type INVOICE_ISSUED = "invoice-issued";

// person DTO used in issued by event data
type Person = Readonly<{
  name: string;
  address: string;
}>;

// event type definition
type InvoiceIssued = Event<
  INVOICE_ISSUED,
  {
    issuedTo: Person;
    amount: number;
    number: string;
    issuedAt: Date;
  }
>;
```

then create it as:

```typescript
const invoiceIssued: InvoiceIssued = {
  type: "invoice-issued",
  data: {
    issuedTo: {
      name: "Oscar the Grouch",
      address: "123 Sesame Street",
    },
    amount: 34.12,
    number: "INV/2021/11/01",
    issuedAt: new Date(),
  },
};
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

    "data": {
      "issuedTo": {
        "name": "Oscar the Grouch",
        "address": "123 Sesame Street"
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

    "data": {
      "issuedBy": "Cookie Monster",
      "issuedAt": "2021-11-01T00:11:32.000Z"
    }
  },
  {
    "id": "637cfe0f-ed38-4595-8b17-2534cc706abf",
    "type": "invoice-sent",
    "streamId": "INV/2021/11/01",
    "streamPosition": 3,
    "timestamp": "2021-11-01T00:12:01.000Z",

    "data": {
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
  "invoice-initiated",
  {
    number: string;
    amount: number;
    issuedTo: Person;
    initiatedAt: Date;
  }
>;

type InvoiceIssued = Event<
  "invoice-issued",
  {
    number: string;
    issuedBy: string;
    issuedAt: Date;
  }
>;

type InvoiceSent = Event<
  "invoice-sent",
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
    case "invoice-initiated":
      return {
        number: event.data.number,
        amount: event.data.amount,
        status: InvoiceStatus.INITIATED,
        issuedTo: event.data.issuedTo,
        initiatedAt: event.data.initiatedAt,
      };
    case "invoice-issued": {
      return {
        ...currentState,
        status: InvoiceStatus.ISSUED,
        issued: {
          by: event.data.issuedBy,
          at: event.data.issuedAt,
        },
      };
    }
    case "invoice-sent": {
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
      throw "Unexpected event type";
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

if (!isInvoice(result)) throw "Invoice state is not valid!";

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
    console.warn("No type check method was provided in the aggregate method");
    return <Aggregate>state;
  }

  if (!check(state)) throw "Aggregate state is not valid";

  return state;
}
```

See full sample: [link](./samples/foundations/src/invoices/invoice.unit.test.ts).

Read more in my article:

- 📝 [Why Partial<Type> is an extremely useful TypeScript feature?](https://event-driven.io/en/partial_typescript/?utm_source=event_sourcing_nodejs)
- 📝 [How to get the current entity state from events?](https://event-driven.io/en/how_to_get_the_current_entity_state_in_event_sourcing/?utm_source=event_sourcing_nodejs)

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

In the further samples, I'll use [KurrentDB](https://docs.kurrent.io/). It's the battle-tested OSS database created and maintained by the Event Sourcing authorities. It supports many dev environments via gRPC clients, including NodeJS.

Read more in my article:

- 📝 [What if I told you that Relational Databases are in fact Event Stores?](https://event-driven.io/en/relational_databases_are_event_stores/=event_sourcing_nodejs)

## Videos

### Introduction to Event Sourcing in TypeScript and NodeJS with EventStoreDB

<a href="https://www.youtube.com/watch?v=5pc7abhle_Q" target="_blank"><img src="https://img.youtube.com/vi/5pc7abhle_Q/0.jpg" alt="Introduction to Event Sourcing in TypeScript and NodeJS with EventStoreDB" width="320" height="240" border="10" /></a>

### Event-Driven revolution, from CRUD to Event Sourcing

<a href="https://www.architecture-weekly.com/p/webinar-1-from-crud-to-event-sourcing" target="_blank"><img src="https://substackcdn.com/image/fetch/w_1920,h_1080,c_fill,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-video.s3.amazonaws.com%2Fvideo_upload%2Fpost%2F69390705%2Fd71d5510-0aca-4fa9-aa6e-01fbbf29ac1d%2Ftranscoded-00002.png" alt="vent-Driven revolution, from CRUD to Event Sourcing" width="320" height="240" border="10" /></a>

### Let's build the worst Event Sourcing system!

<a href="https://www.youtube.com/watch?v=Lu-skMQ-vAw" target="_blank"><img src="https://img.youtube.com/vi/Lu-skMQ-vAw/0.jpg" alt="Let's build the worst Event Sourcing system!" width="320" height="240" border="10" /></a>

### The Light and The Dark Side of the Event-Driven Design

<a href="https://www.youtube.com/watch?v=ZGugOiYcq8k" target="_blank"><img src="https://img.youtube.com/vi/ZGugOiYcq8k/0.jpg" alt="The Light and The Dark Side of the Event-Driven Design" width="320" height="240" border="10" /></a>

### Conversation with [Yves Lorphelin](https://github.com/ylorph/) about CQRS

<a href="https://www.youtube.com/watch?v=D-3N2vQ7ADE" target="_blank"><img src="https://img.youtube.com/vi/D-3N2vQ7ADE/0.jpg" alt="Event Store Conversations: Yves Lorphelin talks to Oskar Dudycz about CQRS (EN)" width="320" height="240" border="10" /></a>

## Articles

Read also more on the **Event Sourcing** and **CQRS** topics in my [blog](https://event-driven.io/?utm_source=event_sourcing_nodejs) posts:

- 📝 [What's the difference between a command and an event?](https://event-driven.io/en/whats_the_difference_between_event_and_command/?utm_source=event_sourcing_nodejs)
- 📝 [Events should be as small as possible, right?](https://event-driven.io/en/events_should_be_as_small_as_possible/?utm_source=event_sourcing_nodejs)
- 📝 [How to get the current entity state from events?](https://event-driven.io/en/how_to_get_the_current_entity_state_in_event_sourcing/?utm_source=event_sourcing_nodejs)
- 📝 [How to ensure uniqueness in Event Sourcing](https://event-driven.io/en/uniqueness-in-event-sourcing/?utm_source=event_sourcing_nodejs)
- 📝 [Why a bank account is not the best example of Event Sourcing?](https://event-driven.io/en/bank_account_event_sourcing/?utm_source=event_sourcing_nodejs)
- 📝 [How using events helps in a teams' autonomy](https://event-driven.io/en/how_using_events_help_in_teams_autonomy/?utm_source=event_sourcing_nodejs)
- 📝 [How to (not) do the events versioning?](https://event-driven.io/en/how_to_do_event_versioning/?utm_source=event_sourcing_nodejs)
- 📝 [CQRS facts and myths explained](https://event-driven.io/en/cqrs_facts_and_myths_explained/?utm_source=event_sourcing_nodejs)
- 📝 [Can command return a value?](https://event-driven.io/en/can_command_return_a_value/?utm_source=event_sourcing_nodejs)
- 📝 [How to slice the codebase effectively?](https://event-driven.io/en/how_to_slice_the_codebase_effectively/?utm_source=event_sourcing_nodejs)
- 📝 [Generic does not mean Simple](https://event-driven.io/en/generic_does_not_mean_simple/?utm_source=event_sourcing_nodejs)- 📝 [How to use ETag header for optimistic concurrency](https://event-driven.io/en/how_to_use_etag_header_for_optimistic_concurrency/?utm_source=event_sourcing_nodejs)
- 📝 [Dealing with Eventual Consistency and Idempotency in MongoDB projections](https://event-driven.io/en/dealing_with_eventual_consistency_and_idempotency_in_mongodb_projections/?utm_source=event_sourcing_nodejs)
- 📝 [Long-polling, how to make our async API synchronous](https://event-driven.io/en/long_polling_and_eventual_consistency/?utm_source=event_sourcing_nodejs)
- 📝 [A simple trick for idempotency handling in the Elastic Search read model](https://event-driven.io/en/simple_trick_for_idempotency_handling_in_elastic_search_readm_model/?utm_source=event_sourcing_nodejs)
- 📝 [How to (not) do the events versioning?](https://event-driven.io/en/how_to_do_event_versioning/?utm_source=event_sourcing_nodejs)
- 📝 [Simple patterns for events schema versioning](https://event-driven.io/en/simple_events_versioning_patterns/?utm_source=event_sourcing_nodejs)
- 📝 [How to create projections of events for nested object structures?](https://event-driven.io/en/how_to_create_projections_of_events_for_nested_object_structures/?utm_source=event_sourcing_nodejs)
- 📝 [How to scale projections in the event-driven systems?](https://event-driven.io/en/how_to_scale_projections_in_the_event_driven_systems/?utm_source=event_sourcing_nodejs)
- 📝 [Immutable Value Objects are simpler and more useful than you think!](https://event-driven.io/en/immutable_value_objects/?utm_source=event_sourcing_nodejs)
- 📝 [How using events helps in a teams' autonomy](https://event-driven.io/en/how_using_events_help_in_teams_autonomy/?utm_source=event_sourcing_nodejs)
- 📝 [What texting your Ex has to do with Event-Driven Design?](https://event-driven.io/en/what_texting_ex_has_to_do_with_event_driven_design/?utm_source=event_sourcing_nodejs)
- 📝 [What if I told you that Relational Databases are in fact Event Stores?](https://event-driven.io/en/relational_databases_are_event_stores/?utm_source=event_sourcing_nodejs)
- 📝 [Optimistic concurrency for pessimistic times](https://event-driven.io/en/optimistic_concurrency_for_pessimistic_times/?utm_source=event_sourcing_nodejs)
- 📝 [Outbox, Inbox patterns and delivery guarantees explained](https://event-driven.io/en/outbox_inbox_patterns_and_delivery_guarantees_explained/?utm_source=event_sourcing_nodejs)
- 📝 [Saga and Process Manager - distributed processes in practice](https://event-driven.io/en/saga_process_manager_distributed_transactions/?utm_source=event_sourcing_nodejs)

## Samples

1. Simple Event Sourcing sample: [samples/simple](./samples/simple).
2. Basic CQRS with Event Sourcing and projections building read models: [samples/webinar](./samples/webinar).
3. From CRUD to Event Sourcing: [samples/from_crud_to_eventsourcing](./samples/from_crud_to_eventsourcing).
## Self-paced training Kit Introduction to Event Sourcing

Event Sourcing is perceived as a complex pattern. Some believe that it's like Nessie, everyone's heard about it, but rarely seen it. In fact, Event Sourcing is a pretty practical and straightforward concept. It helps build predictable applications closer to business. Nowadays, storage is cheap, and information is priceless. In Event Sourcing, no data is lost.

The workshop aims to build the knowledge of the general concept and its related patterns for the participants. The acquired knowledge will allow for the conscious design of architectural solutions and the analysis of associated risks.

You can do the workshop as a self-paced kit. That should give you a good foundation for starting your journey with Event Sourcing and learning tools like KurrentDB.

**If you'd like to get full coverage with all nuances of the private workshop, check [training page on my blog for more details](https://event-driven.io/en/training/) feel free to contact me via [email](mailto:oskar.dudycz@gmail.com).**

Read also more in my article [Introduction to Event Sourcing - Self Paced Kit](https://event-driven.io/en/introduction_to_event_sourcing/?utm_source=event_sourcing_nodejs).

## Exercises

Follow the instructions in exercises folders.

1. [Events definition](./workshops/introduction_to_event_sourcing/src/01_events_definition/).
2. [Getting State from events](./workshops/introduction_to_event_sourcing/src/02_getting_state_from_events/).
3. Appending Events:
   - [Raw KurrentDB](./workshops/introduction_to_event_sourcing/src/03_appending_events_kurrentdb/)
   - [Emmett with various storages (PostgreSQL, KurrentDB, MongoDB)](./workshops/introduction_to_event_sourcing/src/04_appending_events_emmett/)
4. Getting State from events
   - [Raw KurrentDB](./workshops/introduction_to_event_sourcing/src/05_getting_state_from_events_kurrentdb/)
   - [Emmett with various storages (PostgreSQL, KurrentDB, MongoDB)](./workshops/introduction_to_event_sourcing/src/06_getting_state_from_events_emmett/)
5. Business Logic:
   - [Writing](./workshops/introduction_to_event_sourcing/src/07_business_logic/)
   - [Testing](./workshops/introduction_to_event_sourcing/src/08_business_logic/)
6. Application logic:
   - [KurrentDB](./workshops/introduction_to_event_sourcing/src/09_application_logic_kurrentdb/)
7. Optimistic Concurrency:
   - [KurrentDB](./workshops/introduction_to_event_sourcing/src/10_optimistic_concurrency_kurrentdb/)
8. Projections:
   - [General](./workshops/introduction_to_event_sourcing/src/11_projections_single_stream/)
   - [Idempotency](./workshops/introduction_to_event_sourcing/src/12_projections_single_stream_idempotency/)
   - [Eventual Consistency](./workshops/introduction_to_event_sourcing/src/13_projections_single_stream_eventual_consistency/)


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
   - mark the project as ECMAScript Modules and set the minimum Node.js version in [package.json](./samples/simple/package.json), and the exact version in [.nvmrc](./samples/simple/.nvmrc):
   ```json
   {
     "type": "module",
     "engines": {
       "node": ">=24.22.1"
     }
   }
   ```
4. [TypeScript](https://www.typescriptlang.org/) - We'll be doing Type Driven Development
   - install it together with types for `Node.js` and `Express`. We're using TypeScript 7 native compiler (`tsgo`) for builds and TypeScript 6 for tools that still need the JavaScript compiler API (e.g. ESLint):
   ```bash
   npm i -D typescript@npm:@typescript/typescript6 @typescript/native@npm:typescript@^7 @types/express @types/node
   ```
   - add TypeScript compiler build command to NPM:
   ```json
   {
     "scripts": {
       "build:ts": "tsc -b",
       "build:ts:watch": "tsc -b --watch"
     }
   }
   ```
   - create the [tsconfig.json](./samples/simple/tsconfig.json) file, e.g.:
   ```json
   {
     "exclude": ["**/node_modules", "**/tmp", "**/dist", "**/lib"],
     "compilerOptions": {
       "target": "ESNext",
       "verbatimModuleSyntax": true,
       "module": "ESNext",
       "lib": ["ESNext"],
       "outDir": "./dist",
       "rootDir": "./src",
       "strict": true,
       "strictNullChecks": true,
       "noImplicitReturns": true,
       "moduleResolution": "bundler",
       "types": ["node"],
       "esModuleInterop": true,
       "rewriteRelativeImportExtensions": true,
       "resolveJsonModule": true,
       "moduleDetection": "force",
       "skipLibCheck": true,
       "forceConsistentCasingInFileNames": true
     },
     "include": ["./src/**/*"]
   }
   ```
5. [ESLint](https://eslint.org) - We'd like to have static code analysis:

   - install together with [typescript-eslint](https://typescript-eslint.io):

   ```bash
   npm i -D eslint @eslint/js globals @typescript-eslint/eslint-plugin @typescript-eslint/parser
   ```

   - add [eslint.config.mjs](./samples/simple/eslint.config.mjs) with the flat ESLint configuration. Ignored files are defined there too:

   ```javascript
   import js from '@eslint/js';
   import typescriptEslint from '@typescript-eslint/eslint-plugin';
   import globals from 'globals';

   export default [
     {
       ignores: [
         'vitest.config.ts',
         'tsdown.config.ts',
         'eslint.config.mjs',
         '**/dist/',
         '**/node_modules',
         '**/*.d.ts',
       ],
     },
     js.configs.recommended,
     ...typescriptEslint.configs['flat/recommended'],
     ...typescriptEslint.configs['flat/recommended-type-checked'],
     {
       languageOptions: {
         globals: {
           ...globals.node,
         },
         parserOptions: {
           project: './tsconfig.json',
         },
       },
       rules: {
         'no-unused-vars': 'off',
         '@typescript-eslint/no-unused-vars': [
           'error',
           {
             varsIgnorePattern: '^_',
             argsIgnorePattern: '^_',
           },
         ],
         '@typescript-eslint/consistent-type-imports': [
           'error',
           {
             prefer: 'type-imports',
             fixStyle: 'separate-type-imports',
           },
         ],
       },
     },
   ];
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
   - add Prettier plugin to [eslint.config.mjs](./samples/simple/eslint.config.mjs) to make sure that they don't collide with each other. ESLint formats TypeScript files, Prettier formats the rest:
   ```javascript
   import js from '@eslint/js';
   import typescriptEslint from '@typescript-eslint/eslint-plugin';
   import prettierRecommended from 'eslint-plugin-prettier/recommended'; // <-- added
   import globals from 'globals';

   export default [
     // (...)
     ...typescriptEslint.configs['flat/recommended-type-checked'],
     prettierRecommended, // <-- added
     // (...)
   ];
   ```
   - if you're using VSCode, I recommend to install [Prettier plugin](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
7. Define tasks for ESLint and Prettier in [package.json](./samples/simple/package.json). We're using [npm-run-all2](https://github.com/bcomnes/npm-run-all2) (`npm i -D npm-run-all2`) to run them one after another:
   - checks:
   ```json
   {
     "scripts": {
       "lint": "run-s lint:eslint lint:prettier",
       "lint:prettier": "prettier --cache --check \"**/**/*.{json,md}\"",
       "lint:eslint": "eslint --cache \"**/*.ts\""
     }
   }
   ```
   - fixes:
   ```json
   {
     "scripts": {
       "fix": "run-s fix:eslint fix:prettier",
       "fix:prettier": "prettier --cache --write \"**/**/*.{json,md}\"",
       "fix:eslint": "eslint --cache \"**/*.ts\" --fix"
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
    import type { Application, Request, Response } from "express";
    import express from "express";
    import http from "http";
    
    const app: Application = express();
    const server = http.createServer(app);
    
    app.get("/", (req: Request, res: Response) => {
      res.json({ greeting: "Hello World!" });
    });
    
    const PORT = 5000;
    
    server.listen(PORT);
    
    server.on("listening", () => {
      console.info("server up listening");
    });
    ```
    This will create an Express application that will be listening on port `5000` and return the JSON (with dummy data greeting with `"Hello World!"`). 

10. [tsx](https://tsx.is/) to run TypeScript code directly and have hot-reload of the running Express server code. 
    - install:
    ```bash
    npm i -D tsx
    ```
    - add script to [package.json](./samples/simple/package.json) to run Express server in watch mode:
    ```json
    {
      "scripts": {
        "dev:start": "tsx watch src/index.ts",
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

To use the TypeScript 7 native language service in VSCode, install the [TypeScript Native Preview](https://marketplace.visualstudio.com/items?itemName=TypeScriptTeam.native-preview) extension and enable it in [settings.json](./samples/simple/.vscode/settings.json):

```json
{
  "js/ts.experimental.useTsgo": true
}
```

Recommended extensions are listed in [extensions.json](./samples/simple/.vscode/extensions.json).

### Unit tests with Vitest

1. Install [Vitest](https://vitest.dev/). It runs TypeScript files directly, so no additional transformer is needed.

```bash
npm i -D vitest
```

2. Add [vitest.config.ts](./samples/simple/vitest.config.ts) with the Vitest configuration. It tells Vitest where are our test files and to resolve the `paths` from `tsconfig.json`:

```typescript
import { defineConfig } from 'vitest/config';

const localMaxWorkers = process.env.CI ? {} : { maxWorkers: '50%' };

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/lib/**'],
    hookTimeout: 30_000,
    testTimeout: 30_000,
    ...localMaxWorkers,
  },
});
```

3. Let's add some dummy code to make sure that our tests are working. This can be e.g. `src/greetings/getGreeting.ts`

```typescript
export function getGreeting() {
  return {
    greeting: "Hello World!",
  };
}
```

4. Let's add also some dummy unit test running this code. I'll put it in the same directory, as in my opinion it makes easier development and focus on the specific test instead of jumping from one place to another. In this case it will be `src/greetings/getGreetings.unit.test.ts`. Test functions are imported explicitly from `vitest`:

```typescript
import { getGreeting } from "./getGreeting";
import { describe, expect, it } from "vitest";

describe("getGreeting", () => {
  it('should return greeting "Hello World!"', () => {
    const result = getGreeting();

    expect(result).toBeDefined();
    expect(result.greeting).toBe("Hello World!");
  });
});
```

5. To run Vitest we need to add new NPM script to [package.json](./samples/simple/package.json):

```json
{
  "scripts": {
    "test:unit": "vitest run unit --passWithNoTests"
  }
}
```

Now you can run them with:

```bash
npm run test:unit
```

Vitest will run all test files with `unit` in their path, so all files with `.unit.test.ts` suffix. Running `npx vitest` without `run` starts it in watch mode.

6. To be able to debug our tests we have to add new debug configuration to [launch.json](./samples/simple/.vscode/launch.json). It runs the currently opened test file. You can also install the [Vitest extension](https://marketplace.visualstudio.com/items?itemName=vitest.explorer) to run and debug tests from the editor.

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Current Test File",
      "type": "node",
      "request": "launch",
      "autoAttachChildProcesses": true,
      "skipFiles": ["<node_internals>/**", "**/node_modules/**"],
      "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
      "args": ["run", "${file}", "--no-file-parallelism"],
      "smartStep": true,
      "console": "integratedTerminal",
      "cwd": "${workspaceFolder}"
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
import type { Application, Request, Response } from "express";
import express from "express";
import { getGreeting } from "./greetings/getGreeting";

const app: Application = express();

app.get("/", (_req: Request, res: Response) => {
  res.json(getGreeting());
});

export default app;
```

Our updated intex will look like:

```typescript
import app from "./app";
import http from "http";

const server = http.createServer(app);

const PORT = 5000;

server.listen(PORT);

server.on("listening", () => {
  console.info("server up listening");
});
```

Let's create the test for the default route. For that, create a file, e.g. `getGreetings.api.test.ts`. We'll be using a different prefix, `api.test.ts`, as those tests are not unit but integration/acceptance. They will be running the Express server. Having the Express app extracted, we can use the `SuperTest` library as:

```typescript
import request from "supertest";
import app from "../app";
import { describe, it } from "vitest";

describe("GET /", () => {
  it('should return greeting "Hello World!"', () => {
    return request(app)
      .get("/")
      .expect("Content-Type", /json/)
      .expect(200, { greeting: "Hello World!" });
  });
});
```

`SuperTest` wraps the Express app and making the API calls easier. It also provides a set of useful methods to check the response params.

As the final step we'll add a separate NPM script to [package.json](./samples/simple/package.json) for running API tests and also script to run all of them.

```json
{
  "scripts": {
    "test": "run-s test:unit test:api", // <-- added
    "test:unit": "vitest run unit --passWithNoTests",
    "test:api": "vitest run api --passWithNoTests" // <-- added
  }
}
```

### Continuous Integration - Run tests with Github Actions

It's important to have your changes be verified during the pull request process. We'll use GitHub Actions as a sample of how to do that. You need to create the [.github/workflows](./.github/workflows) folder and putt there new file (e.g. [samples_simple.yml](./.github/workflows/samples_simple.yml)). This file will contain YAML configuration for your action:

The simplest setup will look like this. It takes the Node.js version from the `.nvmrc` file, so you have it defined in one place:

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
      - uses: actions/checkout@v6
      - name: Use Node.js
        uses: actions/setup-node@v6
        with:
          node-version-file: ./samples/simple/.nvmrc
          cache: "npm"
          cache-dependency-path: "./samples/simple/package-lock.json"
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
        node-version: [24.x, 26.x]

    steps:
      - uses: actions/checkout@v6
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v6
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

The basis of the Docker configuration is an image definition. It's defined as the text file and usually named by convention as `Dockerfile`. It starts with information of which base image we'll be using and then customisation. Most of the technologies provide various types of base images. We'll use `node:24-alpine`, matching the Node.js version from `.nvmrc`. Alpine type of image is recommended as usually the smallest with a minimum set of dependencies.

The best practice for building the docker image is to use [multistage build](https://docs.docker.com/develop/develop-images/multistage-build/) feature. It allows to use at the first image with all build dependencies, build artefacts and copy it to the final _"smaller"_ image.

Each line in the Dockerfile will create a separate _layer_. Such _layer_ is immutable, and if the file, if this line was not changed or, e.g. copied file in this file, was not changed, it won't be rebuilt and reused. That's why it's essential to at first copy files that are changed rarely (e.g. `package.json` file and running installing node modules), then copy source codes.

Node.js can't run ES Modules with extensionless relative imports, so for the image we bundle the code with [tsdown](https://tsdown.dev/) (`npm i -D tsdown`). Its configuration is in [tsdown.config.ts](./samples/simple/tsdown.config.ts), and it's run by the `build:bundle` NPM script:

```typescript
import { defineConfig } from 'tsdown';

export default defineConfig({
  format: ['esm'],
  fixedExtension: false,
  target: 'esnext',
  outDir: 'dist',
  entry: ['src/index.ts'],
  sourcemap: true,
  deps: {
    skipNodeModulesBundle: true,
  },
  tsconfig: 'tsconfig.json',
});
```

[Sample Dockerfile](./samples/simple/Dockerfile) looks like:

```dockerfile
########################################
#  First stage of multistage build
########################################
#  Use Build image with label `builder
########################################
# use
FROM node:24-alpine AS builder

# Setup working directory for project
WORKDIR /app

COPY ./package.json ./
COPY ./package-lock.json ./
COPY ./tsconfig.json ./
COPY ./tsdown.config.ts ./

# install node modules
# use `npm ci` instead of `npm install`
# to install exact version from `package-lock.json`
RUN npm ci

# Copy project files
COPY src ./src

# Build project
RUN npm run build:bundle

# sets environment to production
# and removes packages from devDependencies
RUN npm prune --production

########################################
#  Second stage of multistage build
########################################
#  Use other build image as the final one
#    that won't have source codes
########################################
FROM node:24-alpine

# Setup working directory for project
WORKDIR /app

# Copy published in previous stage binaries
# from the `builder` image
COPY --from=builder /app/package.json ./package.json
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
version: "3.5"
services:
  app:
    build:
      # use local image
      dockerfile: Dockerfile
      context: .
    container_name: eventsourcing_js
    ports:
      - "5555:5000"
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
$ docker compose build
```

5. Show running containers

```bash
$ docker ps
```

6. Show all containers (also stopped)

```bash
$ docker ps -a
```

7. Start services with docker compose

```bash
$ docker compose up
```

8. Kill all services from docker compose

```bash
$ docker compose kill
```

6. Remove all services and clean the data from docker compose

```bash
$ docker compose down -v
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
        node-version: [18.x, 20.10.x]

    steps:
      - uses: actions/checkout@v4
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
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
      - uses: actions/checkout@v4

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
  - [ ] Add ExpressJS JSON and URL encode middlewares
  - [ ] Add configuration with Convict and DotEnv
  - [ ] Add description of the TypeScript path aliases
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

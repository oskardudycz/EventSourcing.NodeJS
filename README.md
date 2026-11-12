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
    - [Event Sourcing exercises](#event-sourcing-exercises)
  - [Event-Driven Architecture Workshop](#event-driven-architecture-workshop)
    - [Event-Driven Architecture exercises](#event-driven-architecture-exercises)

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

1. Basic CQRS with Event Sourcing and projections building read models: [samples/webinar](./samples/webinar).
2. From CRUD to Event Sourcing: [samples/from_crud_to_eventsourcing](./samples/from_crud_to_eventsourcing).
3. Decider pattern with a shopping cart, ETag-based optimistic concurrency and MongoDB read models: [samples/decider](./samples/decider).
4. Events versioning with simple mappings, upcasters, downcasters, transformations and explicit serialisation: [samples/eventsVersioning](./samples/eventsVersioning).
5. Snapshots of the cash register stream in KurrentDB: [samples/snapshots](./samples/snapshots).
6. Closing the books with cashier shifts and stream archivisation: [samples/closingTheBooks](./samples/closingTheBooks).
7. Group checkout process in hotel management, implemented as a saga, a process manager and a workflow: [samples/hotelManagement](./samples/hotelManagement).
8. Unpeeling the onion, the same e-commerce flow in layered and vertical slice structure: [samples/unpeelingOnion](./samples/unpeelingOnion).

## Self-paced training Kit Introduction to Event Sourcing

Event Sourcing is perceived as a complex pattern. Some believe that it's like Nessie, everyone's heard about it, but rarely seen it. In fact, Event Sourcing is a pretty practical and straightforward concept. It helps build predictable applications closer to business. Nowadays, storage is cheap, and information is priceless. In Event Sourcing, no data is lost.

The workshop aims to build the knowledge of the general concept and its related patterns for the participants. The acquired knowledge will allow for the conscious design of architectural solutions and the analysis of associated risks.

You can do the workshop as a self-paced kit. That should give you a good foundation for starting your journey with Event Sourcing and learning tools like KurrentDB.

**If you'd like to get full coverage with all nuances of the private workshop, check [training page on my blog for more details](https://event-driven.io/en/training/) feel free to contact me via [email](mailto:oskar.dudycz@gmail.com).**

Read also more in my article [Introduction to Event Sourcing - Self Paced Kit](https://event-driven.io/en/introduction_to_event_sourcing/?utm_source=event_sourcing_nodejs).

### Event Sourcing exercises

Follow the instructions in exercises folders. See the [workshop README](./workshops/introduction_to_event_sourcing/) for setup.

1. [Events definition](./workshops/introduction_to_event_sourcing/src/01_events_definition/).
2. [Getting State from events](./workshops/introduction_to_event_sourcing/src/02_getting_state_from_events/).
3. Appending Events:
   - [Raw KurrentDB](./workshops/introduction_to_event_sourcing/src/03_appending_events_kurrentdb/)
   - [Emmett with various storages (PostgreSQL, KurrentDB, MongoDB)](./workshops/introduction_to_event_sourcing/src/04_appending_events_emmett/)
4. Getting State from events:
   - [Raw KurrentDB](./workshops/introduction_to_event_sourcing/src/05_getting_state_from_events_kurrentdb/)
   - [Emmett with various storages (PostgreSQL, KurrentDB, MongoDB)](./workshops/introduction_to_event_sourcing/src/06_getting_state_from_events_emmett/)
5. Business Logic:
   - [Writing](./workshops/introduction_to_event_sourcing/src/07_business_logic/)
   - [Testing](./workshops/introduction_to_event_sourcing/src/08_business_logic_tests/)
6. Application logic:
   - [KurrentDB](./workshops/introduction_to_event_sourcing/src/09_application_logic_kurrentdb/)
7. Optimistic Concurrency:
   - [KurrentDB](./workshops/introduction_to_event_sourcing/src/10_optimistic_concurrency_kurrentdb/)
8. Projections:
   - [General](./workshops/introduction_to_event_sourcing/src/11_projections_single_stream/)
   - [Idempotency](./workshops/introduction_to_event_sourcing/src/12_projections_single_stream_idempotency/)
   - [Eventual Consistency](./workshops/introduction_to_event_sourcing/src/13_projections_single_stream_eventual_consistency/)
   - [Emmett](./workshops/introduction_to_event_sourcing/src/14_projections_single_stream_emmett/)
9. Business Processes:
   - [Events definition](./workshops/introduction_to_event_sourcing/src/15_processes_events_definition/)
   - [Entities definition](./workshops/introduction_to_event_sourcing/src/16_processes_entities_definition/)
   - [Business processes](./workshops/introduction_to_event_sourcing/src/17_business_processes/)

## Event-Driven Architecture Workshop

The workshop builds Event-Driven Architecture knowledge step by step on a single domain, a hotel's guest stays and group checkouts. You start with modelling events and entities, then coordinate a business process across modules and make it survive duplicates, parallel updates and failures. Everything runs in memory, so you don't need Docker.

### Event-Driven Architecture exercises

Follow the instructions in exercises folders. See the [workshop README](./workshops/event_driven_architecture/) for setup.

1. [Events definition](./workshops/event_driven_architecture/src/01_events_definition/).
2. [Entities definition](./workshops/event_driven_architecture/src/02_entities_definition/).
3. [Business processes](./workshops/event_driven_architecture/src/03_business_processes/).
4. [Idempotency](./workshops/event_driven_architecture/src/04_idempotency/).
5. [Optimistic concurrency](./workshops/event_driven_architecture/src/05_optimistic_concurrency/).
6. [Consistency](./workshops/event_driven_architecture/src/06_consistency/).

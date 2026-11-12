[<img src="https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white" height="20px" />](https://www.linkedin.com/in/oskardudycz/) [![Github Sponsors](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&link=https://github.com/sponsors/oskardudycz/)](https://github.com/sponsors/oskardudycz/) [![blog](https://img.shields.io/badge/blog-event--driven.io-brightgreen)](https://event-driven.io/?utm_source=event_sourcing_nodejs) [![blog](https://img.shields.io/badge/%F0%9F%9A%80-Architecture%20Weekly-important)](https://www.architecture-weekly.com/?utm_source=event_sourcing_nodejs)

# Event Schema Versioning

- [Event Schema Versioning](#event-schema-versioning)
  - [Simple mapping](#simple-mapping)
    - [New not required property](#new-not-required-property)
    - [New required property](#new-required-property)
    - [Renamed property](#renamed-property)
  - [Upcasting](#upcasting)
    - [Changed structure](#changed-structure)
    - [New required property from metadata](#new-required-property-from-metadata)
  - [Downcasting](#downcasting)
  - [Events transformations](#events-transformations)
  - [Explicit serialisation](#explicit-serialisation)
  - [Migrations](#migrations)
  - [Running the sample](#running-the-sample)
  - [Summary](#summary)

As time flows, the events' definition may change. Our business is changing, and we need to add more information. Sometimes we have to fix a bug or modify the definition for a better developer experience.

Migrations are never easy, even in relational databases. You always have to think about:

- what caused the change?
- what are the possible solutions?
- is the change breaking?
- what to do with old data?

We should always try to perform the change in a non-breaking manner. I explained that in [Let's take care of ourselves! Thoughts on compatibility](https://event-driven.io/en/lets_take_care_of_ourselves_thoughts_about_comptibility/?utm_source=event_sourcing_nodejs) article.

The same "issues" happen for the event data model. Greg Young wrote a book about it. You can read it for free: https://leanpub.com/esversioning/read. I recommend you to read it.

This sample shows how to do basic Event Schema versioning in TypeScript. Those patterns can be applied to any event store. Integration tests show them with [KurrentDB](https://www.kurrent.io/).

Read also my articles:

- [How to (not) do the events versioning?](https://event-driven.io/en/how_to_do_event_versioning/?utm_source=event_sourcing_nodejs)
- [Simple patterns for events schema versioning](https://event-driven.io/en/simple_events_versioning_patterns/?utm_source=event_sourcing_nodejs)
- [Structural typing in TypeScript](https://event-driven.io/en/structural_typing_in_type_script/?utm_source=event_sourcing_nodejs)

All samples start from the [initial events definition](./src/events/events.v1.ts), e.g.:

```typescript
export type ShoppingCartOpened = Event<
  'ShoppingCartOpened',
  {
    shoppingCartId: string;
    clientId: string;
  }
>;
```

## Simple mapping

Some changes can be handled at the type or serialisation level. TypeScript uses structural typing, and `JSON.parse` is not typed, so the parsed object may have more or fewer fields than its type says. The samples use a small [JSONParser](./src/core/jsonParser.ts) wrapper that allows plugging a `map` function into parsing and stringifying.

### New not required property

If we'd like to add a new not required property, e.g. `openedAt`, we can add it as an optional property. The essential fact to decide if that's the right strategy is if we're good with not having it defined.

```typescript
export type ShoppingCartOpened = Event<
  'ShoppingCartOpened',
  {
    shoppingCartId: string;
    clientId: string;
    // Adding new not required property as nullable
    openedAt?: string;
  }
>;
```

Old events will be parsed without the new property, new events will contain the whole information.

See full sample: [newNotRequiredProperty.unit.test.ts](./src/01_simple_mappings/newNotRequiredProperty.unit.test.ts).

### New required property

We must define a default value if we'd like to add a new required property and make it non-breaking. It's the same as adding a new column with a default value to a relational table.

For instance, we decide that we'd like to add a validation step when the shopping cart is opened (e.g. for fraud or spam detection), and our shopping cart can be opened with a pending state. We could solve that by adding the new property with the status information and setting it to `Opened`, assuming that all old events were appended using the older logic.

```typescript
enum ShoppingCartStatus {
  Pending = 'Pending',
  Opened = 'Opened',
  Confirmed = 'Confirmed',
  Canceled = 'Canceled',
}

export type ShoppingCartOpened = Event<
  'ShoppingCartOpened',
  {
    shoppingCartId: string;
    clientId: string;
    status: ShoppingCartStatus;
  }
>;
```

Default `JSON.parse` won't set the status, so we need to map it while parsing:

```typescript
const event = JSONParser.parse<ShoppingCartOpenedV1, ShoppingCartOpened>(json, {
  map: (value: ShoppingCartOpened): ShoppingCartOpened => {
    return {
      ...value,
      data: {
        ...value.data,
        status: value.data.status ?? ShoppingCartStatus.Opened,
      },
    };
  },
});
```

See full sample: [newRequiredProperty.unit.test.ts](./src/01_simple_mappings/newRequiredProperty.unit.test.ts).

### Renamed property

Renaming a property is also a breaking change. Still, we can do it in a non-breaking manner by mapping it during (de)serialisation.

Let's assume that we concluded that keeping the `shoppingCart` prefix in the `shoppingCartId` is redundant and decided to change it to `cartId`, as we see in the event name what cart we have in mind.

```typescript
export type ShoppingCartOpened = Event<
  'ShoppingCartOpened',
  {
    cartId: string;
    clientId: string;
  }
>;
```

We can map the old property while parsing:

```typescript
const event = JSONParser.parse<ShoppingCartOpenedV1, ShoppingCartOpened>(json, {
  map: (
    value: ShoppingCartOpenedV1 | ShoppingCartOpened,
  ): ShoppingCartOpened => {
    return {
      ...value,
      data: {
        ...value.data,
        cartId:
          'cartId' in value.data
            ? value.data.cartId
            : value.data.shoppingCartId,
      },
    };
  },
});
```

To stay backward compatible, we can also write both the old and the new property name. The downside is that we keep the old JSON structure, so all consumers need to be aware of that and do the mapping if they want to use the new structure.

See full sample: [renamedProperty.unit.test.ts](./src/01_simple_mappings/renamedProperty.unit.test.ts).

## Upcasting

Sometimes we want to make more significant changes or be more flexible in the event mapping. We'd like to use a new structure in our code, not polluted by the custom mappings.

We can use the upcasting pattern for that. We plug a function between the deserialisation and the application logic. It takes the event in the old structure and transforms it to the new schema.

### Changed structure

For instance, we decide to send also other information about the client, instead of just their id. We'd like to have a nested object instead of the flattened list of fields:

```typescript
export type Client = {
  id: string;
  name: string;
};

export type ShoppingCartOpened = Event<
  'ShoppingCartOpened',
  {
    shoppingCartId: string;
    client: Client;
  }
>;
```

The upcaster handles both the old and the new structure:

```typescript
const upcast = ({
  data,
}: ShoppingCartOpenedV1 | ShoppingCartOpened): ShoppingCartOpened => {
  const client =
    'client' in data ? data.client : { id: data.clientId, name: 'Unknown' };

  return {
    type: 'ShoppingCartOpened',
    data: {
      shoppingCartId: data.shoppingCartId,
      client,
    },
  };
};

const event = JSONParser.parse<ShoppingCartOpenedV1, ShoppingCartOpened>(json, {
  map: upcast,
});
```

See full sample: [changedStructure.unit.test.ts](./src/02_upcasters/changedStructure.unit.test.ts).

### New required property from metadata

We can also solve the same cases as simple mappings, but we have more handling options.

Let's say that we forgot to add information about who opened the shopping cart (user id). We cannot retroactively guess who the user was, but if we were lucky enough to track such information in event metadata (e.g. for tracing), we could map it:

```typescript
export type EventMetadata = {
  userId: string;
};

export type ShoppingCartOpened = Event<
  'ShoppingCartOpened',
  {
    shoppingCartId: string;
    clientId: string;
    initializedBy: string;
  }
>;

const upcast = ({
  data,
  metadata: { userId },
}: EventWithMetadata<
  ShoppingCartOpenedV1 | ShoppingCartOpened
>): ShoppingCartOpened => {
  const initializedBy = 'initializedBy' in data ? data.initializedBy : userId;
  return {
    type: 'ShoppingCartOpened',
    data: {
      shoppingCartId: data.shoppingCartId,
      clientId: data.clientId,
      initializedBy,
    },
  };
};
```

See full sample: [newRequiredPropertyFromMetadata.unit.test.ts](./src/02_upcasters/newRequiredPropertyFromMetadata.unit.test.ts).

## Downcasting

In the same way, we can downcast the events from the new structure to the old one (if we have the old reader/listener or, for some reason, want to keep the old format):

```typescript
const downcast = ({
  data,
}: ShoppingCartOpened): ShoppingCartOpenedV1 & ShoppingCartOpened => {
  return {
    type: 'ShoppingCartOpened',
    data: {
      ...data,
      clientId: data.client.id,
    },
  };
};

const json = JSONParser.stringify(event, { map: downcast });
```

The stored event contains both the new nested `client` and the old `clientId`, so both old and new readers can use it.

See full sample: [changedStructure.unit.test.ts](./src/03_downcasters/changedStructure.unit.test.ts).

## Events transformations

At this point, you may be wondering, "That's nice, but how to connect that with real code?". Let's dive into that.

We plug in between the serialisation and the application logic, as explained initially. We register upcasters and downcasters by the stored event type:

```typescript
export class EventTransformations {
  #upcasters = new Map<string, (event: Event) => Event>();
  #downcasters = new Map<string, (event: Event) => Event>();

  public register = {
    upcaster: <From extends Event, To extends Event = From>(
      eventType: string,
      upcaster: (event: From) => To,
    ) => {
      this.#upcasters.set(eventType, (event) => upcaster(event as From));

      return this.register;
    },
    downcaster: <From extends Event, To extends Event = From>(
      eventType: string,
      downcaster: (event: From) => To,
    ) => {
      this.#downcasters.set(eventType, (event) => downcaster(event as From));

      return this.register;
    },
  };

  public get = {
    upcaster: (eventType: string) => this.#upcasters.get(eventType),
    downcaster: (eventType: string) => this.#downcasters.get(eventType),
  };
}
```

The parser uses them when reading and writing events:

```typescript
export class EventParser {
  constructor(private eventTransformations: EventTransformations) {}

  public parse<E extends Event = Event>({ type, payload }: StoredEvent) {
    const upcaster = this.eventTransformations.get.upcaster(type);

    const result = JSONParser.parse(payload, upcaster ? { map: upcaster } : {});

    return result as E;
  }

  public stringify<E extends Event = Event>(event: E): StoredEvent {
    const downcaster = this.eventTransformations.get.downcaster(event.type);

    return {
      type: event.type,
      payload: JSONParser.stringify(
        event,
        downcaster ? { map: downcaster } : {},
      ),
    };
  }
}
```

Having that, we can register all transformations once and read all versions of the event (`ShoppingCartOpened`, `ShoppingCartOpened.v2`, `ShoppingCartOpened.v3`) as the newest one:

```typescript
const eventTransformations = new EventTransformations();
eventTransformations.register
  .upcaster('ShoppingCartOpened', upcastShoppingCartOpened)
  .upcaster('ShoppingCartOpened.v2', upcastShoppingCartOpened)
  .downcaster('ShoppingCartOpened.v3', downcastShoppingCartOpened);

const parser = new EventParser(eventTransformations);
```

The logic is simple. It either transforms the event through registered transformations or runs the regular deserialisation.

See full samples:

- [multipleTransformationsWithDifferentEventTypes.unit.test.ts](./src/04_transformations/multipleTransformationsWithDifferentEventTypes.unit.test.ts),
- [multipleTransformationsWithDifferentEventTypes.int.test.ts](./src/04_transformations/multipleTransformationsWithDifferentEventTypes.int.test.ts) showing how to apply them in practice with KurrentDB, including rebuilding the shopping cart state from events in all versions.

## Explicit serialisation

Instead of registering transformations, we can define the stored payload as a separate type and map it explicitly. The payload type contains all stored versions, and the domain event type contains only the current one:

```typescript
export type ShoppingCartEventPayload =
  | {
      type: 'ShoppingCartOpened';
      data: { shoppingCartId: string; clientId: string };
    }
  | {
      type: 'ShoppingCartOpened.v2';
      data: { shoppingCartId: string; clientId: string; client: Client };
    }
  | {
      type: 'ShoppingCartOpened.v3';
      data: {
        shoppingCartId: string;
        // obsolete, kept for backward and forward compatibility
        clientId: string;
        client: Client;
        status: ShoppingCartStatus;
      };
    };
// (...) other events
```

`ShoppingCartEventSerde` has `serialize` and `deserialize` functions. They use `switch` on the event type, so the TypeScript compiler checks that we handled all versions. It's also a good place to map types that JSON doesn't support, e.g. `Date` to and from ISO strings:

```typescript
export const ShoppingCartEventSerde = {
  serialize: ({ type, data }: ShoppingCartEvent): ShoppingCartEventPayload => {
    switch (type) {
      case 'ShoppingCartOpened': {
        return {
          type: 'ShoppingCartOpened.v3',
          data: {
            shoppingCartId: data.shoppingCartId,
            clientId: data.client.id,
            client: data.client,
            status: data.status,
          },
        };
      }
      case 'ShoppingCartConfirmed': {
        return {
          type,
          data: { ...data, confirmedAt: data.confirmedAt.toISOString() },
        };
      }
      // (...) other events
    }
  },
  deserialize: ({
    type,
    data,
  }: ShoppingCartEventPayload): ShoppingCartEvent => {
    switch (type) {
      case 'ShoppingCartOpened': {
        return {
          type: 'ShoppingCartOpened',
          data: {
            shoppingCartId: data.shoppingCartId,
            client: { id: data.clientId, name: 'Unknown' },
            status: ShoppingCartStatus.Opened,
          },
        };
      }
      // (...) other events
    }
  },
};
```

It's more code than the generic transformations, but it's explicit and type-safe.

See full samples:

- [serde.unit.test.ts](./src/05_explicitSerialisation/serde.unit.test.ts),
- [serde.int.test.ts](./src/05_explicitSerialisation/serde.int.test.ts) showing it with KurrentDB.

## Migrations

You can say that, well, those patterns are not migrations. Events will stay as they were, and you'll have to keep the old structure forever. That's quite true. Still, this is fine, as typically, you should not change the past. Having precise information, even including bugs, is a valid scenario. It allows you to get insights and see the precise history. However, pragmatically you may sometimes want to have a "clean" event log with only a new schema.

Composing the patterns described above can support such a case. For example, with KurrentDB you can read or subscribe to the event stream, transform events and store them in a new stream, or even a new KurrentDB cluster. Having that, you could even rewrite the whole log and switch databases once the new one caught up.

## Running the sample

1. Install Node.js in the version from [.nvmrc](./.nvmrc) (or better using NVM).
2. Install packages: `npm install`.
3. Run all tests: `npm test`. Integration tests start KurrentDB through [Testcontainers](https://testcontainers.com/), so they need Docker running.
4. Run only unit tests with `npm run test:unit`, or only integration tests with `npm run test:int`.

## Summary

I hope that those samples will show you that you can support many versioning scenarios with basic composition techniques.

Nevertheless, the best approach is to [not need to do versioning at all](https://event-driven.io/en/how_to_do_event_versioning/?utm_source=event_sourcing_nodejs). If you're facing such a need, before using the strategies described above, make sure that your business scenario cannot be solved by talking to the business. It may appear that there's some flaw in the business process modelling. We should not be trying to fix the issue, but the root cause.

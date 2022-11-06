import { Collection, Document, Filter, ObjectId } from 'mongodb';

export const CommandHandler =
  <Command, State extends Document & { _id: ObjectId }, Event>(
    collection: Collection<State>,
    evolve: (state: State, event: Event) => State
  ) =>
  async (
    id: string,
    command: Command,
    decide: (command: Command, state: State) => Event
  ) => {
    const result = await collection.findOne({
      _id: new ObjectId(id),
    } as Filter<State>);

    const state = (result ?? {}) as State;

    const event = decide(command, state);

    await collection.updateOne(
      { _id: state._id } as Filter<State>,
      { $set: evolve(state, event) },
      { upsert: true }
    );

    //await this.eventBus.publish(event);
  };

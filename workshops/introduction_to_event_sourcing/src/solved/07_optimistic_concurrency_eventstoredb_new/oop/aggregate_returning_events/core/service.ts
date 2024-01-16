import { Event } from '../../../tools/events';
import { Repository } from './repository';

export abstract class ApplicationService<Entity, StreamEvent extends Event> {
  constructor(protected repository: Repository<Entity, StreamEvent>) {}

  protected on = async (
    id: string,
    handle: (state: Entity) => StreamEvent | StreamEvent[],
    options?: { expectedRevision?: bigint | 'no_stream' },
  ) => {
    const aggregate = await this.repository.find(id);

    const result = handle(aggregate);

    return this.repository.store(
      id,
      Array.isArray(result) ? result : [result],
      options,
    );
  };
}

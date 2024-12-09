import { Event } from '../../../tools/events';
import { Repository } from './repository';

export abstract class ApplicationService<Entity, StreamEvent extends Event> {
  constructor(protected repository: Repository<Entity, StreamEvent>) {}

  protected on = async (
    id: string,
    handle: (state: Entity) => StreamEvent | StreamEvent[],
  ) => {
    const aggregate = await this.repository.find(id);

    const result = handle(aggregate);

    if (Array.isArray(result)) return this.repository.store(id, ...result);
    else return this.repository.store(id, result);
  };
}

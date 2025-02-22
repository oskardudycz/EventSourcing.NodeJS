import { type Repository } from './repository';

export abstract class ApplicationService<Entity> {
  constructor(protected repository: Repository<Entity>) {}

  protected on = async (
    id: string,
    handle: (state: Entity) => void | Entity,
    options?: { expectedRevision?: bigint },
  ) => {
    const aggregate = await this.repository.find(id, options);

    const result = handle(aggregate) ?? aggregate;

    return this.repository.store(id, result, options);
  };
}

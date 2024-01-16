import { Repository } from './repository';

export abstract class ApplicationService<Entity> {
  constructor(protected repository: Repository<Entity>) {}

  protected on = async (
    id: string,
    handle: (state: Entity) => void | Entity,
  ) => {
    const aggregate = await this.repository.find(id);

    const result = handle(aggregate) ?? aggregate;

    await this.repository.store(id, result);
  };
}

export interface Mapper<Aggregate, Model> {
  toModel(aggregate: Aggregate): Model;
  toAggregate(model: Model): Aggregate;
}

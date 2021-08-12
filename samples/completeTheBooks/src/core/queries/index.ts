export type Query<
  QueryType extends string = string,
  QueryData extends Record<string, unknown> = Record<string, unknown>,
  QueryMetadata extends Record<string, unknown> = Record<string, unknown>
> = {
  readonly type: QueryType;
  readonly data: QueryData;
  metadata?: Readonly<QueryMetadata>;
};

export function isQuery<
  QueryType extends string = string,
  QueryData extends Record<string, unknown> = Record<string, unknown>,
  QueryMetadata extends Record<string, unknown> = Record<string, unknown>
>(event: any): event is Query<QueryType, QueryData, QueryMetadata> {
  return typeof event.type !== 'undefined' && typeof event.data !== 'undefined';
}

export class CustomerShoppingHistoryItem {
  constructor(
    public readonly customerId: string,
    public readonly shoppingCartId: string,
    public readonly status: string,
    public readonly totalCount: number,
  ) {}
}

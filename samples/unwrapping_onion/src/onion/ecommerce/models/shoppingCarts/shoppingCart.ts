import { ObjectId } from 'mongodb';
import { ProductItem } from 'src/onion/ecommerce/common/shoppingCarts/productItem';

export class ShoppingCartModel {
  constructor(
    public _id: ObjectId,
    public customerId: string,
    public status: string,
    public productItems: ProductItem[],
    public openedAt: Date,
    public confirmedAt: Date | undefined,
    public revision: number
  ) {}
}

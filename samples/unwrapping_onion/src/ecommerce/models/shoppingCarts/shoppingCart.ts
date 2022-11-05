import { ObjectId } from 'mongodb';
import { ProductItem } from 'src/ecommerce/common/shoppingCarts/productItem';

export class ShoppingCartModel {
  constructor(
    public _id: ObjectId,
    public clientId: string,
    public status: string,
    public productItems: ProductItem[],
    public openedAt: Date,
    public confirmedAt: Date | undefined,
    public revision: number
  ) {}
}

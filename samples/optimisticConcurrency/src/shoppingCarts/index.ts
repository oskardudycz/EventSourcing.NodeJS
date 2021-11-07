import { Router } from 'express';
import { route as routeOpenShoppingCart } from './opening';
import { route as routeAddProductItem } from './addingProductItem';
import { route as routeRemoveProductItem } from './removingProductItem';
import { route as routeConfirmShoppingCart } from './confirming';
import { route as routeGetShoppingCartById } from './gettingById';

export const shoppingCartRouter = Router();

routeOpenShoppingCart(shoppingCartRouter);
routeAddProductItem(shoppingCartRouter);
routeRemoveProductItem(shoppingCartRouter);
routeConfirmShoppingCart(shoppingCartRouter);
routeGetShoppingCartById(shoppingCartRouter);
export * from './shoppingCart';

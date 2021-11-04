import { Router } from 'express';
import { route as routeConfirmShoppingCart } from './opening';

export const shoppingCartRouter = Router();

routeConfirmShoppingCart(shoppingCartRouter);
export * from './shoppingCart';

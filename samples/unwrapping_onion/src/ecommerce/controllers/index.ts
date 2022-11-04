import { CommandBusFactory } from '#core/commands';
import { QueryBusFactory } from '#core/queries';
import ShoppingCartController from './shoppingCartController';

const controllers = [
  new ShoppingCartController(CommandBusFactory(), QueryBusFactory()).router,
];

export default controllers;

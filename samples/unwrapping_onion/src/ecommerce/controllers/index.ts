import { CommandBusFactory } from '#core/commands';
import ShoppingCartController from './shoppingCartController';

const controllers = [new ShoppingCartController(CommandBusFactory()).router];

export default controllers;

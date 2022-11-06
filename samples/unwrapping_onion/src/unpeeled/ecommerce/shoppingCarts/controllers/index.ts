import { EventBusFactory } from '#core/events';
import { MongoClient } from 'mongodb';
import { ShoppingCartController } from './shoppingCartController';

export const getControllers = (mongo: MongoClient) => {
  return [new ShoppingCartController(mongo, EventBusFactory()).router];
};

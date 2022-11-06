import { EventBusFactory } from '#core/events';
import { QueryBusFactory } from '#core/queries';
import { MongoClient } from 'mongodb';
import { ShoppingCartMapper } from '../application/mappers/shoppingCartMapper';
import { ShoppingCartController } from './shoppingCartController';

export const getControllers = (mongo: MongoClient) => {
  const shoppingCartMapper = new ShoppingCartMapper();
  return [
    new ShoppingCartController(
      mongo,
      shoppingCartMapper,
      EventBusFactory(),
      QueryBusFactory()
    ).router,
  ];
};

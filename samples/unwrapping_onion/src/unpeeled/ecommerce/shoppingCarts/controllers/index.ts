import { EventBusFactory } from '#core/events';
import { QueryBusFactory } from '#core/queries';
import { MongoClient } from 'mongodb';
import { ShoppingCartMapper } from '../application/mappers/shoppingCartMapper';
import { ShoppingCartRepository } from '../infrastructure/shoppingCartRepository';
import { ShoppingCartController } from './shoppingCartController';

export const getControllers = (mongo: MongoClient) => {
  const repository = new ShoppingCartRepository(mongo);
  const shoppingCartMapper = new ShoppingCartMapper();
  return [
    new ShoppingCartController(
      repository,
      shoppingCartMapper,
      EventBusFactory(),
      QueryBusFactory()
    ).router,
  ];
};

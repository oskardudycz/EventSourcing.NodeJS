import { getApplication } from '#core/api';
import { MongoClient } from 'mongodb';
import registerHandlers from './shoppingCarts/application';
import controllers from './shoppingCarts/controllers';

const initApp = (mongo: MongoClient) => {
  registerHandlers(mongo);
  return getApplication(...controllers);
};

export default initApp;

import { getApplication } from '#core/api';
import { MongoClient } from 'mongodb';
import registerHandlers from './application/shoppingCarts';
import controllers from './controllers';

const initApp = (mongo: MongoClient) => {
  registerHandlers(mongo);
  return getApplication(...controllers);
};

export default initApp;

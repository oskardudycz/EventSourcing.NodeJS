import { getApplication } from '#core/api';
import { MongoClient } from 'mongodb';
import registerHandlers from './shoppingCarts/application';
import { getControllers } from './shoppingCarts/controllers';

const initApp = (mongo: MongoClient) => {
  registerHandlers(mongo);
  return getApplication(getControllers(mongo));
};

export default initApp;

import { getApplication } from '#core/api';
import { MongoClient } from 'mongodb';
import { getControllers } from './shoppingCarts/controllers';

const initApp = (mongo: MongoClient) => {
  return getApplication(getControllers(mongo));
};

export default initApp;

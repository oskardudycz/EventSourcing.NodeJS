import dotenv from 'dotenv';
import convict from 'convict';

dotenv.config();

const convictConfig = convict({
  env: {
    format: ['prod', 'dev', 'test'],
    default: 'dev',
    arg: 'nodeEnv',
    env: 'NODE_ENV',
  },
  eventStoreDB: {
    connectionString: {
      format: String,
      default: 'esdb://localhost:2113?tls=false&throwOnAppendFailure=false',
      arg: 'ESDB_CONNECTION_STRING',
      env: 'ESDB_CONNECTION_STRING',
    },
  },
  mongoDB: {
    connectionString: {
      format: String,
      default: 'mongodb://localhost:27017',
      arg: 'MONGODB_CONNECTION_STRING',
      env: 'MONGODB_CONNECTION_STRING',
    },
    databaseName: {
      format: String,
      default: 'mongodb://localhost:27017',
      arg: 'MONGODB_DATABASE_NAME',
      env: 'MONGODB_DATABASE_NAME',
    },
  },
});

const env = convictConfig.get('env');
convictConfig.loadFile(`./config/${env}.json`);

convictConfig.validate({ allowed: 'strict' }); // throws error if config does not conform to schema

export const config = convictConfig.getProperties(); // so we can operate with a plain old JavaScript object and abstract away

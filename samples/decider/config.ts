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
  mongoDB: {
    connectionString: {
      format: String,
      default: 'mongodb://localhost:27017',
      arg: 'MONGODB_CONNECTION_STRING',
      env: 'MONGODB_CONNECTION_STRING',
    },
    databaseName: {
      format: String,
      default: 'test',
      arg: 'MONGODB_DATABASE_NAME',
      env: 'MONGODB_DATABASE_NAME',
    },
  },
});

const env = convictConfig.get('env');
const configFileName = `./config/${env}.json`;
try {
  convictConfig.loadFile(configFileName);
} catch (exc) {
  console.warn(`Configuration file not found ('${configFileName}')`);
}

convictConfig.validate({ allowed: 'strict' }); // throws error if config does not conform to schema

export const config = convictConfig.getProperties(); // so we can operate with a plain old JavaScript object and abstract away

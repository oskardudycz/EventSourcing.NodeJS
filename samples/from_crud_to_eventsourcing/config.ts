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
  postgres: {
    connectionString: {
      format: String,
      default: 'postgres://postgres:Password12!@localhost:5432/postgres',
      arg: 'DATABASE_URL',
      env: 'DATABASE_URL',
    },
    schemaName: {
      format: String,
      default: 'postgres',
      arg: 'DATABASE_SCHEMA',
      env: 'DATABASE_SCHEMA',
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

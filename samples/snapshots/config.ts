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
  kurrentDB: {
    connectionString: {
      format: String,
      default:
        'kurrentdb://localhost:2113?tls=false&throwOnAppendFailure=false',
      arg: 'KURRENTDB_CONNECTION_STRING',
      env: 'KURRENTDB_CONNECTION_STRING',
    },
  },
});

const env = convictConfig.get('env');
convictConfig.loadFile(`./config/${env}.json`);

convictConfig.validate({ allowed: 'strict' }); // throws error if config does not conform to schema

export const config = convictConfig.getProperties(); // so we can operate with a plain old JavaScript object and abstract away

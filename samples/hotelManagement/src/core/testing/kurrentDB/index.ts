import { KurrentDBClient } from '@kurrent/kurrentdb-client';
import { inject } from 'vitest';

export const getKurrentDBTestClient = (): KurrentDBClient =>
  KurrentDBClient.connectionString(inject('kurrentDBConnectionString'));

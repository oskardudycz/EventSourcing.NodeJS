//////////////////////////////////////
/// Postgres
//////////////////////////////////////

import { config } from '#config';
import { DataSource } from 'typeorm';
import {
  cartItemSchema,
  cartSchema,
  InitialMigration1672531200000,
} from '../db';

let dataSource: Promise<DataSource> | undefined;

export const getPostgres = (): Promise<DataSource> => {
  if (!config.postgres.connectionString) {
    throw new Error(
      'Postgres connection string not set. Please define "DATABASE_URL" environment variable',
    );
  }

  dataSource ??= new DataSource({
    type: 'postgres',
    url: config.postgres.connectionString,
    entities: [cartSchema, cartItemSchema],
    migrations: [InitialMigration1672531200000],
  }).initialize();

  return dataSource;
};

export const runPostgresMigrations = async () => {
  await (await getPostgres()).runMigrations();
};

export const disconnectFromPostgres = async () => {
  if (!dataSource) return;

  const current = dataSource;
  dataSource = undefined;

  try {
    await (await current).destroy();
  } catch (ex) {
    console.error(ex);
  }
};

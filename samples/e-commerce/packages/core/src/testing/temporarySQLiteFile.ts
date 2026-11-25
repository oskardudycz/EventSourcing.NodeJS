import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const temporarySQLiteFilePath = () =>
  path.join(os.tmpdir(), `e-commerce-${randomUUID()}.db`);

export const removeSQLiteFiles = async (fileName: string) => {
  for (const suffix of ['', '-wal', '-shm', '-journal'])
    await rm(`${fileName}${suffix}`, { force: true });
};

export const temporarySQLiteFolder = () =>
  mkdtempSync(path.join(os.tmpdir(), 'e-commerce-'));

export const removeSQLiteFolder = (folder: string) =>
  rm(folder, { recursive: true, force: true });

export const ensureSQLiteFolder = (folder: string) => {
  mkdirSync(folder, { recursive: true });

  return folder;
};

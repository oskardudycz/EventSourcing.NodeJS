import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const temporarySQLiteFilePath = () =>
  path.join(os.tmpdir(), `e-commerce-${randomUUID()}.db`);

export const removeSQLiteFiles = async (fileName: string) => {
  for (const suffix of ['', '-wal', '-shm', '-journal'])
    await rm(`${fileName}${suffix}`, { force: true });
};

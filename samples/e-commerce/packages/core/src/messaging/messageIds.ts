import { v5 as uuidV5 } from 'uuid';

const externalMessageNamespace = '6f1c1d6e-3f0b-4b53-9a43-5d9d6a1f6e11';

export const externalMessageId = (
  internalMessageId: string,
  externalType: string,
): string =>
  uuidV5(`${internalMessageId}:${externalType}`, externalMessageNamespace);

import { v4 as uuid } from 'uuid';

export function generateIvoiceNumber(): string {
  return uuid();
}

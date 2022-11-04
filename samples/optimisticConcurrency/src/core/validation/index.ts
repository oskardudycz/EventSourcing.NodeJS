export function isNotEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && value >= 0;
}

export function isNotNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && value > 0;
}

export type ValidationError = string;

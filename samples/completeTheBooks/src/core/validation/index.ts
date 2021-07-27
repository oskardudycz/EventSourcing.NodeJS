export function isNotEmptyString(value: any): boolean {
  return typeof value === 'string' && value.length > 0;
}

export function isPositiveNumber(value: any): boolean {
  return typeof value === 'number' && value >= 0;
}

export function isNotNegativeNumber(value: any): boolean {
  return typeof value === 'number' && value > 0;
}

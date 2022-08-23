//////////////////////////////////////
/// Validation
//////////////////////////////////////

export const enum ValidationErrors {
  NOT_A_NONEMPTY_STRING = 'NOT_A_NONEMPTY_STRING',
  NOT_A_POSITIVE_NUMBER = 'NOT_A_POSITIVE_NUMBER',
  NOT_AN_UNSIGNED_BIGINT = 'NOT_AN_UNSIGNED_BIGINT',
}

export const assertNotEmptyString = (value: any): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw ValidationErrors.NOT_A_NONEMPTY_STRING;
  }
  return value;
};

export const assertPositiveNumber = (value: any): number => {
  if (typeof value !== 'number' || value <= 0) {
    throw ValidationErrors.NOT_A_POSITIVE_NUMBER;
  }
  return value;
};

export const assertUnsignedBigInt = (value: string): bigint => {
  const number = BigInt(value);
  if (number < 0) {
    throw ValidationErrors.NOT_AN_UNSIGNED_BIGINT;
  }
  return number;
};

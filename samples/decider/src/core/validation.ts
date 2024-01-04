//////////////////////////////////////
/// Validation
//////////////////////////////////////

export const enum ValidationErrors {
  NOT_A_NONEMPTY_STRING = 'NOT_A_NONEMPTY_STRING',
  NOT_A_POSITIVE_NUMBER = 'NOT_A_POSITIVE_NUMBER',
  NOT_AN_UNSIGNED_BIGINT = 'NOT_AN_UNSIGNED_BIGINT',
}

export const assertNotEmptyString = (value: unknown): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw ValidationErrors.NOT_A_NONEMPTY_STRING;
  }
  return value;
};

export const assertPositiveNumber = (
  value: string | number | undefined,
): number => {
  if (value === undefined) throw ValidationErrors.NOT_A_POSITIVE_NUMBER;

  const number = typeof value === 'number' ? value : Number(value);

  if (number <= 0) {
    throw ValidationErrors.NOT_A_POSITIVE_NUMBER;
  }
  return number;
};

export const assertBigInt = (value: string): bigint => {
  return BigInt(value);
};

export const assertUnsignedBigInt = (value: string): bigint => {
  const number = assertBigInt(value);
  if (number < 0) {
    throw ValidationErrors.NOT_AN_UNSIGNED_BIGINT;
  }
  return number;
};

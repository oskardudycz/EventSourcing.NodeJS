//////////////////////////////////////
/// Validation
//////////////////////////////////////

export const enum ValidationErrors {
  NOT_A_NONEMPTY_STRING = 'NOT_A_NONEMPTY_STRING',
  NOT_A_STRING_OR_UNDEFINED = 'NOT_A_STRING_OR_UNDEFINED',
  NOT_A_POSITIVE_NUMBER = 'NOT_A_POSITIVE_NUMBER',
  NOT_AN_UNSIGNED_BIGINT = 'NOT_AN_UNSIGNED_BIGINT',
  NOT_AN_ARRAY = 'NOT_AN_ARRAY',
}

export const assertNotEmptyString = (value: any): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw ValidationErrors.NOT_A_NONEMPTY_STRING;
  }
  return value;
};

export const assertStringOrUndefined = (value: any): string | undefined => {
  if (value !== undefined && typeof value !== 'string') {
    throw ValidationErrors.NOT_A_STRING_OR_UNDEFINED;
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

export const assertArray = (value: any): [] => {
  if (!Array.isArray(value)) {
    throw ValidationErrors.NOT_AN_ARRAY;
  }
  return value as [];
};

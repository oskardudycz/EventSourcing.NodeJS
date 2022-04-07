//////////////////////////////////////
/// Validation
//////////////////////////////////////

export const enum ValidationErrors {
  NOT_A_NONEMPTY_STRING = 'NOT_A_NONEMPTY_STRING',
  NOT_A_STRING_OR_UNDEFINED = 'NOT_A_STRING_OR_UNDEFINED',
  NOT_A_POSITIVE_NUMBER = 'NOT_A_POSITIVE_NUMBER',
  NOT_A_POSITIVE_NUMBER_OR_UNDEFINED = 'NOT_A_POSITIVE_NUMBER_OR_UNDEFINED',
  NOT_AN_UNSIGNED_BIGINT = 'NOT_AN_UNSIGNED_BIGINT',
  NOT_AN_ARRAY = 'NOT_AN_ARRAY',
}

export const assertNotEmptyString = (value: unknown): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw ValidationErrors.NOT_A_NONEMPTY_STRING;
  }
  return value;
};

export const assertStringOrUndefined = (value: unknown): string | undefined => {
  if (value != null && typeof value !== 'string') {
    throw ValidationErrors.NOT_A_STRING_OR_UNDEFINED;
  }
  return value ?? undefined;
};

export const assertPositiveNumber = (value: unknown): number => {
  if (typeof value !== 'number' || value <= 0) {
    throw ValidationErrors.NOT_A_POSITIVE_NUMBER;
  }
  return value;
};

export const assertPositiveNumberOrUndefined = (
  value: unknown
): number | undefined => {
  return value != null ? assertPositiveNumber(value) : value ?? undefined;
};

export const assertUnsignedBigInt = (value: string): bigint => {
  const number = BigInt(value);
  if (number < 0) {
    throw ValidationErrors.NOT_AN_UNSIGNED_BIGINT;
  }
  return number;
};

export const assertArray = (value: unknown): [] => {
  if (!Array.isArray(value)) {
    throw ValidationErrors.NOT_AN_ARRAY;
  }
  return value as [];
};

export const assertArrayOrUndefined = (value: unknown): [] | undefined => {
  return value != null ? assertArray(value) : value ?? undefined;
};

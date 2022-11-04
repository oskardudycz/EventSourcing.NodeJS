export type ErrorWithType = { type: string };

export type ErrorWithStatusAndMessage = { status: number; message: string };

export const isErrorWithType = (error: unknown): error is ErrorWithType => {
  return typeof error === 'object' && error !== null && 'type' in error;
};

export const isErrorWithStatusAndMessage = (
  error: unknown
): error is ErrorWithStatusAndMessage => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    'message' in error
  );
};

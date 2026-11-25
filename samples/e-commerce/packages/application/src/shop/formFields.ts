export const formField = (
  body: Record<string, unknown>,
  name: string,
): string => {
  const value = body[name];

  return typeof value === 'string' ? value : '';
};

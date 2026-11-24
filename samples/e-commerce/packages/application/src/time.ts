export const isBefore = (time: string, other: string | undefined) =>
  other !== undefined && Date.parse(time) < Date.parse(other);

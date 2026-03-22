/**
 * UUID Guard Utility
 * Ensures a string is a valid UUIDv7 (or compatible) before processing.
 */
export const assertUuid = (value: string): string => {
  // Regex for UUIDv7 (Project standard uses UUIDv7 BINARY(16))
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(value)) {
    throw new Error(`Invalid UUID format: ${value}`);
  }

  return value;
};

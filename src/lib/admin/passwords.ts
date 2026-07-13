export function generateTemporaryPassword() {
  const part = () => Math.random().toString(36).slice(2, 6);
  return `Kano-${part()}${part().toUpperCase()}!`;
}

export const TEMPORARY_PASSWORD_MIN_LENGTH = 8;

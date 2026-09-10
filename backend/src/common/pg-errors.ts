import { QueryFailedError } from 'typeorm';

export function isUniqueViolation(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) {
    return false;
  }
  const driver = err.driverError as { code?: string };
  return driver.code === '23505';
}

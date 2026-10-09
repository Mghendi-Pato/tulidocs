/** Fail fast on boot if required configuration is missing or unsafe. */
export function validateEnv(config: Record<string, unknown>) {
  const errors: string[] = [];
  if (!config.DATABASE_URL) errors.push('DATABASE_URL is required');
  const secret = String(config.JWT_SECRET ?? '');
  if (secret.length < 32) errors.push('JWT_SECRET must be at least 32 characters');
  if (config.NODE_ENV === 'production') {
    if (/change-me|dev-secret/i.test(secret)) errors.push('JWT_SECRET must be changed for production');
    if (config.MPESA_MODE === 'mock') errors.push('MPESA_MODE=mock is not allowed in production');
    if (config.CARD_MODE === 'mock') errors.push('CARD_MODE=mock is not allowed in production');
  }
  if (errors.length) {
    throw new Error(`Invalid environment configuration:\n  - ${errors.join('\n  - ')}`);
  }
  return config;
}

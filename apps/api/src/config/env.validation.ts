/** Fail fast on boot if required configuration is missing or unsafe. */
export function validateEnv(config: Record<string, unknown>) {
  const errors: string[] = [];
  if (!config.DATABASE_URL) errors.push('DATABASE_URL is required');
  const secret = String(config.JWT_SECRET ?? '');
  if (secret.length < 32) errors.push('JWT_SECRET must be at least 32 characters');
  if (config.NODE_ENV === 'production') {
    if (/change-me|dev-secret/i.test(secret)) errors.push('JWT_SECRET must be changed for production');
    // Mock payments hand out paid features for free, so production needs an explicit, temporary opt-in (testing phase)
    const allowMock = String(config.ALLOW_MOCK_PAYMENTS ?? '').toLowerCase() === 'true';
    // M-Pesa through Paystack (default) follows CARD_MODE; Daraja M-Pesa has its own MPESA_MODE
    const daraja = config.MPESA_GATEWAY === 'daraja';
    const mpesaMock = daraja && (config.MPESA_MODE ?? 'mock') === 'mock';
    const mock = mpesaMock || (config.CARD_MODE ?? 'mock') === 'mock';
    if (mock && !allowMock) {
      if (mpesaMock) errors.push('MPESA_MODE=mock is not allowed in production (set ALLOW_MOCK_PAYMENTS=true only while testing)');
      if ((config.CARD_MODE ?? 'mock') === 'mock') errors.push('CARD_MODE=mock is not allowed in production (set ALLOW_MOCK_PAYMENTS=true only while testing)');
    }
    if (mock && allowMock) {
      console.warn('\x1b[33m[tuli] WARNING: mock payments are ON in production (ALLOW_MOCK_PAYMENTS=true) — anyone can unlock documents and plans for free. Turn this off before launch.\x1b[0m');
    }
  }
  if (errors.length) {
    throw new Error(`Invalid environment configuration:\n  - ${errors.join('\n  - ')}`);
  }
  return config;
}

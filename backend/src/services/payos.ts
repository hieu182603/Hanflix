import { PayOS } from '@payos/node';
import { env } from '../config/env.js';
import { AppError } from '../errors/app-error.js';

let client: PayOS | undefined;
export function payosConfigured() {
  return Boolean(env.PAYOS_CLIENT_ID && env.PAYOS_API_KEY && env.PAYOS_CHECKSUM_KEY);
}
export function getPayOS() {
  if (!payosConfigured()) throw new AppError(503, 'PAYOS_NOT_CONFIGURED', 'Thanh toán payOS chưa được cấu hình');
  return client ??= new PayOS({
    clientId: env.PAYOS_CLIENT_ID, apiKey: env.PAYOS_API_KEY, checksumKey: env.PAYOS_CHECKSUM_KEY,
    timeout: 15000, maxRetries: 1, logLevel: 'off',
  });
}

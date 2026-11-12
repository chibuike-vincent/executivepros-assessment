import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export type AppConfig = {
  env: string;
  host: string;
  port: number;
  logLevel: string;
  dataFile: string;
  processorDelayMs: number;
  processorFailureRate: number;
  processorConcurrency: number;
  processorMaxAttempts: number;
};

function parseInteger(
  value: string | undefined,
  fallback: number,
  minimum = 1,
): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed >= minimum ? parsed : fallback;
}

function parseRate(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? '');
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return fallback;
  }
  return parsed;
}

export const config: AppConfig = {
  env: process.env.NODE_ENV ?? 'development',
  host: process.env.HOST ?? '127.0.0.1',
  port: parseInteger(process.env.PORT, 4000),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  dataFile:
    process.env.DATA_FILE ?? path.join(process.cwd(), 'data', 'payments.json'),
  processorDelayMs: parseInteger(process.env.PROCESSOR_DELAY_MS, 1500, 0),
  processorFailureRate: parseRate(process.env.PROCESSOR_FAILURE_RATE, 0.2),
  processorConcurrency: parseInteger(process.env.PROCESSOR_CONCURRENCY, 2),
  processorMaxAttempts: parseInteger(process.env.PROCESSOR_MAX_ATTEMPTS, 3),
};

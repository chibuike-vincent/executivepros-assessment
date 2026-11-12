import dotenv from 'dotenv';

dotenv.config({ quiet: true });

export type AppConfig = {
  env: string;
  host: string;
  port: number;
  logLevel: string;
};

function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const config: AppConfig = {
  env: process.env.NODE_ENV ?? 'development',
  host: process.env.HOST ?? '127.0.0.1',
  port: parsePort(process.env.PORT, 4000),
  logLevel: process.env.LOG_LEVEL ?? 'info',
};

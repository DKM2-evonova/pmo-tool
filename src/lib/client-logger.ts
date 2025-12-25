'use client';

/**
 * Client-side logging utility
 * In development: logs to console
 * In production: silences debug logs, keeps errors for monitoring
 *
 * Usage:
 *   import { clientLog } from '@/lib/client-logger';
 *   clientLog.error('Failed to save', { error });
 *   clientLog.warn('Unexpected state', { state });
 *   clientLog.debug('Processing', { data }); // Only in development
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

const isDevelopment = process.env.NODE_ENV === 'development';

function formatMessage(level: LogLevel, message: string, context?: LogContext): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
}

function shouldLog(level: LogLevel): boolean {
  // Always log errors and warnings
  if (level === 'error' || level === 'warn') return true;
  // Only log debug/info in development
  return isDevelopment;
}

export const clientLog = {
  debug(message: string, context?: LogContext): void {
    if (!shouldLog('debug')) return;
    console.log(formatMessage('debug', message), context || '');
  },

  info(message: string, context?: LogContext): void {
    if (!shouldLog('info')) return;
    console.info(formatMessage('info', message), context || '');
  },

  warn(message: string, context?: LogContext): void {
    if (!shouldLog('warn')) return;
    console.warn(formatMessage('warn', message), context || '');
  },

  error(message: string, context?: LogContext): void {
    if (!shouldLog('error')) return;
    // In production, this could also send to an error tracking service
    console.error(formatMessage('error', message), context || '');
  },
};

export default clientLog;

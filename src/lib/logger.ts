/**
 * Structured Logging Utility
 * 
 * A lightweight logger that provides:
 * - Log levels (debug, info, warn, error)
 * - Structured context (operation, entity, timing)
 * - Environment-based log level filtering
 * - Easy migration path to pino/winston later
 * 
 * Usage:
 *   import { logger, createLogger } from '@/lib/logger';
 *   
 *   // Simple logging
 *   logger.info('Meeting processed', { meetingId, model });
 *   
 *   // Scoped logger
 *   const log = createLogger('llm');
 *   log.debug('Attempting Gemini call', { promptLength: prompt.length });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: string | number | boolean | null | undefined | object;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  scope?: string;
  message: string;
  context?: LogContext;
  durationMs?: number;
}

// Log level priority (higher = more severe)
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Get current log level from environment
 * Defaults to 'info' in production, 'debug' in development
 */
function getLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase() as LogLevel;
  if (envLevel && LOG_LEVELS[envLevel] !== undefined) {
    return envLevel;
  }
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  const currentLevel = getLogLevel();
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

/**
 * Format log entry for output
 */
function formatLogEntry(entry: LogEntry): string {
  const parts = [
    `[${entry.timestamp}]`,
    `[${entry.level.toUpperCase()}]`,
  ];
  
  if (entry.scope) {
    parts.push(`[${entry.scope}]`);
  }
  
  parts.push(entry.message);
  
  if (entry.durationMs !== undefined) {
    parts.push(`(${entry.durationMs}ms)`);
  }
  
  return parts.join(' ');
}

/**
 * Serialize context for logging
 * Handles circular references and large objects
 */
function serializeContext(context: LogContext): string {
  try {
    return JSON.stringify(context, (key, value) => {
      // Truncate very long strings
      if (typeof value === 'string' && value.length > 500) {
        return value.slice(0, 500) + '...[truncated]';
      }
      // Truncate arrays
      if (Array.isArray(value) && value.length > 10) {
        return [...value.slice(0, 10), `...(${value.length - 10} more items)`];
      }
      return value;
    }, 2);
  } catch {
    return '[Unable to serialize context]';
  }
}

/**
 * Output log entry
 */
function outputLog(entry: LogEntry, context?: LogContext): void {
  const formatted = formatLogEntry(entry);
  
  switch (entry.level) {
    case 'error':
      if (context) {
        console.error(formatted, '\n  Context:', serializeContext(context));
      } else {
        console.error(formatted);
      }
      break;
    case 'warn':
      if (context) {
        console.warn(formatted, '\n  Context:', serializeContext(context));
      } else {
        console.warn(formatted);
      }
      break;
    default:
      if (context) {
        console.log(formatted, '\n  Context:', serializeContext(context));
      } else {
        console.log(formatted);
      }
  }
}

/**
 * Create a log entry and output it
 */
function log(
  level: LogLevel,
  message: string,
  context?: LogContext,
  scope?: string
): void {
  if (!shouldLog(level)) return;
  
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    scope,
    message,
    context,
  };
  
  outputLog(entry, context);
}

/**
 * Logger interface
 */
interface Logger {
  debug: (message: string, context?: LogContext) => void;
  info: (message: string, context?: LogContext) => void;
  warn: (message: string, context?: LogContext) => void;
  error: (message: string, context?: LogContext) => void;
  /**
   * Create a timed operation that logs start and end
   */
  timed: <T>(
    operation: string,
    fn: () => Promise<T>,
    context?: LogContext
  ) => Promise<T>;
  /**
   * Log with explicit timing
   */
  withTiming: (
    message: string,
    durationMs: number,
    context?: LogContext
  ) => void;
}

/**
 * Create a scoped logger
 */
export function createLogger(scope: string): Logger {
  return {
    debug: (message, context) => log('debug', message, context, scope),
    info: (message, context) => log('info', message, context, scope),
    warn: (message, context) => log('warn', message, context, scope),
    error: (message, context) => log('error', message, context, scope),
    
    async timed<T>(
      operation: string,
      fn: () => Promise<T>,
      context?: LogContext
    ): Promise<T> {
      const startTime = Date.now();
      log('debug', `Starting: ${operation}`, context, scope);
      
      try {
        const result = await fn();
        const durationMs = Date.now() - startTime;
        log('info', `Completed: ${operation}`, { ...context, durationMs }, scope);
        return result;
      } catch (error) {
        const durationMs = Date.now() - startTime;
        log('error', `Failed: ${operation}`, {
          ...context,
          durationMs,
          error: error instanceof Error ? error.message : 'Unknown error',
        }, scope);
        throw error;
      }
    },
    
    withTiming(message, durationMs, context) {
      log('info', message, { ...context, durationMs }, scope);
    },
  };
}

/**
 * Default global logger
 */
export const logger = createLogger('app');

/**
 * Pre-configured loggers for different modules
 */
export const loggers = {
  llm: createLogger('llm'),
  embedding: createLogger('embedding'),
  file: createLogger('file'),
  owner: createLogger('owner'),
  publish: createLogger('publish'),
  api: createLogger('api'),
  auth: createLogger('auth'),
} as const;










/**
 * Structured Logger for HanFlix Backend
 * Features:
 * - Color-coded by log level
 * - Human-readable timestamps
 * - Pretty print in development, JSON in production
 * - Request context tracking
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

const levelColors: Record<LogLevel, string> = {
  debug: colors.gray,
  info: colors.cyan,
  warn: colors.yellow,
  error: colors.red,
  fatal: colors.bright + colors.red,
};

const levelLabels: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info: 'INFO ',
  warn: 'WARN ',
  error: 'ERROR',
  fatal: 'FATAL',
};

// Emoji for quick visual recognition
const levelEmoji: Record<LogLevel, string> = {
  debug: '',
  info: '',
  warn: '',
  error: '',
  fatal: '',
};

type LogData = Record<string, unknown>;

export function redactLogValue(value: unknown, key = ''): unknown {
  if (/password|secret|authorization|subscription.?key|api.?key|access.?key|leaseToken/i.test(key)) return '[REDACTED]';
  if (typeof value === 'string') return value
    .replace(/(https?:\/\/[^\s?'"<>]+)\?[^\s'"<>]*/gi, '$1?[REDACTED]')
    .replace(/(api[-_]?key|token|secret)\s*[:=]\s*\S+/gi, '$1=[REDACTED]');
  if (value instanceof Error) return { name: value.name, message: redactLogValue(value.message) };
  if (Array.isArray(value)) return value.map(item => redactLogValue(item));
  if (value && typeof value === 'object' && !(value instanceof Date)) return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, redactLogValue(item, name)]));
  return value;
}

/**
 * Format timestamp to readable format
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Format error object for display
 */
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return `${colors.red}${error.name}${colors.reset}: ${error.message}`;
  }
  return String(error);
}

/**
 * Format data object for display (truncated if too long)
 */
function formatData(data: LogData): string {
  if (Object.keys(data).length === 0) return '';
  
  const entries = Object.entries(data).map(([key, value]) => {
    let displayValue: string;
    
    if (value === undefined || value === null) {
      displayValue = colors.gray + 'null' + colors.reset;
    } else if (typeof value === 'object') {
      // Truncate long objects
      const str = JSON.stringify(value);
      displayValue = str.length > 100 ? str.slice(0, 100) + '...' : str;
    } else {
      displayValue = String(value);
    }
    
    // Highlight specific keys
    if (key === 'error') {
      return `  ${colors.red}${key}${colors.reset}=${displayValue}`;
    }
    if (key === 'requestId') {
      return `  ${colors.cyan}${key}${colors.reset}=${colors.gray}${displayValue}${colors.reset}`;
    }
    if (key === 'workerId' || key === 'workerId') {
      return `  ${colors.magenta}${key}${colors.reset}=${displayValue}`;
    }
    if (key === 'duration') {
      return `  ${colors.green}${key}${colors.reset}=${displayValue}ms`;
    }
    
    return `  ${colors.white}${key}${colors.reset}=${displayValue}`;
  });
  
  return entries.join('\n');
}

/**
 * Write log entry
 */
function write(level: LogLevel, data: LogData, message: string) {
  data = redactLogValue(data) as LogData;
  message = redactLogValue(message) as string;
  const timestamp = formatTime(new Date());
  const color = levelColors[level];
  const label = levelLabels[level];
  const emoji = levelEmoji[level];
  
  const isDev = process.env.NODE_ENV !== 'production';
  
  if (isDev) {
    // Pretty format for development
    const parts = [
      `${colors.gray}${timestamp}${colors.reset}`,
      `${color}[${label}]${colors.reset}`,
      emoji ? `${emoji} ${message}` : message,
    ];
    
    const dataStr = formatData(data);
    if (dataStr) {
      console.log(parts.join(' '));
      console.log(dataStr);
    } else {
      console.log(parts.join(' '));
    }
  } else {
    // JSON format for production
    const entry = JSON.stringify({
      level,
      time: new Date().toISOString(),
      message,
      ...data,
    });
    
    if (level === 'error' || level === 'fatal') {
      console.error(entry);
    } else if (level === 'warn') {
      console.warn(entry);
    } else {
      console.log(entry);
    }
  }
}

export const logger = {
  debug: (data: LogData, message: string) => write('debug', data, message),
  info: (data: LogData, message: string) => write('info', data, message),
  warn: (data: LogData, message: string) => write('warn', data, message),
  error: (data: LogData, message: string) => write('error', data, message),
  fatal: (data: LogData, message: string) => write('fatal', data, message),
  
  // Convenience method for simple messages
  log: (message: string) => write('info', {}, message),
};

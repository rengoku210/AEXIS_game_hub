/**
 * Production-safe logger that automatically redacts sensitive data
 * and disables verbose logging in production environments.
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const SENSITIVE_KEYS = ['token', 'password', 'secret', 'key', 'card', 'cvv', 'authorization'];

const redactSensitiveData = (data: any): any => {
  if (!data) return data;
  if (typeof data === 'string') {
    // Redact Bearer tokens
    if (data.toLowerCase().startsWith('bearer ')) return 'Bearer [REDACTED]';
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(redactSensitiveData);
  }
  if (typeof data === 'object') {
    const redacted: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_KEYS.some(sk => key.toLowerCase().includes(sk))) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactSensitiveData(value);
      }
    }
    return redacted;
  }
  return data;
};

class Logger {
  private isProduction = import.meta.env.MODE === 'production';

  private log(level: LogLevel, message: string, data?: any) {
    if (this.isProduction && level === 'debug') return;

    const safeData = data ? redactSensitiveData(data) : undefined;
    const timestamp = new Date().toISOString();
    
    // In production, we might send this to a service like Datadog or Sentry.
    // For now, we format it cleanly for standard out.
    const payload = safeData ? `\nData: ${JSON.stringify(safeData, null, 2)}` : '';
    
    switch (level) {
      case 'info':
        console.log(`[${timestamp}] [INFO] ${message}${payload}`);
        break;
      case 'warn':
        console.warn(`[${timestamp}] [WARN] ${message}${payload}`);
        break;
      case 'error':
        console.error(`[${timestamp}] [ERROR] ${message}${payload}`);
        break;
      case 'debug':
        console.debug(`[${timestamp}] [DEBUG] ${message}${payload}`);
        break;
    }
  }

  info(message: string, data?: any) { this.log('info', message, data); }
  warn(message: string, data?: any) { this.log('warn', message, data); }
  error(message: string, data?: any) { this.log('error', message, data); }
  debug(message: string, data?: any) { this.log('debug', message, data); }
}

export const logger = new Logger();

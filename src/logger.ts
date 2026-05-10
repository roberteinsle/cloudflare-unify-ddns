const level = (process.env['LOG_LEVEL'] ?? 'info').toLowerCase();

function timestamp(): string {
  return new Date().toISOString();
}

export const log = {
  info: (...args: unknown[]) => {
    if (level !== 'error') {
      console.log(`[${timestamp()}] [INFO]`, ...args);
    }
  },
  error: (...args: unknown[]) => {
    console.error(`[${timestamp()}] [ERROR]`, ...args);
  },
  debug: (...args: unknown[]) => {
    if (level === 'debug') {
      console.log(`[${timestamp()}] [DEBUG]`, ...args);
    }
  },
};

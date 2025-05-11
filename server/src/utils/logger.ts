/**
 * 简单的日志工具
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private minLevel: LogLevel;

  constructor(minLevel: LogLevel = 'info') {
    this.minLevel = minLevel;
  }

  private shouldLog (level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };

    return levels[level] >= levels[this.minLevel];
  }

  debug (message: string): void {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${message}`);
    }
  }

  info (message: string): void {
    if (this.shouldLog('info')) {
      console.info(`[INFO] ${message}`);
    }
  }

  warn (message: string): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`);
    }
  }

  error (message: string): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`);
    }
  }

  // 根据环境设置日志级别
  setLevelFromEnvironment (env: string | undefined): void {
    if (env === 'development') {
      this.minLevel = 'debug';
    } else {
      this.minLevel = 'info';
    }
  }
}

// 导出单例日志实例
export const logger = new Logger('info');

// 在开发环境中设置为debug级别
// if (typeof self !== 'undefined' && self.ENVIRONMENT === 'development') {
//   logger.setLevelFromEnvironment('development');
// }
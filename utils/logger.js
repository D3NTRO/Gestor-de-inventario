const fs = require('fs');
const path = require('path');
const config = require('../config/app');

class Logger {
  constructor() {
    this.logsDir = path.join(__dirname, '..', 'logs');
    this.ensureLogsDirectory();
    this.logLevel = config.logging.level;
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  ensureLogsDirectory() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta
    };

    return JSON.stringify(logEntry);
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  writeToFile(level, formattedMessage) {
    if (!config.logging.file.enabled) return;

    const filename = path.join(this.logsDir, `${level}.log`);
    const logLine = formattedMessage + '\n';

    try {
      fs.appendFileSync(filename, logLine);
    } catch (error) {
      console.error('Error escribiendo al archivo de log:', error);
    }
  }

  writeToConsole(level, message, meta = {}) {
    if (!config.logging.console.enabled) return;

    const timestamp = new Date().toLocaleString();
    const consoleMessage = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
    
    const consoleMethod = {
      error: console.error,
      warn: console.warn,
      info: console.log,
      debug: console.log
    }[level] || console.log;

    if (Object.keys(meta).length > 0) {
      consoleMethod(consoleMessage, meta);
    } else {
      consoleMethod(consoleMessage);
    }
  }

  log(level, message, meta = {}) {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, meta);
    
    this.writeToConsole(level, message, meta);
    this.writeToFile(level, formattedMessage);
  }

  error(message, meta = {}) {
    this.log('error', message, { ...meta, stack: meta.stack || new Error().stack });
  }

  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  info(message, meta = {}) {
    this.log('info', message, meta);
  }

  debug(message, meta = {}) {
    this.log('debug', message, meta);
  }

  // Método para limpiar logs antiguos
  cleanOldLogs(daysToKeep = 7) {
    try {
      const files = fs.readdirSync(this.logsDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      files.forEach(file => {
        const filePath = path.join(this.logsDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          this.info(`Log antiguo eliminado: ${file}`);
        }
      });
    } catch (error) {
      this.error('Error limpiando logs antiguos:', { error: error.message });
    }
  }

  // Método para obtener logs recientes
  getRecentLogs(level = 'info', lines = 100) {
    try {
      const filename = path.join(this.logsDir, `${level}.log`);
      
      if (!fs.existsSync(filename)) {
        return [];
      }

      const content = fs.readFileSync(filename, 'utf8');
      const logLines = content.trim().split('\n');
      
      return logLines
        .slice(-lines)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return { message: line, timestamp: null };
          }
        })
        .filter(log => log.message);
    } catch (error) {
      this.error('Error leyendo logs:', { error: error.message });
      return [];
    }
  }
}

module.exports = new Logger();
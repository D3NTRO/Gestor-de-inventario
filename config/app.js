require('dotenv').config();

module.exports = {
  // Configuración de la aplicación
  app: {
    name: 'Sistema de Gestión de Inventario',
    version: '1.0.0',
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV || 'development'
  },

  // Configuración de base de datos
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'miapp',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    pool: {
      max: 20,
      min: 2,
      acquire: 30000,
      idle: 10000
    }
  },

  // Configuración de seguridad
security: {
  jwtSecret: process.env.JWT_SECRET || 
    (process.env.NODE_ENV === 'production' 
      ? (() => { throw new Error('JWT_SECRET is required in production') })()
      : crypto.randomBytes(32).toString('hex')),
    sessionSecret: process.env.SESSION_SECRET || 'your-session-secret',
    saltRounds: 10,
    sessionTimeoutHours: parseInt(process.env.SESSION_TIMEOUT_HOURS) || 24
  },

  // Configuración de logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: {
      enabled: true,
      path: './logs',
      maxSize: '10m',
      maxFiles: 5
    },
    console: {
      enabled: process.env.NODE_ENV !== 'production'
    }
  },

  // Configuración de negocio
  business: {
    currency: {
      usdToCupRate: parseFloat(process.env.USD_TO_CUP_RATE) || 395,
      updateInterval: 24 * 60 * 60 * 1000 // 24 horas en milisegundos
    },
    pagination: {
      defaultLimit: 100,
      maxLimit: 1000
    },
    stock: {
      lowStockThreshold: 5,
      mediumStockThreshold: 20
    }
  },

  // Validación de configuración requerida
  validate() {
    const required = ['DB_PASSWORD'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Configuración faltante: ${missing.join(', ')}`);
    }
  }
};
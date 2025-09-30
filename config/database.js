const { Client, Pool } = require('pg');

class DatabaseService {
  constructor() {
    if (!process.env.DB_PASSWORD) {
      throw new Error('DB_PASSWORD environment variable is required');
    }
    
    this.config = {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'miapp',
      password: process.env.DB_PASSWORD,
      port: parseInt(process.env.DB_PORT) || 5432,
      max: 20,                    // máximo conexiones en el pool
      min: 2,                     // mínimo conexiones mantenidas
      idleTimeoutMillis: 30000,   // tiempo antes de cerrar conexión idle
      connectionTimeoutMillis: 5000,  // timeout para obtener conexión
      acquireTimeoutMillis: 60000,    // timeout para adquirir conexión del pool
    };

    this.createPool();
  }

  createPool() {
    if (this.pool) {
      this.pool.end();
    }

    this.pool = new Pool(this.config);

    this.pool.on('error', (err, client) => {
      console.error('Database pool error:', err);
      // Intentar recrear el pool si hay error crítico
      if (err.code === 'ECONNRESET' || err.code === 'ENOTFOUND') {
        console.log('Attempting to recreate database pool...');
        setTimeout(() => this.createPool(), 5000);
      }
    });

    this.pool.on('connect', (client) => {
      console.log('New database client connected');
    });

    this.pool.on('remove', (client) => {
      console.log('Database client removed from pool');
    });
  }

  async query(text, params) {
    const start = Date.now();
    let client;
    
    try {
      client = await this.pool.connect();
      const res = await client.query(text, params);
      const duration = Date.now() - start;
      
      // Log solo queries lentas para evitar spam
      if (duration > 1000) {
        console.log('Slow query detected:', { 
          text: text.substring(0, 100), 
          duration, 
          rows: res.rowCount 
        });
      }
      
      return res;
    } catch (error) {
      console.error('Database query error:', {
        error: error.message,
        code: error.code,
        query: text.substring(0, 100)
      });
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  async getClient() {
    try {
      return await this.pool.connect();
    } catch (error) {
      console.error('Error obtaining database client:', error);
      throw error;
    }
  }

  // Método para transacciones
  async transaction(callback) {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Método para verificar salud de la conexión
  async healthCheck() {
    try {
      const result = await this.query('SELECT 1 as health_check');
      return { healthy: true, timestamp: new Date().toISOString() };
    } catch (error) {
      return { 
        healthy: false, 
        error: error.message, 
        timestamp: new Date().toISOString() 
      };
    }
  }

  // Obtener estadísticas del pool
  getPoolStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log('Database pool closed');
    }
  }
}

module.exports = new DatabaseService();
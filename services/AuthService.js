const crypto = require('crypto');
const db = require('../config/database');

class AuthService {
  constructor() {
    this.sesionesActivas = new Map();
    this.limpiarSesionesExpiradas();
  }

  generarToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  async login(username, password) {
    try {
      const res = await db.query(
        'SELECT id, username, rol FROM usuarios WHERE username = $1 AND password_hash = crypt($2, password_hash)',
        [username, password]
      );
      
      if (res.rows.length === 0) {
        return { success: false, error: 'Credenciales incorrectas' };
      }

      const user = res.rows[0];
      const token = this.generarToken();
      
      // Crear sesión en base de datos
      await db.query(
        'INSERT INTO sesiones (usuario_id, token) VALUES ($1, $2)',
        [user.id, token]
      );
      
      // Guardar sesión en memoria
      this.sesionesActivas.set(token, {
        id: user.id,
        username: user.username,
        rol: user.rol,
        timestamp: Date.now()
      });
      
      return { 
        success: true, 
        user: user, 
        token: token,
        rol: user.rol 
      };
    } catch (error) {
      console.error('Error en login:', error);
      return { success: false, error: 'Error interno del servidor' };
    }
  }

  async logout(token) {
    try {
      await db.query(
        'UPDATE sesiones SET activa = false WHERE token = $1',
        [token]
      );
      
      this.sesionesActivas.delete(token);
      
      return { success: true };
    } catch (error) {
      console.error('Error en logout:', error);
      return { success: false, error: error.message };
    }
  }

  async validarSesion(token) {
    try {
      if (!token || !this.sesionesActivas.has(token)) {
        return { success: false, error: 'Sesión inválida' };
      }
      
      const res = await db.query(
        `SELECT s.*, u.username, u.rol 
         FROM sesiones s 
         JOIN usuarios u ON s.usuario_id = u.id 
         WHERE s.token = $1 AND s.activa = true AND s.fecha_expiracion > NOW()`,
        [token]
      );
      
      if (res.rows.length === 0) {
        this.sesionesActivas.delete(token);
        return { success: false, error: 'Sesión expirada' };
      }
      
      const sesion = res.rows[0];
      return { 
        success: true, 
        user: {
          id: sesion.usuario_id,
          username: sesion.username,
          rol: sesion.rol
        }
      };
    } catch (error) {
      console.error('Error validando sesión:', error);
      return { success: false, error: error.message };
    }
  }

  limpiarSesionesExpiradas() {
    setInterval(async () => {
      try {
        await db.query('DELETE FROM sesiones WHERE fecha_expiracion < NOW()');
        console.log('Sesiones expiradas limpiadas');
      } catch (error) {
        console.error('Error limpiando sesiones:', error);
      }
    }, 60 * 60 * 1000); // Cada hora
  }
}

module.exports = new AuthService();
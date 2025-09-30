const db = require('../config/database');
const logger = require('../utils/logger');
const Validators = require('../utils/validators');
const ErrorHandler = require('../middleware/errorHandler');

class UserService {
  async listarUsuarios() {
    try {
      const res = await db.query('SELECT id, username, rol FROM usuarios ORDER BY username');
      return { success: true, usuarios: res.rows };
    } catch (error) {
      logger.error('Error listando usuarios:', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async agregarUsuario(data) {
    try {
      // Validar datos de entrada
      const validatedData = Validators.validateObject(data, {
        username: [Validators.username],
        password: [Validators.password],
        rol: [Validators.userRole]
      });

      const { username, password, rol } = validatedData;

      // Insertar usuario con contraseña encriptada
      await db.query(
        'INSERT INTO usuarios (username, password_hash, rol) VALUES ($1, crypt($2, gen_salt(\'bf\')), $3)',
        [username, password, rol]
      );

      logger.info('Usuario creado exitosamente', { username, rol });
      return { success: true };
    } catch (error) {
      logger.error('Error agregando usuario:', { error: error.message });
      
      if (error.code === '23505') {
        return { success: false, error: 'El usuario ya existe' };
      }
      
      if (error.validationErrors) {
        return { success: false, error: error.message, validationErrors: error.validationErrors };
      }
      
      return { success: false, error: 'Error interno del servidor' };
    }
  }

  async editarUsuario(data) {
    try {
      // Validar datos básicos
      const { id, username, password, rol } = data;
      
      if (!id) {
        throw ErrorHandler.createValidationError('ID de usuario requerido');
      }

      // Validar campos individuales
      const validatedUsername = Validators.username(username);
      const validatedRol = Validators.userRole(rol);

      // Construir query dependiendo de si se actualiza contraseña
      if (password && password.trim()) {
        const validatedPassword = Validators.password(password);
        await db.query(
          'UPDATE usuarios SET username = $1, password_hash = crypt($2, gen_salt(\'bf\')), rol = $3 WHERE id = $4',
          [validatedUsername, validatedPassword, validatedRol, id]
        );
      } else {
        await db.query(
          'UPDATE usuarios SET username = $1, rol = $2 WHERE id = $3',
          [validatedUsername, validatedRol, id]
        );
      }

      logger.info('Usuario actualizado exitosamente', { id, username: validatedUsername });
      return { success: true };
    } catch (error) {
      logger.error('Error editando usuario:', { error: error.message });
      
      if (error.code === '23505') {
        return { success: false, error: 'Ya existe un usuario con ese nombre' };
      }
      
      if (error.validationErrors) {
        return { success: false, error: error.message, validationErrors: error.validationErrors };
      }
      
      return { success: false, error: error.message };
    }
  }

  async borrarUsuario(username) {
    try {
      if (!username || typeof username !== 'string') {
        throw ErrorHandler.createValidationError('Nombre de usuario requerido');
      }

      const validatedUsername = Validators.username(username);

      const res = await db.query('DELETE FROM usuarios WHERE username = $1', [validatedUsername]);
      
      if (res.rowCount > 0) {
        logger.info('Usuario eliminado exitosamente', { username: validatedUsername });
        return { success: true };
      } else {
        return { success: false, error: 'Usuario no encontrado' };
      }
    } catch (error) {
      logger.error('Error borrando usuario:', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async obtenerUsuarioPorId(id) {
    try {
      const validatedId = Validators.id(id);
      
      const res = await db.query(
        'SELECT id, username, rol FROM usuarios WHERE id = $1',
        [validatedId]
      );

      return res.rows[0] || null;
    } catch (error) {
      logger.error('Error obteniendo usuario por ID:', { error: error.message });
      return null;
    }
  }

  async obtenerUsuarioPorUsername(username) {
    try {
      const validatedUsername = Validators.username(username);
      
      const res = await db.query(
        'SELECT id, username, rol FROM usuarios WHERE username = $1',
        [validatedUsername]
      );

      return res.rows[0] || null;
    } catch (error) {
      logger.error('Error obteniendo usuario por username:', { error: error.message });
      return null;
    }
  }

  async cambiarPassword(userId, oldPassword, newPassword) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      // Validar datos
      const validatedUserId = Validators.id(userId);
      const validatedOldPassword = Validators.password(oldPassword, 'Contraseña actual');
      const validatedNewPassword = Validators.password(newPassword, 'Nueva contraseña');

      // Verificar contraseña actual
      const userRes = await client.query(
        'SELECT id FROM usuarios WHERE id = $1 AND password_hash = crypt($2, password_hash)',
        [validatedUserId, validatedOldPassword]
      );

      if (userRes.rows.length === 0) {
        throw ErrorHandler.createAuthError('Contraseña actual incorrecta');
      }

      // Actualizar contraseña
      await client.query(
        'UPDATE usuarios SET password_hash = crypt($1, gen_salt(\'bf\')) WHERE id = $2',
        [validatedNewPassword, validatedUserId]
      );

      await client.query('COMMIT');
      
      logger.info('Contraseña cambiada exitosamente', { userId: validatedUserId });
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error cambiando contraseña:', { error: error.message });
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  async verificarUsuarioExiste(username) {
    try {
      const validatedUsername = Validators.username(username);
      
      const res = await db.query(
        'SELECT COUNT(*) as count FROM usuarios WHERE username = $1',
        [validatedUsername]
      );

      return parseInt(res.rows[0].count) > 0;
    } catch (error) {
      logger.error('Error verificando existencia de usuario:', { error: error.message });
      return false;
    }
  }

  async obtenerEstadisticasUsuarios() {
    try {
      const res = await db.query(`
        SELECT 
          COUNT(*) as total_usuarios,
          COUNT(*) FILTER (WHERE rol = 'admin') as total_admins,
          COUNT(*) FILTER (WHERE rol = 'usuario') as total_usuarios_regulares
        FROM usuarios
      `);

      return res.rows[0];
    } catch (error) {
      logger.error('Error obteniendo estadísticas de usuarios:', { error: error.message });
      return null;
    }
  }

  async listarUsuariosConActividad(limit = 50) {
    try {
      const validatedLimit = Validators.integer(limit, 'Límite', 1, 1000);

      const res = await db.query(`
        SELECT 
          u.id, u.username, u.rol,
          COUNT(s.id) as sesiones_activas,
          MAX(s.fecha_creacion) as ultima_sesion
        FROM usuarios u
        LEFT JOIN sesiones s ON u.id = s.usuario_id AND s.activa = true
        GROUP BY u.id, u.username, u.rol
        ORDER BY ultima_sesion DESC NULLS LAST
        LIMIT $1
      `, [validatedLimit]);

      return res.rows;
    } catch (error) {
      logger.error('Error listando usuarios con actividad:', { error: error.message });
      return [];
    }
  }
}

module.exports = new UserService();
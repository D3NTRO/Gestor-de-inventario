const logger = require('../utils/logger');
const ErrorHandler = require('./errorHandler');
const { USER_ROLES } = require('../config/constants');

class AuthMiddleware {
  // Verificar si el usuario tiene una sesión válida
  static async requireAuth(sessionValidator) {
    return async (token) => {
      try {
        if (!token) {
          throw ErrorHandler.createAuthError('Token de sesión requerido');
        }

        const sessionResult = await sessionValidator(token);
        
        if (!sessionResult.success) {
          throw ErrorHandler.createAuthError(sessionResult.error || 'Sesión inválida');
        }

        return sessionResult.user;
      } catch (error) {
        logger.warn('Fallo de autenticación:', { token: token?.substring(0, 8) + '...', error: error.message });
        throw error;
      }
    };
  }

  // Verificar si el usuario tiene permisos de administrador
  static requireAdmin(user) {
    if (!user) {
      throw ErrorHandler.createAuthError('Usuario no autenticado');
    }

    if (user.rol !== USER_ROLES.ADMIN) {
      throw ErrorHandler.createAuthorizationError('Se requieren permisos de administrador');
    }

    return true;
  }

  // Verificar si el usuario puede acceder a un recurso específico
  static canAccessResource(user, resourceOwnerId = null, requireAdmin = false) {
    if (!user) {
      throw ErrorHandler.createAuthError('Usuario no autenticado');
    }

    // Los admins pueden acceder a todo
    if (user.rol === USER_ROLES.ADMIN) {
      return true;
    }

    // Si se requiere admin específicamente y el usuario no es admin
    if (requireAdmin) {
      throw ErrorHandler.createAuthorizationError('Se requieren permisos de administrador');
    }

    // Si hay un owner específico y el usuario no es el owner ni admin
    if (resourceOwnerId && user.id !== resourceOwnerId) {
      throw ErrorHandler.createAuthorizationError('No tiene permisos para acceder a este recurso');
    }

    return true;
  }

  // Crear wrapper para funciones que requieren autenticación
  static withAuth(sessionValidator, operation) {
    return async (event, data) => {
      try {
        // Extraer token del data o event
        const token = data?.token || data?.sessionToken;
        
        // Validar sesión
        const user = await this.requireAuth(sessionValidator)(token);
        
        // Ejecutar operación con usuario autenticado
        return await operation(event, { ...data, user });
      } catch (error) {
        return ErrorHandler.handle(error);
      }
    };
  }

  // Crear wrapper para funciones que requieren admin
  static withAdminAuth(sessionValidator, operation) {
    return async (event, data) => {
      try {
        const token = data?.token || data?.sessionToken;
        const user = await this.requireAuth(sessionValidator)(token);
        
        // Verificar permisos de admin
        this.requireAdmin(user);
        
        return await operation(event, { ...data, user });
      } catch (error) {
        return ErrorHandler.handle(error);
      }
    };
  }

  // Crear wrapper para operaciones de recursos con ownership
  static withResourceAuth(sessionValidator, getResourceOwner, operation) {
    return async (event, data) => {
      try {
        const token = data?.token || data?.sessionToken;
        const user = await this.requireAuth(sessionValidator)(token);
        
        // Obtener el owner del recurso si es necesario
        let resourceOwnerId = null;
        if (typeof getResourceOwner === 'function') {
          resourceOwnerId = await getResourceOwner(data);
        } else if (typeof getResourceOwner === 'string') {
          resourceOwnerId = data[getResourceOwner];
        }
        
        // Verificar acceso al recurso
        this.canAccessResource(user, resourceOwnerId);
        
        return await operation(event, { ...data, user });
      } catch (error) {
        return ErrorHandler.handle(error);
      }
    };
  }

  // Logging de actividades de usuario
  static logUserActivity(user, action, details = {}) {
    logger.info('Actividad de usuario:', {
      userId: user.id,
      username: user.username,
      rol: user.rol,
      action,
      details,
      timestamp: new Date().toISOString()
    });
  }

  // Validar permisos para operaciones específicas
  static validatePermissions(user, requiredPermissions = []) {
    if (!user) {
      throw ErrorHandler.createAuthError('Usuario no autenticado');
    }

    // Los admins tienen todos los permisos
    if (user.rol === USER_ROLES.ADMIN) {
      return true;
    }

    // Aquí se pueden implementar permisos más granulares en el futuro
    // Por ahora, usuarios regulares tienen permisos básicos
    const userPermissions = [
      'read_products',
      'read_categories',
      'read_own_profile'
    ];

    const hasPermissions = requiredPermissions.every(permission => 
      userPermissions.includes(permission)
    );

    if (!hasPermissions) {
      throw ErrorHandler.createAuthorizationError('Permisos insuficientes para esta operación');
    }

    return true;
  }

  // Crear contexto de usuario para operaciones
  static createUserContext(user) {
    return {
      id: user.id,
      username: user.username,
      rol: user.rol,
      isAdmin: user.rol === USER_ROLES.ADMIN,
      permissions: user.rol === USER_ROLES.ADMIN ? ['*'] : ['read_products', 'read_categories']
    };
  }

  // Rate limiting básico por usuario
  static createRateLimit(maxRequests = 100, windowMs = 60000) {
    const requests = new Map();

    return (user) => {
      const now = Date.now();
      const userId = user.id;
      
      if (!requests.has(userId)) {
        requests.set(userId, { count: 1, resetTime: now + windowMs });
        return true;
      }

      const userRequests = requests.get(userId);
      
      if (now > userRequests.resetTime) {
        // Reset ventana
        requests.set(userId, { count: 1, resetTime: now + windowMs });
        return true;
      }

      if (userRequests.count >= maxRequests) {
        throw ErrorHandler.createAuthorizationError('Límite de peticiones excedido');
      }

      userRequests.count++;
      return true;
    };
  }

  // Validar sesión con información extendida
  static async validateSessionExtended(sessionValidator, token) {
    try {
      const result = await sessionValidator(token);
      
      if (result.success && result.user) {
        return {
          success: true,
          user: this.createUserContext(result.user)
        };
      }
      
      return result;
    } catch (error) {
      logger.error('Error validando sesión extendida:', { error: error.message });
      return { success: false, error: 'Error interno de validación' };
    }
  }
}

module.exports = AuthMiddleware;
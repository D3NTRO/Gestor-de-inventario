const logger = require('../utils/logger');
const Helpers = require('../utils/helpers');
const { ERROR_MESSAGES, HTTP_STATUS } = require('../config/constants');

class ErrorHandler {
  // Manejar errores de validación
  static handleValidationError(error) {
    logger.warn('Error de validación:', { 
      message: error.message, 
      validationErrors: error.validationErrors 
    });

    return Helpers.errorResponse(
      error.message,
      error.validationErrors || null
    );
  }

  // Manejar errores de base de datos
  static handleDatabaseError(error) {
    logger.error('Error de base de datos:', { 
      code: error.code, 
      message: error.message,
      stack: error.stack 
    });

    // Errores comunes de PostgreSQL
    switch (error.code) {
      case '23505': // Violación de constraint único
        return Helpers.errorResponse(ERROR_MESSAGES.DUPLICATE_ENTRY);
      
      case '23503': // Violación de foreign key
        return Helpers.errorResponse(ERROR_MESSAGES.FK_CONSTRAINT);
      
      case '23502': // Violación de NOT NULL
        return Helpers.errorResponse('Campo requerido faltante');
      
      case '42P01': // Tabla no existe
        return Helpers.errorResponse('Recurso no encontrado');
      
      case 'ECONNREFUSED':
      case '08006': // Connection failure
        return Helpers.errorResponse(ERROR_MESSAGES.DATABASE_CONNECTION_ERROR);
      
      default:
        return Helpers.errorResponse(ERROR_MESSAGES.INTERNAL_ERROR);
    }
  }

  // Manejar errores de autenticación
  static handleAuthError(error) {
    logger.warn('Error de autenticación:', { message: error.message });
    
    return Helpers.errorResponse(
      error.message || ERROR_MESSAGES.UNAUTHORIZED
    );
  }

  // Manejar errores de autorización
  static handleAuthorizationError(error) {
    logger.warn('Error de autorización:', { message: error.message });
    
    return Helpers.errorResponse(
      error.message || ERROR_MESSAGES.FORBIDDEN
    );
  }

  // Manejar errores de negocio
  static handleBusinessError(error) {
    logger.warn('Error de lógica de negocio:', { message: error.message });
    
    return Helpers.errorResponse(error.message);
  }

  // Manejar errores no categorizados
  static handleGenericError(error) {
    logger.error('Error genérico:', { 
      message: error.message, 
      stack: error.stack 
    });

    // No exponer detalles internos en producción
    const isProduction = process.env.NODE_ENV === 'production';
    
    return Helpers.errorResponse(
      isProduction ? ERROR_MESSAGES.INTERNAL_ERROR : error.message
    );
  }

  // Método principal para manejar cualquier error
  static handle(error) {
    // Determinar el tipo de error y delegar al manejador apropiado
    if (error.name === 'ValidationError' || error.validationErrors) {
      return this.handleValidationError(error);
    }

    if (error.code && (error.code.startsWith('23') || error.code === 'ECONNREFUSED' || error.code.startsWith('08'))) {
      return this.handleDatabaseError(error);
    }

    if (error.name === 'AuthenticationError' || error.message?.includes('credenciales') || error.message?.includes('sesión')) {
      return this.handleAuthError(error);
    }

    if (error.name === 'AuthorizationError' || error.message?.includes('autorizado') || error.message?.includes('permisos')) {
      return this.handleAuthorizationError(error);
    }

    if (error.name === 'BusinessError') {
      return this.handleBusinessError(error);
    }

    // Error genérico
    return this.handleGenericError(error);
  }

  // Wrapper para operaciones asíncronas
  static async handleAsync(operation) {
    try {
      return await operation();
    } catch (error) {
      return this.handle(error);
    }
  }

  // Crear errores personalizados
  static createError(type, message) {
    const error = new Error(message);
    error.name = type;
    return error;
  }

  static createValidationError(message, validationErrors = null) {
    const error = this.createError('ValidationError', message);
    if (validationErrors) {
      error.validationErrors = validationErrors;
    }
    return error;
  }

  static createAuthError(message = ERROR_MESSAGES.INVALID_CREDENTIALS) {
    return this.createError('AuthenticationError', message);
  }

  static createAuthorizationError(message = ERROR_MESSAGES.FORBIDDEN) {
    return this.createError('AuthorizationError', message);
  }

  static createBusinessError(message) {
    return this.createError('BusinessError', message);
  }

  static createNotFoundError(resource = 'Registro') {
    return this.createError('BusinessError', `${resource} ${ERROR_MESSAGES.RECORD_NOT_FOUND}`);
  }
}

module.exports = ErrorHandler;
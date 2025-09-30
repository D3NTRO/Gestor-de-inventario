const { VALIDATION, ERROR_MESSAGES } = require('../config/constants');

class Validators {
  // Validador genérico de campos requeridos
  static required(value, fieldName) {
    if (value === null || value === undefined || 
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0)) {
      throw new Error(`${fieldName} ${ERROR_MESSAGES.REQUIRED_FIELD}`);
    }
    return true;
  }

  // Validador de longitud de string
  static stringLength(value, fieldName, minLength = 0, maxLength = Infinity) {
    if (typeof value !== 'string') {
      throw new Error(`${fieldName} debe ser texto`);
    }
    
    const length = value.trim().length;
    
    if (length < minLength) {
      throw new Error(`${fieldName} debe tener al menos ${minLength} caracteres`);
    }
    
    if (length > maxLength) {
      throw new Error(`${fieldName} no puede tener más de ${maxLength} caracteres`);
    }
    
    return true;
  }

  // Validador de números
  static number(value, fieldName, min = -Infinity, max = Infinity) {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(numValue) || !isFinite(numValue)) {
      throw new Error(`${fieldName} ${ERROR_MESSAGES.INVALID_NUMBER}`);
    }
    
    if (numValue < min) {
      throw new Error(`${fieldName} debe ser mayor o igual a ${min}`);
    }
    
    if (numValue > max) {
      throw new Error(`${fieldName} debe ser menor o igual a ${max}`);
    }
    
    return numValue;
  }

  // Validador de números enteros
  static integer(value, fieldName, min = -Infinity, max = Infinity) {
    const numValue = this.number(value, fieldName, min, max);
    
    if (!Number.isInteger(numValue)) {
      throw new Error(`${fieldName} debe ser un número entero`);
    }
    
    return numValue;
  }

  // Validador de números positivos
  static positiveNumber(value, fieldName, allowZero = true) {
    const numValue = this.number(value, fieldName);
    const minValue = allowZero ? 0 : 0.01;
    
    if (numValue < minValue) {
      throw new Error(`${fieldName} ${ERROR_MESSAGES.NEGATIVE_NUMBER}`);
    }
    
    return numValue;
  }

  // Validador de email
  static email(value, fieldName) {
    if (!value || typeof value !== 'string') {
      throw new Error(`${fieldName} es requerido`);
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw new Error(`${fieldName} no tiene un formato válido`);
    }
    
    return value.toLowerCase().trim();
  }

  // Validador de username
  static username(value, fieldName = 'Usuario') {
    this.required(value, fieldName);
    this.stringLength(
      value, 
      fieldName, 
      VALIDATION.USERNAME_MIN_LENGTH, 
      VALIDATION.USERNAME_MAX_LENGTH
    );
    
    // Solo letras, números y guiones bajos
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(value)) {
      throw new Error(`${fieldName} solo puede contener letras, números y guiones bajos`);
    }
    
    return value.trim();
  }

  // Validador de contraseña
  static password(value, fieldName = 'Contraseña') {
    this.required(value, fieldName);
    this.stringLength(
      value, 
      fieldName, 
      VALIDATION.PASSWORD_MIN_LENGTH
    );
    
    return value;
  }

  // Validadores específicos del dominio
  static productName(value) {
    this.required(value, 'Nombre del producto');
    this.stringLength(value, 'Nombre del producto', 1, VALIDATION.PRODUCT_NAME_MAX_LENGTH);
    return value.trim();
  }

  static productDescription(value) {
    if (value && typeof value === 'string') {
      this.stringLength(value, 'Descripción', 0, VALIDATION.DESCRIPTION_MAX_LENGTH);
      return value.trim();
    }
    return null;
  }

  static productStock(value) {
    return this.integer(value, 'Stock', VALIDATION.MIN_STOCK, VALIDATION.MAX_STOCK);
  }

  static productPrice(value, fieldName = 'Precio') {
    return this.positiveNumber(value, fieldName, true);
  }

  static categoryName(value) {
    this.required(value, 'Nombre de categoría');
    this.stringLength(value, 'Nombre de categoría', 1, VALIDATION.CATEGORY_NAME_MAX_LENGTH);
    return value.trim();
  }

  static subcategoryName(value) {
    this.required(value, 'Nombre de subcategoría');
    this.stringLength(value, 'Nombre de subcategoría', 1, VALIDATION.SUBCATEGORY_NAME_MAX_LENGTH);
    return value.trim();
  }

  // Validador de ID
  static id(value, fieldName = 'ID') {
    const numValue = this.integer(value, fieldName, 1);
    return numValue;
  }

  // Validador de rol de usuario
  static userRole(value) {
    this.required(value, 'Rol de usuario');
    const validRoles = ['admin', 'usuario'];
    
    if (!validRoles.includes(value)) {
      throw new Error(`Rol de usuario debe ser uno de: ${validRoles.join(', ')}`);
    }
    
    return value;
  }

  // Validador de paginación
  static paginationParams(page, limit) {
    const validPage = this.integer(page || 1, 'Página', 1);
    const validLimit = this.integer(
      limit || VALIDATION.DEFAULT_PAGE_SIZE, 
      'Límite', 
      VALIDATION.MIN_PAGE_SIZE, 
      VALIDATION.MAX_PAGE_SIZE
    );
    
    return { page: validPage, limit: validLimit };
  }

  // Validador de fechas
  static date(value, fieldName = 'Fecha') {
    if (!value) return null;
    
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new Error(`${fieldName} no es una fecha válida`);
    }
    
    return date;
  }

  // Validador de rango de fechas
  static dateRange(startDate, endDate) {
    const start = this.date(startDate, 'Fecha de inicio');
    const end = this.date(endDate, 'Fecha de fin');
    
    if (start && end && start > end) {
      throw new Error('La fecha de inicio no puede ser posterior a la fecha de fin');
    }
    
    return { start, end };
  }

  // Método para validar un objeto completo
  static validateObject(obj, validationRules) {
    const validated = {};
    const errors = [];
    
    for (const [field, rules] of Object.entries(validationRules)) {
      try {
        let value = obj[field];
        
        // Aplicar cada regla de validación
        for (const rule of rules) {
          if (typeof rule === 'function') {
            value = rule(value);
          } else if (typeof rule === 'object' && rule.validator) {
            value = rule.validator(value, ...(rule.params || []));
          }
        }
        
        validated[field] = value;
      } catch (error) {
        errors.push({
          field,
          message: error.message
        });
      }
    }
    
    if (errors.length > 0) {
      const errorMessage = errors.map(e => `${e.field}: ${e.message}`).join('; ');
      const validationError = new Error(`Errores de validación: ${errorMessage}`);
      validationError.validationErrors = errors;
      throw validationError;
    }
    
    return validated;
  }

  // Sanitizar strings para evitar problemas de seguridad
  static sanitizeString(value) {
    if (typeof value !== 'string') return value;
    
    return value
      .trim()
      .replace(/[<>]/g, '') // Remover caracteres peligrosos básicos
      .substring(0, 1000); // Limitar longitud máxima
  }

  // Validador de filtros para búsquedas
  static searchFilters(filters = {}) {
    const validated = {};
    
    if (filters.busqueda) {
      validated.busqueda = this.sanitizeString(filters.busqueda);
    }
    
    if (filters.categoria) {
      validated.categoria = this.id(filters.categoria, 'Categoría');
    }
    
    if (filters.subcategoria) {
      validated.subcategoria = this.id(filters.subcategoria, 'Subcategoría');
    }
    
    if (filters.mostrarSinStock !== undefined) {
      validated.mostrarSinStock = Boolean(filters.mostrarSinStock);
    }
    
    return validated;
  }
}

module.exports = Validators;
const crypto = require('crypto');
const config = require('../config/app');
const { STOCK_STATUS } = require('../config/constants');

class Helpers {
  // Generador de tokens seguros
  static generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // Hash de contraseñas
  static async hashPassword(password) {
    const saltRounds = config.security.saltRounds || 10;
    const bcrypt = require('bcrypt');
    return await bcrypt.hash(password, saltRounds);
  }

  // Verificación de contraseñas
  static async verifyPassword(password, hash) {
    const bcrypt = require('bcrypt');
    return await bcrypt.compare(password, hash);
  }

  // Conversión de moneda USD a CUP
  static convertUsdToCup(usdAmount, rate = null) {
    const exchangeRate = rate || config.business.currency.usdToCupRate;
    return parseFloat((usdAmount * exchangeRate).toFixed(2));
  }

  // Conversión de moneda CUP a USD
  static convertCupToUsd(cupAmount, rate = null) {
    const exchangeRate = rate || config.business.currency.usdToCupRate;
    return parseFloat((cupAmount / exchangeRate).toFixed(2));
  }

  // Determinar estado del stock
  static getStockStatus(stock) {
    if (stock === 0) return STOCK_STATUS.EMPTY;
    if (stock <= config.business.stock.lowStockThreshold) return STOCK_STATUS.LOW;
    if (stock <= config.business.stock.mediumStockThreshold) return STOCK_STATUS.MEDIUM;
    return STOCK_STATUS.HIGH;
  }

  // Formatear números para mostrar
  static formatNumber(number, decimals = 2) {
    if (number === null || number === undefined || isNaN(number)) {
      return '0.00';
    }
    return parseFloat(number).toFixed(decimals);
  }

  // Formatear precios
  static formatPrice(price, currency = 'CUP') {
    const formattedPrice = this.formatNumber(price, 2);
    return `${formattedPrice} ${currency}`;
  }

  // Sanitizar datos de entrada
  static sanitizeInput(obj) {
    if (obj === null || obj === undefined) return obj;
    
    if (typeof obj === 'string') {
      return obj.trim().replace(/[<>]/g, '');
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeInput(item));
    }
    
    if (typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }
    
    return obj;
  }

  // Calcular offset para paginación
  static calculateOffset(page, limit) {
    return (page - 1) * limit;
  }

  // Calcular información de paginación
  static calculatePagination(page, limit, totalRecords) {
    const totalPages = Math.ceil(totalRecords / limit);
    const offset = this.calculateOffset(page, limit);
    
    return {
      page,
      limit,
      totalRecords,
      totalPages,
      offset,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    };
  }

  // Generar respuesta estándar de API
  static createApiResponse(success, data = null, message = null, errors = null, pagination = null) {
    const response = {
      success,
      timestamp: new Date().toISOString()
    };

    if (data !== null) response.data = data;
    if (message !== null) response.message = message;
    if (errors !== null) response.errors = errors;
    if (pagination !== null) response.pagination = pagination;

    return response;
  }

  // Generar respuesta de éxito
  static successResponse(data = null, message = null, pagination = null) {
    return this.createApiResponse(true, data, message, null, pagination);
  }

  // Generar respuesta de error
  static errorResponse(message, errors = null, data = null) {
    return this.createApiResponse(false, data, message, errors);
  }

  // Formatear fechas
  static formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
    if (!date) return null;
    
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return format
      .replace('YYYY', year)
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  }

  // Generar nombre de archivo para exportaciones
  static generateExportFilename(prefix, extension = 'csv') {
    const timestamp = this.formatDate(new Date(), 'YYYY-MM-DD_HH-mm-ss');
    return `${prefix}_${timestamp}.${extension}`;
  }

  // Validar estructura de objeto
  static validateObjectStructure(obj, requiredFields) {
    const missing = requiredFields.filter(field => !(field in obj));
    if (missing.length > 0) {
      throw new Error(`Campos requeridos faltantes: ${missing.join(', ')}`);
    }
    return true;
  }

  // Crear filtros SQL dinámicos
  static buildWhereClause(filters, allowedFields) {
    const conditions = [];
    const params = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(filters)) {
      if (!allowedFields.includes(key) || value === null || value === undefined) {
        continue;
      }

      if (typeof value === 'string' && value.trim() === '') {
        continue;
      }

      const field = allowedFields.find(f => f === key || f.field === key);
      const fieldName = typeof field === 'string' ? field : field.field;
      const operator = typeof field === 'object' ? field.operator || '=' : '=';

      if (operator === 'ILIKE') {
        conditions.push(`${fieldName} ILIKE $${paramCount}`);
        params.push(`%${value}%`);
      } else if (operator === 'IN' && Array.isArray(value)) {
        const placeholders = value.map(() => `$${paramCount++}`).join(', ');
        conditions.push(`${fieldName} IN (${placeholders})`);
        params.push(...value);
        paramCount--; // Ajustar porque se incrementó en el map
      } else {
        conditions.push(`${fieldName} ${operator} $${paramCount}`);
        params.push(value);
      }
      
      paramCount++;
    }

    return {
      whereClause: conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '',
      params
    };
  }

  // Debounce para operaciones frecuentes
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Throttle para limitar frecuencia de ejecución
  static throttle(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  // Generar CSV desde array de objetos
  static arrayToCSV(data, headers = null) {
    if (!data || data.length === 0) {
      return '';
    }

    const csvHeaders = headers || Object.keys(data[0]);
    const csvRows = data.map(row => 
      csvHeaders.map(header => {
        let value = row[header];
        if (value === null || value === undefined) {
          value = '';
        }
        // Escapar comillas y envolver en comillas si es necesario
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          value = '"' + value.replace(/"/g, '""') + '"';
        }
        return value;
      }).join(',')
    );

    return [csvHeaders.join(','), ...csvRows].join('\n');
  }

  // Obtener resumen de stock
  static getStockSummary(products) {
    const summary = {
      total: products.length,
      sinStock: 0,
      stockBajo: 0,
      stockMedio: 0,
      stockAlto: 0,
      valorTotalUSD: 0,
      valorTotalCUP: 0
    };

    products.forEach(product => {
      const status = this.getStockStatus(product.stock);
      
      switch (status) {
        case STOCK_STATUS.EMPTY:
          summary.sinStock++;
          break;
        case STOCK_STATUS.LOW:
          summary.stockBajo++;
          break;
        case STOCK_STATUS.MEDIUM:
          summary.stockMedio++;
          break;
        case STOCK_STATUS.HIGH:
          summary.stockAlto++;
          break;
      }

      if (product.precio_usd) {
        summary.valorTotalUSD += parseFloat(product.precio_usd) * product.stock;
      }
      
      if (product.precio_cup) {
        summary.valorTotalCUP += parseFloat(product.precio_cup) * product.stock;
      }
    });

    return summary;
  }

  // Validar formato de email
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Generar código de barras simple
  static generateBarcode() {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return timestamp + random;
  }

  // Calcular margen de ganancia
  static calculateProfitMargin(salePrice, costPrice) {
    if (!costPrice || costPrice <= 0) return 0;
    return ((salePrice - costPrice) / costPrice * 100).toFixed(2);
  }

  // Parsear parámetros de query string
  static parseQueryParams(queryString) {
    const params = {};
    if (!queryString) return params;
    
    const urlParams = new URLSearchParams(queryString);
    for (const [key, value] of urlParams) {
      params[key] = value;
    }
    
    return params;
  }

  // Tiempo transcurrido desde una fecha
  static timeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - new Date(date)) / 1000);
    
    if (diffInSeconds < 60) return 'hace menos de un minuto';
    if (diffInSeconds < 3600) return `hace ${Math.floor(diffInSeconds / 60)} minutos`;
    if (diffInSeconds < 86400) return `hace ${Math.floor(diffInSeconds / 3600)} horas`;
    return `hace ${Math.floor(diffInSeconds / 86400)} días`;
  }
}

module.exports = Helpers;
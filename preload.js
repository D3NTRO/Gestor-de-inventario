const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // =============================================
  // AUTENTICACIÓN Y SESIONES
  // =============================================
  login: (data) => ipcRenderer.invoke('login', data),
  logout: (token) => ipcRenderer.invoke('logout', { token }),
  validarSesion: (token) => ipcRenderer.invoke('validar-sesion', { token }),

  // =============================================
  // GESTIÓN DE USUARIOS
  // =============================================
  agregarUsuario: (data) => ipcRenderer.invoke('agregar-usuario', data),
  editarUsuario: (data) => ipcRenderer.invoke('editar-usuario', data),
  borrarUsuario: (data) => ipcRenderer.invoke('borrar-usuario', data),
  listarUsuarios: () => ipcRenderer.invoke('listar-usuarios'),

  // =============================================
  // GESTIÓN DE CATEGORÍAS
  // =============================================
  listarCategorias: () => ipcRenderer.invoke('listar-categorias'),
  listarCategoriasCompletas: () => ipcRenderer.invoke('listar-categorias-completas'),
  agregarCategoria: (nombre) => ipcRenderer.invoke('agregar-categoria', { nombre }),
  actualizarCategoria: (data) => ipcRenderer.invoke('actualizar-categoria', data),
  eliminarCategoria: (id) => ipcRenderer.invoke('eliminar-categoria', { id }),

  // =============================================
  // GESTIÓN DE SUBCATEGORÍAS
  // =============================================
  listarSubcategorias: (categoriaId) => ipcRenderer.invoke('listar-subcategorias', categoriaId),
  agregarSubcategoria: (data) => ipcRenderer.invoke('agregar-subcategoria', data),
  actualizarSubcategoria: (data) => ipcRenderer.invoke('actualizar-subcategoria', data),
  eliminarSubcategoria: (id) => ipcRenderer.invoke('eliminar-subcategoria', { id }),

  // =============================================
  // GESTIÓN DE PRODUCTOS
  // =============================================
  listarProductos: (filtros = {}) => ipcRenderer.invoke('listar-productos', filtros),
  obtenerProducto: (id) => ipcRenderer.invoke('obtener-producto', id),
  agregarProducto: (data) => ipcRenderer.invoke('agregar-producto', data),
  editarProducto: (data) => ipcRenderer.invoke('editar-producto', data),
  actualizarProducto: (data) => ipcRenderer.invoke('actualizar-producto', data),
  eliminarProducto: (id) => ipcRenderer.invoke('eliminar-producto', { id }),
  
  // Compatibilidad con frontend existente
  listarProductosPorCategoria: (categoriaId) => ipcRenderer.invoke('listar-productos-categoria', categoriaId),
  actualizarCampoProducto: (data) => ipcRenderer.invoke('actualizar-campo-producto', data),
  filtrarProductosExcel: (filtros) => ipcRenderer.invoke('filtrar-productos-excel', filtros),

  // =============================================
  // GESTIÓN DE VENTAS
  // =============================================
  registrarVenta: (data) => ipcRenderer.invoke('registrar-venta', data),
  listarVentas: (filtros) => ipcRenderer.invoke('listar-ventas', { filtros }),

  // =============================================
  // GESTIÓN DE SERVICIOS
  // =============================================
  listarServicios: () => ipcRenderer.invoke('listar-servicios'),
  agregarServicio: (data) => ipcRenderer.invoke('agregar-servicio', data),
  editarServicio: (data) => ipcRenderer.invoke('editar-servicio', data),
  eliminarServicio: (id) => ipcRenderer.invoke('eliminar-servicio', { id }),

  // =============================================
  // REPORTES Y ESTADÍSTICAS
  // =============================================
  reporteInventario: () => ipcRenderer.invoke('reporte-inventario'),
  reporteVentas: (filtros) => ipcRenderer.invoke('reporte-ventas', { filtros }),

  // =============================================
  // SISTEMA DE SESIÓN MEJORADO (Compatible con frontend)
  // =============================================
  setSesionData: (key, value) => {
    if (!window.sessionData) window.sessionData = {};
    window.sessionData[key] = value;
    
    // Guardar también en localStorage si está disponible
    try {
      localStorage.setItem(`app_${key}`, JSON.stringify(value));
    } catch (e) {
      // Fallback a sessionStorage
      try {
        sessionStorage.setItem(`app_${key}`, JSON.stringify(value));
      } catch (e2) {
        console.warn('Storage no disponible:', e2);
      }
    }
  },
  
  getSesionData: (key) => {
    // Intentar obtener de memoria primero
    if (window.sessionData && window.sessionData[key]) {
      return window.sessionData[key];
    }
    
    // Intentar desde localStorage
    try {
      const stored = localStorage.getItem(`app_${key}`);
      if (stored) {
        const value = JSON.parse(stored);
        if (!window.sessionData) window.sessionData = {};
        window.sessionData[key] = value;
        return value;
      }
    } catch (e) {
      // Fallback a sessionStorage
      try {
        const stored = sessionStorage.getItem(`app_${key}`);
        if (stored) {
          const value = JSON.parse(stored);
          if (!window.sessionData) window.sessionData = {};
          window.sessionData[key] = value;
          return value;
        }
      } catch (e2) {
        console.warn('Error leyendo storage:', e2);
      }
    }
    
    return null;
  },
  
  clearSesionData: () => {
    window.sessionData = {};
    
    // Limpiar localStorage
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('app_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn('Error limpiando localStorage:', e);
    }
    
    // Limpiar sessionStorage
    try {
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith('app_')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (e) {
      console.warn('Error limpiando sessionStorage:', e);
    }
  },

  // =============================================
  // UTILIDADES DEL SISTEMA
  // =============================================
  testConnection: () => ipcRenderer.invoke('test-connection'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),

  // =============================================
  // FUNCIONES AUXILIARES PARA EL FRONTEND
  // =============================================
  
  // Helper para manejar tokens automáticamente
  withToken: (apiCall) => {
    return async (...args) => {
      const token = window.sessionManager?.getSessionToken?.() || 
                    (window.sessionData && window.sessionData.sessionToken);
      
      if (!token) {
        return { success: false, error: 'No hay sesión activa' };
      }

      // Si es una función que acepta un objeto como parámetro
      if (args.length === 1 && typeof args[0] === 'object') {
        return await apiCall({ ...args[0], token });
      }
      
      // Si acepta múltiples parámetros, agregamos token al final
      return await apiCall(...args, token);
    };
  },

  // Helper para logging del frontend
  logError: (message, details = {}) => {
    console.error(`[Frontend Error] ${message}`, details);
    // Aquí se podría enviar al backend para logging centralizado
  },

  logInfo: (message, details = {}) => {
    console.info(`[Frontend Info] ${message}`, details);
  },

  // Helper para formatear fechas
  formatDate: (date, format = 'DD/MM/YYYY') => {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    return format
      .replace('DD', day)
      .replace('MM', month)
      .replace('YYYY', year);
  },

  // Helper para formatear precios
  formatPrice: (price, currency = 'CUP') => {
    if (price === null || price === undefined || isNaN(price)) {
      return `0.00 ${currency}`;
    }
    return `${parseFloat(price).toFixed(2)} ${currency}`;
  },

  // Helper para validaciones del frontend
  validate: {
    required: (value, fieldName) => {
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        throw new Error(`${fieldName} es requerido`);
      }
      return true;
    },
    
    number: (value, fieldName, min = null, max = null) => {
      const num = parseFloat(value);
      if (isNaN(num)) {
        throw new Error(`${fieldName} debe ser un número válido`);
      }
      if (min !== null && num < min) {
        throw new Error(`${fieldName} debe ser mayor o igual a ${min}`);
      }
      if (max !== null && num > max) {
        throw new Error(`${fieldName} debe ser menor o igual a ${max}`);
      }
      return num;
    },
    
    email: (value, fieldName = 'Email') => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        throw new Error(`${fieldName} no tiene un formato válido`);
      }
      return value;
    }
  },

  // =============================================
  // FUNCIONES DE COMPATIBILIDAD CON CÓDIGO EXISTENTE
  // =============================================
  
  // Estas funciones mantienen compatibilidad con el frontend existente
  // pero internamente usan los nuevos servicios con tokens
  
  // Wrappers que inyectan automáticamente el token
  listarProductosAuth: function() {
    return this.withToken(this.listarProductos)();
  },
  
  agregarProductoAuth: function(data) {
    return this.withToken(this.agregarProducto)(data);
  },
  
  editarProductoAuth: function(data) {
    return this.withToken(this.editarProducto)(data);
  },
  
  eliminarProductoAuth: function(id) {
    return this.withToken(this.eliminarProducto)(id);
  },

  // Similar para categorías
  agregarCategoriaAuth: function(nombre) {
    return this.withToken(this.agregarCategoria)(nombre);
  },
  
  eliminarCategoriaAuth: function(id) {
    return this.withToken(this.eliminarCategoria)(id);
  },

  // Helper para mostrar notificaciones
  showNotification: (message, type = 'info') => {
    if (window.showToast) {
      window.showToast(message, type);
    } else {
      // Fallback a console
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }
});
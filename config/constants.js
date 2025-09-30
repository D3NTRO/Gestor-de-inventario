module.exports = {
  // Roles de usuario
  USER_ROLES: {
    ADMIN: 'admin',
    USER: 'usuario'
  },

  // Estados de stock
  STOCK_STATUS: {
    HIGH: 'stock_alto',
    MEDIUM: 'stock_medio', 
    LOW: 'stock_bajo',
    EMPTY: 'sin_stock'
  },

  // Tipos de movimiento de stock
  MOVEMENT_TYPES: {
    ENTRY: 'entrada',
    EXIT: 'salida',
    ADJUSTMENT: 'ajuste'
  },

  // Métodos de pago
  PAYMENT_METHODS: {
    CASH: 'efectivo',
    CARD: 'tarjeta',
    TRANSFER: 'transferencia',
    MIXED: 'mixto'
  },

  // Estados de servicio
  SERVICE_STATUS: {
    PENDING: 'pendiente',
    IN_PROGRESS: 'en_proceso',
    COMPLETED: 'completado',
    CANCELLED: 'cancelado'
  },

  // Configuración de validación
  VALIDATION: {
    // Productos
    PRODUCT_NAME_MAX_LENGTH: 150,
    DESCRIPTION_MAX_LENGTH: 500,
    MIN_STOCK: 0,
    MAX_STOCK: 999999,
    MIN_PRICE: 0,
    MAX_PRICE: 999999.99,
    
    // Usuarios
    USERNAME_MIN_LENGTH: 3,
    USERNAME_MAX_LENGTH: 50,
    PASSWORD_MIN_LENGTH: 4,
    
    // Categorías
    CATEGORY_NAME_MAX_LENGTH: 100,
    SUBCATEGORY_NAME_MAX_LENGTH: 100,
    
    // Paginación
    MIN_PAGE_SIZE: 10,
    MAX_PAGE_SIZE: 1000,
    DEFAULT_PAGE_SIZE: 100
  },

  // Mensajes de error comunes
  ERROR_MESSAGES: {
    // Autenticación
    INVALID_CREDENTIALS: 'Credenciales incorrectas',
    SESSION_EXPIRED: 'Sesión expirada',
    UNAUTHORIZED: 'No autorizado',
    FORBIDDEN: 'Acceso denegado',
    
    // Validación
    REQUIRED_FIELD: 'Este campo es requerido',
    INVALID_FORMAT: 'Formato inválido',
    VALUE_TOO_LONG: 'Valor demasiado largo',
    VALUE_TOO_SHORT: 'Valor demasiado corto',
    INVALID_NUMBER: 'Debe ser un número válido',
    NEGATIVE_NUMBER: 'No puede ser un número negativo',
    
    // Base de datos
    RECORD_NOT_FOUND: 'Registro no encontrado',
    DUPLICATE_ENTRY: 'Ya existe un registro con esos datos',
    FK_CONSTRAINT: 'No se puede eliminar porque tiene registros relacionados',
    
    // Inventario
    INSUFFICIENT_STOCK: 'Stock insuficiente',
    PRODUCT_NOT_FOUND: 'Producto no encontrado',
    CATEGORY_NOT_FOUND: 'Categoría no encontrada',
    
    // Sistema
    INTERNAL_ERROR: 'Error interno del servidor',
    DATABASE_CONNECTION_ERROR: 'Error de conexión a la base de datos'
  },

  // Mensajes de éxito
  SUCCESS_MESSAGES: {
    CREATED: 'Registro creado correctamente',
    UPDATED: 'Registro actualizado correctamente',
    DELETED: 'Registro eliminado correctamente',
    LOGIN_SUCCESS: 'Sesión iniciada correctamente',
    LOGOUT_SUCCESS: 'Sesión cerrada correctamente'
  },

  // Configuración de archivos
  FILES: {
    ALLOWED_EXTENSIONS: ['.xlsx', '.xls', '.csv'],
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    UPLOAD_PATH: './uploads'
  },

  // Headers HTTP comunes
  HTTP_HEADERS: {
    CONTENT_TYPE_JSON: 'application/json',
    CONTENT_TYPE_CSV: 'text/csv',
    CONTENT_TYPE_EXCEL: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  },

  // Códigos de estado HTTP
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    INTERNAL_SERVER_ERROR: 500
  },

  // Configuración de reportes
  REPORTS: {
    DATE_FORMATS: {
      SHORT: 'DD/MM/YYYY',
      LONG: 'DD/MM/YYYY HH:mm:ss',
      FILE_NAME: 'YYYY-MM-DD_HH-mm-ss'
    },
    DEFAULT_PERIOD_DAYS: 30
  }
};
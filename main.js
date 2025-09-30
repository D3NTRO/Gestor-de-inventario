// Para versiones de Electron que retornan path en lugar de módulo
let electronApp, BrowserWindow, ipcMain;

try {
  // En versiones recientes, require('electron') retorna path del ejecutable
  // Pero cuando ejecutamos con electron.exe, el módulo está disponible
  if (process.versions.electron) {
    // Estamos ejecutando dentro de Electron
    const electron = require('electron');
    electronApp = electron.app;
    BrowserWindow = electron.BrowserWindow;
    ipcMain = electron.ipcMain;
    console.log('Electron cargado correctamente desde proceso');
  } else {
    throw new Error('Debe ejecutarse con electron.exe');
  }
} catch (error) {
  console.error('Error cargando Electron:', error.message);
  console.error('Ejecuta con: .\\node_modules\\electron\\dist\\electron.exe .\\main.js');
  process.exit(1);
}

const path = require('path');

console.log('Iniciando carga de dependencias...');

// Importar configuración y servicios con mejor manejo de errores
let config, logger, ErrorHandler, AuthMiddleware;

try {
  require('dotenv').config();
  config = require('./config/app');
  logger = require('./utils/logger');
  ErrorHandler = require('./middleware/errorHandler');
  AuthMiddleware = require('./middleware/auth');
  console.log('Configuración y middleware cargados correctamente');
} catch (error) {
  console.error('Error cargando configuración:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}

// Importar servicios con manejo de errores
let AuthService, ProductService, CategoryService, UserService, SalesService, ReportService;

try {
  AuthService = require('./services/AuthService');
  ProductService = require('./services/ProductService');
  CategoryService = require('./services/CategoryService');
  UserService = require('./services/UserService');
  SalesService = require('./services/SalesService');
  ReportService = require('./services/ReportService');
  console.log('Servicios cargados correctamente');
} catch (error) {
  console.error('Error cargando servicios:', error.message);
  console.error('Ejecuta: npm install dotenv bcrypt');
  process.exit(1);
}

let mainWindow;

// Validar configuración al iniciar
try {
  config.validate();
  logger.info('Aplicación iniciando', { 
    version: config.app.version, 
    environment: config.app.environment 
  });
} catch (error) {
  console.error('Error de configuración:', error.message);
  console.error('Verifica tu archivo .env y que contenga DB_PASSWORD');
  process.exit(1);
}

// Crear ventana principal
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('public/login.html');
  
  logger.info('Ventana principal creada');
}

electronApp.whenReady().then(() => {
  createWindow();
  logger.info('Electron app lista');
});

// =============================================
// AUTENTICACIÓN Y SESIONES (CORREGIDAS)
// =============================================

ipcMain.handle('login', async (_, data) => {
  try {
    const { username, password } = data || {};
    if (!username || !password) {
      return { success: false, error: 'Usuario y contraseña requeridos' };
    }
    
    logger.info('Intento de login', { username });
    const result = await AuthService.login(username, password);
    
    if (result.success) {
      AuthMiddleware.logUserActivity(result.user, 'LOGIN');
    }
    
    return result;
  } catch (error) {
    logger.error('Error en login:', { error: error.message });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('logout', async (_, data) => {
  try {
    const { token } = data || {};
    logger.info('Logout solicitado');
    const result = await AuthService.logout(token);
    
    if (result.success) {
      logger.info('Logout exitoso');
    }
    
    return result;
  } catch (error) {
    logger.error('Error en logout:', { error: error.message });
    return { success: false, error: error.message };
  }
});

ipcMain.handle('validar-sesion', async (_, data) => {
  try {
    const { token } = data || {};
    return await AuthService.validarSesion(token);
  } catch (error) {
    logger.error('Error validando sesión:', { error: error.message });
    return { success: false, error: error.message };
  }
});

// =============================================
// GESTIÓN DE USUARIOS (Solo Admin) - CORREGIDAS
// =============================================

ipcMain.handle('listar-usuarios', 
  AuthMiddleware.withAdminAuth(
    (token) => AuthService.validarSesion(token),
    async (_, { user }) => {
      AuthMiddleware.logUserActivity(user, 'LIST_USERS');
      return await UserService.listarUsuarios();
    }
  )
);

ipcMain.handle('agregar-usuario',
  AuthMiddleware.withAdminAuth(
    (token) => AuthService.validarSesion(token),
    async (_, { user, ...userData }) => {
      AuthMiddleware.logUserActivity(user, 'CREATE_USER', { newUser: userData.username });
      return await UserService.agregarUsuario(userData);
    }
  )
);

ipcMain.handle('editar-usuario',
  AuthMiddleware.withAdminAuth(
    (token) => AuthService.validarSesion(token),
    async (_, { user, ...userData }) => {
      AuthMiddleware.logUserActivity(user, 'UPDATE_USER', { targetUser: userData.username });
      return await UserService.editarUsuario(userData);
    }
  )
);

ipcMain.handle('borrar-usuario',
  AuthMiddleware.withAdminAuth(
    (token) => AuthService.validarSesion(token),
    async (_, { user, username }) => {
      AuthMiddleware.logUserActivity(user, 'DELETE_USER', { deletedUser: username });
      return await UserService.borrarUsuario(username);
    }
  )
);

// =============================================
// GESTIÓN DE CATEGORÍAS (CORREGIDAS)
// =============================================

ipcMain.handle('listar-categorias', async () => {
  try {
    return await CategoryService.listarCategorias();
  } catch (error) {
    logger.error('Error listando categorías:', { error: error.message });
    return [];
  }
});

ipcMain.handle('listar-categorias-completas', async () => {
  try {
    return await CategoryService.listarCategoriasConSubcategorias();
  } catch (error) {
    logger.error('Error listando categorías completas:', { error: error.message });
    return [];
  }
});

ipcMain.handle('agregar-categoria',
  AuthMiddleware.withAuth(
    (token) => AuthService.validarSesion(token),
    async (_, { user, nombre }) => {
      AuthMiddleware.logUserActivity(user, 'CREATE_CATEGORY', { name: nombre });
      return await CategoryService.agregarCategoria(nombre);
    }
  )
);

ipcMain.handle('actualizar-categoria',
  AuthMiddleware.withAuth(
    (token) => AuthService.validarSesion(token),
    async (_, { user, id, nombre }) => {
      AuthMiddleware.logUserActivity(user, 'UPDATE_CATEGORY', { id, name: nombre });
      return await CategoryService.actualizarCategoria(id, nombre);
    }
  )
);

ipcMain.handle('eliminar-categoria',
  AuthMiddleware.withAuth(
    (token) => AuthService.validarSesion(token),
    async (_, { user, id }) => {
      AuthMiddleware.logUserActivity(user, 'DELETE_CATEGORY', { id });
      return await CategoryService.eliminarCategoria(id);
    }
  )
);

// =============================================
// GESTIÓN DE SUBCATEGORÍAS (CORREGIDAS)
// =============================================

ipcMain.handle('listar-subcategorias', async (_, categoriaId) => {
  try {
    return await CategoryService.listarSubcategorias(categoriaId);
  } catch (error) {
    logger.error('Error listando subcategorías:', { error: error.message });
    return [];
  }
});

ipcMain.handle('agregar-subcategoria',
  AuthMiddleware.withAuth(
    (token) => AuthService.validarSesion(token),
    async (_, { user, nombre, categoriaId }) => {
      AuthMiddleware.logUserActivity(user, 'CREATE_SUBCATEGORY', { name: nombre, categoryId: categoriaId });
      return await CategoryService.agregarSubcategoria(nombre, categoriaId);
    }
  )
);

ipcMain.handle('actualizar-subcategoria',
  AuthMiddleware.withAuth(
    (token) => AuthService.validarSesion(token),
    async (_, { user, id, nombre }) => {
      AuthMiddleware.logUserActivity(user, 'UPDATE_SUBCATEGORY', { id, name: nombre });
      return await CategoryService.actualizarSubcategoria(id, nombre);
    }
  )
);

ipcMain.handle('eliminar-subcategoria',
  AuthMiddleware.withAuth(
    (token) => AuthService.validarSesion(token),
    async (_, { user, id }) => {
      AuthMiddleware.logUserActivity(user, 'DELETE_SUBCATEGORY', { id });
      return await CategoryService.eliminarSubcategoria(id);
    }
  )
);

// =============================================
// GESTIÓN DE PRODUCTOS (CORREGIDAS)
// =============================================

ipcMain.handle('listar-productos', async (_, filtros = {}) => {
  try {
    const { page = 1, limit = 100, ...otrosFiltros } = filtros;
    return await ProductService.listarProductos(page, limit, otrosFiltros);
  } catch (error) {
    logger.error('Error listando productos:', { error: error.message });
    return { productos: [], total: 0, page: 1, totalPages: 0 };
  }
});

ipcMain.handle('obtener-producto', async (_, id) => {
  try {
    return await ProductService.obtenerProductoPorId(id);
  } catch (error) {
    logger.error('Error obteniendo producto:', { error: error.message });
    return null;
  }
});

ipcMain.handle('agregar-producto',
  AuthMiddleware.withAuth(
    (token) => AuthService.validarSesion(token),
    async (_, { user, ...productData }) => {
      AuthMiddleware.logUserActivity(user, 'CREATE_PRODUCT', { name: productData.nombre });
      return await ProductService.agregarProducto(productData);
    }
  )
);

ipcMain.handle('editar-producto',
  AuthMiddleware.withAuth(
    (token) => AuthService.validarSesion(token),
    async (_, { user, ...productData }) => {
      AuthMiddleware.logUserActivity(user, 'UPDATE_PRODUCT', { id: productData.id });
      return await ProductService.actualizarProducto(productData);
    }
  )
);

ipcMain.handle('actualizar-producto',
  AuthMiddleware.withAuth(
    (token) => AuthService.validarSesion(token),
    async (_, { user, ...productData }) => {
      AuthMiddleware.logUserActivity(user, 'UPDATE_PRODUCT_FIELD', { 
        id: productData.id, 
        fields: Object.keys(productData).filter(k => k !== 'id') 
      });
      return await ProductService.actualizarProducto(productData);
    }
  )
);

ipcMain.handle('eliminar-producto',
  AuthMiddleware.withAuth(
    (token) => AuthService.validarSesion(token),
    async (_, { user, id }) => {
      AuthMiddleware.logUserActivity(user, 'DELETE_PRODUCT', { id });
      return await ProductService.eliminarProducto(id);
    }
  )
);

// Compatibilidad con el frontend existente
ipcMain.handle('listar-productos-categoria', async (_, categoriaId) => {
  try {
    const result = await ProductService.listarProductos(1, 1000, { categoria: categoriaId });
    return result.productos || [];
  } catch (error) {
    logger.error('Error listando productos por categoría:', { error: error.message });
    return [];
  }
});

ipcMain.handle('actualizar-campo-producto',
  AuthMiddleware.withAuth(
    (token) => AuthService.validarSesion(token),
    async (_, { user, id, campo, valor }) => {
      AuthMiddleware.logUserActivity(user, 'UPDATE_PRODUCT_FIELD', { id, field: campo });
      return await ProductService.actualizarProducto({ id, [campo]: valor });
    }
  )
);

ipcMain.handle('filtrar-productos-excel', async (_, filtros) => {
  try {
    const result = await ProductService.listarProductos(1, 10000, filtros);
    return result.productos || [];
  } catch (error) {
    logger.error('Error filtrando productos:', { error: error.message });
    return [];
  }
});

// =============================================
// GESTIÓN DE VENTAS
// =============================================

ipcMain.handle('registrar-venta',
  AuthMiddleware.withAuth(
    (token) => AuthService.validarSesion(token),
    async (_, { user, ...ventaData }) => {
      AuthMiddleware.logUserActivity(user, 'REGISTER_SALE', { 
        products: ventaData.productos?.length 
      });
      return await SalesService.registrarVenta({ ...ventaData, usuarioId: user.id });
    }
  )
);

ipcMain.handle('listar-ventas',
  AuthMiddleware.withAuth(
    (token) => AuthService.validarSesion(token),
    async (_, { user, filtros = {} }) => {
      return await SalesService.listarVentas(filtros);
    }
  )
);

// =============================================
// GESTIÓN DE SERVICIOS
// =============================================

ipcMain.handle('listar-servicios', async () => {
  try {
    return await SalesService.listarServicios();
  } catch (error) {
    logger.error('Error listando servicios:', { error: error.message });
    return [];
  }
});

ipcMain.handle('agregar-servicio',
  AuthMiddleware.withAuth(
    (token) => AuthService.validarSesion(token),
    async (_, { user, ...servicioData }) => {
      AuthMiddleware.logUserActivity(user, 'CREATE_SERVICE', { name: servicioData.nombre });
      return await SalesService.agregarServicio(servicioData);
    }
  )
);

// =============================================
// REPORTES Y ESTADÍSTICAS (CORREGIDAS)
// =============================================

ipcMain.handle('reporte-inventario', async () => {
  try {
    return await ReportService.reporteInventario();
  } catch (error) {
    logger.error('Error generando reporte:', { error: error.message });
    return null;
  }
});

ipcMain.handle('reporte-ventas', async (_, data) => {
  try {
    const { filtros } = data || {};
    return await ReportService.reporteVentas(filtros);
  } catch (error) {
    logger.error('Error generando reporte de ventas:', { error: error.message });
    return null;
  }
});

// =============================================
// UTILIDADES DEL SISTEMA (CORREGIDAS)
// =============================================

ipcMain.handle('test-connection', async () => {
  try {
    // Probar conexión listando categorías
    const categorias = await CategoryService.listarCategorias();
    return { 
      success: true, 
      message: 'Conexión exitosa', 
      data: { categorias: categorias.length } 
    };
  } catch (error) {
    return { 
      success: false, 
      message: 'Error de conexión', 
      error: error.message 
    };
  }
});

ipcMain.handle('get-app-version', () => {
  return config.app.version;
});

ipcMain.handle('get-system-info', 
  AuthMiddleware.withAdminAuth(
    (token) => AuthService.validarSesion(token),
    async () => {
      return {
        version: config.app.version,
        environment: config.app.environment,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        node_version: process.version
      };
    }
  )
);

// =============================================
// MANEJO DE EVENTOS DE LA APLICACIÓN
// =============================================

electronApp.on('window-all-closed', () => {
  logger.info('Todas las ventanas cerradas');
  if (process.platform !== 'darwin') {
    electronApp.quit();
  }
});

electronApp.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Cleanup al cerrar la aplicación
process.on('exit', () => {
  logger.info('Aplicación cerrando');
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM recibido, cerrando aplicación');
  electronApp.quit();
});

process.on('SIGINT', () => {
  logger.info('SIGINT recibido, cerrando aplicación');
  electronApp.quit();
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
  logger.error('Error no capturado:', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Promise rechazada no manejada:', { reason, promise });
});

logger.info('Sistema de gestión de inventario iniciado correctamente');
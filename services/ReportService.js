const db = require('../config/database');
const logger = require('../utils/logger');
const Validators = require('../utils/validators');
const Helpers = require('../utils/helpers');
const ErrorHandler = require('../middleware/errorHandler');
const ProductService = require('./ProductService');

class SalesService {
  async registrarVenta(data) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const { productos, metodoPago, descuentoTotal, usuarioId } = data;
      
      // Validaciones básicas
      if (!productos || !Array.isArray(productos) || productos.length === 0) {
        throw ErrorHandler.createValidationError('Se requiere al menos un producto para la venta');
      }

      if (!usuarioId) {
        throw ErrorHandler.createValidationError('ID de usuario requerido');
      }

      const validatedUserId = Validators.id(usuarioId, 'Usuario');
      const validatedMetodoPago = metodoPago || 'efectivo';
      const validatedDescuento = Validators.positiveNumber(descuentoTotal || 0, 'Descuento', true);

      let totalVenta = 0;
      const ventaItems = [];

      // Procesar cada producto en la venta
      for (const item of productos) {
        const { productoId, cantidad, precioUnitario } = item;
        
        const validatedProductoId = Validators.id(productoId, 'Producto ID');
        const validatedCantidad = Validators.integer(cantidad, 'Cantidad', 1);
        const validatedPrecio = Validators.positiveNumber(precioUnitario, 'Precio unitario');

        // Verificar stock disponible
        const producto = await ProductService.obtenerProductoPorId(validatedProductoId);
        if (!producto) {
          throw ErrorHandler.createBusinessError(`Producto con ID ${validatedProductoId} no encontrado`);
        }

        if (producto.stock < validatedCantidad) {
          throw ErrorHandler.createBusinessError(
            `Stock insuficiente para ${producto.nombre}. Stock disponible: ${producto.stock}, solicitado: ${validatedCantidad}`
          );
        }

        const subtotal = validatedCantidad * validatedPrecio;
        totalVenta += subtotal;

        // Registrar item de venta
        const ventaRes = await client.query(`
          INSERT INTO ventas (producto_id, cantidad, precio_unitario, precio_total, metodo_pago, usuario_id, descuento)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [
          validatedProductoId, 
          validatedCantidad, 
          validatedPrecio, 
          subtotal, 
          validatedMetodoPago, 
          validatedUserId,
          validatedDescuento
        ]);

        ventaItems.push({
          ventaId: ventaRes.rows[0].id,
          productoId: validatedProductoId,
          nombreProducto: producto.nombre,
          cantidad: validatedCantidad,
          precioUnitario: validatedPrecio,
          subtotal
        });

        // Actualizar stock del producto
        await ProductService.actualizarProducto({
          id: validatedProductoId,
          stock: producto.stock - validatedCantidad
        });
      }

      await client.query('COMMIT');

      logger.info('Venta registrada exitosamente', {
        totalItems: ventaItems.length,
        totalVenta,
        metodoPago: validatedMetodoPago,
        usuarioId: validatedUserId
      });

      return { 
        success: true, 
        ventaItems,
        total: totalVenta - validatedDescuento,
        totalSinDescuento: totalVenta,
        descuento: validatedDescuento
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error registrando venta:', { error: error.message });
      return ErrorHandler.handle(error);
    } finally {
      client.release();
    }
  }

  async listarVentas(filtros = {}) {
    try {
      const { fechaInicio, fechaFin, limit = 100, page = 1, usuarioId } = filtros;

      const { limit: validatedLimit, page: validatedPage } = Validators.paginationParams(page, limit);
      const offset = Helpers.calculateOffset(validatedPage, validatedLimit);

      let query = `
        SELECT 
          v.*,
          p.nombre as producto_nombre,
          u.username as vendedor,
          c.nombre as categoria
        FROM ventas v
        LEFT JOIN productos p ON v.producto_id = p.id
        LEFT JOIN usuarios u ON v.usuario_id = u.id
        LEFT JOIN categorias c ON p.categoria_id = c.id
      `;
      
      const conditions = [];
      const params = [];
      let paramCount = 1;

      if (fechaInicio) {
        const validatedFechaInicio = Validators.date(fechaInicio, 'Fecha de inicio');
        conditions.push(`v.fecha >= $${paramCount}`);
        params.push(validatedFechaInicio);
        paramCount++;
      }
      
      if (fechaFin) {
        const validatedFechaFin = Validators.date(fechaFin, 'Fecha de fin');
        conditions.push(`v.fecha <= $${paramCount}`);
        params.push(validatedFechaFin);
        paramCount++;
      }

      if (usuarioId) {
        const validatedUserId = Validators.id(usuarioId, 'Usuario ID');
        conditions.push(`v.usuario_id = $${paramCount}`);
        params.push(validatedUserId);
        paramCount++;
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      // Query para contar total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM ventas v
        LEFT JOIN productos p ON v.producto_id = p.id
        LEFT JOIN usuarios u ON v.usuario_id = u.id
        ${conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''}
      `;

      query += ` ORDER BY v.fecha DESC LIMIT ${paramCount} OFFSET ${paramCount + 1}`;
      params.push(validatedLimit, offset);

      const [dataRes, countRes] = await Promise.all([
        db.query(query, params),
        db.query(countQuery, params.slice(0, -2)) // Remover limit y offset para count
      ]);

      const total = parseInt(countRes.rows[0].total);
      const pagination = Helpers.calculatePagination(validatedPage, validatedLimit, total);

      return {
        ventas: dataRes.rows,
        pagination
      };
    } catch (error) {
      logger.error('Error listando ventas:', { error: error.message });
      return { ventas: [], pagination: null };
    }
  }

  async obtenerVentaPorId(id) {
    try {
      const validatedId = Validators.id(id);

      const res = await db.query(`
        SELECT 
          v.*,
          p.nombre as producto_nombre,
          p.precio_usd,
          p.precio_cup,
          u.username as vendedor,
          c.nombre as categoria
        FROM ventas v
        LEFT JOIN productos p ON v.producto_id = p.id
        LEFT JOIN usuarios u ON v.usuario_id = u.id
        LEFT JOIN categorias c ON p.categoria_id = c.id
        WHERE v.id = $1
      `, [validatedId]);

      return res.rows[0] || null;
    } catch (error) {
      logger.error('Error obteniendo venta:', { error: error.message });
      return null;
    }
  }

  async obtenerEstadisticasVentas(fechaInicio = null, fechaFin = null) {
    try {
      let query = `
        SELECT 
          COUNT(*) as total_ventas,
          SUM(precio_total - COALESCE(descuento, 0)) as ingresos_totales,
          AVG(precio_total - COALESCE(descuento, 0)) as venta_promedio,
          COUNT(DISTINCT producto_id) as productos_vendidos,
          COUNT(DISTINCT usuario_id) as vendedores_activos
        FROM ventas
      `;

      const params = [];
      const conditions = [];

      if (fechaInicio) {
        const validatedFechaInicio = Validators.date(fechaInicio);
        conditions.push('fecha >= $1');
        params.push(validatedFechaInicio);
      }

      if (fechaFin) {
        const validatedFechaFin = Validators.date(fechaFin);
        conditions.push(`fecha <= ${params.length + 1}`);
        params.push(validatedFechaFin);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      const res = await db.query(query, params);
      return res.rows[0];
    } catch (error) {
      logger.error('Error obteniendo estadísticas de ventas:', { error: error.message });
      return null;
    }
  }

  async obtenerProductosMasVendidos(limit = 10, fechaInicio = null, fechaFin = null) {
    try {
      const validatedLimit = Validators.integer(limit, 'Límite', 1, 100);

      let query = `
        SELECT 
          p.id,
          p.nombre,
          SUM(v.cantidad) as total_vendido,
          SUM(v.precio_total - COALESCE(v.descuento, 0)) as ingresos_generados,
          COUNT(v.id) as numero_ventas,
          c.nombre as categoria
        FROM ventas v
        JOIN productos p ON v.producto_id = p.id
        LEFT JOIN categorias c ON p.categoria_id = c.id
      `;

      const params = [];
      const conditions = [];

      if (fechaInicio) {
        const validatedFechaInicio = Validators.date(fechaInicio);
        conditions.push('v.fecha >= $1');
        params.push(validatedFechaInicio);
      }

      if (fechaFin) {
        const validatedFechaFin = Validators.date(fechaFin);
        conditions.push(`v.fecha <= ${params.length + 1}`);
        params.push(validatedFechaFin);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ` 
        GROUP BY p.id, p.nombre, c.nombre
        ORDER BY total_vendido DESC
        LIMIT ${params.length + 1}
      `;
      params.push(validatedLimit);

      const res = await db.query(query, params);
      return res.rows;
    } catch (error) {
      logger.error('Error obteniendo productos más vendidos:', { error: error.message });
      return [];
    }
  }

  // =============================================
  // GESTIÓN DE SERVICIOS
  // =============================================

  async listarServicios() {
    try {
      const res = await db.query(`
        SELECT s.*, c.nombre as categoria_nombre
        FROM servicios s
        LEFT JOIN categorias c ON s.categoria_id = c.id
        WHERE s.activo = true
        ORDER BY s.nombre
      `);
      return res.rows;
    } catch (error) {
      logger.error('Error listando servicios:', { error: error.message });
      return [];
    }
  }

  async agregarServicio(data) {
    try {
      const validatedData = Validators.validateObject(data, {
        nombre: [(value) => Validators.stringLength(value, 'Nombre del servicio', 1, 150)],
        descripcion: [(value) => value ? Validators.stringLength(value, 'Descripción', 0, 500) : null],
        precio: [Validators.positiveNumber],
        duracionEstimada: [(value) => value ? Validators.integer(value, 'Duración estimada', 1) : null],
        categoriaId: [(value) => value ? Validators.id(value, 'Categoría') : null]
      });

      const { nombre, descripcion, precio, duracionEstimada, categoriaId } = validatedData;

      await db.query(`
        INSERT INTO servicios (nombre, descripcion, precio, duracion_estimada, categoria_id)
        VALUES ($1, $2, $3, $4, $5)
      `, [nombre, descripcion, precio, duracionEstimada, categoriaId]);

      logger.info('Servicio agregado exitosamente', { nombre });
      return { success: true };
    } catch (error) {
      logger.error('Error agregando servicio:', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async editarServicio(data) {
    try {
      const { id, nombre, descripcion, precio, duracionEstimada, categoriaId } = data;
      
      const validatedId = Validators.id(id);
      const validatedNombre = Validators.stringLength(nombre, 'Nombre del servicio', 1, 150);
      const validatedDescripcion = descripcion ? Validators.stringLength(descripcion, 'Descripción', 0, 500) : null;
      const validatedPrecio = Validators.positiveNumber(precio, 'Precio');
      const validatedDuracion = duracionEstimada ? Validators.integer(duracionEstimada, 'Duración estimada', 1) : null;
      const validatedCategoriaId = categoriaId ? Validators.id(categoriaId, 'Categoría') : null;

      await db.query(`
        UPDATE servicios 
        SET nombre = $1, descripcion = $2, precio = $3, duracion_estimada = $4, categoria_id = $5
        WHERE id = $6
      `, [validatedNombre, validatedDescripcion, validatedPrecio, validatedDuracion, validatedCategoriaId, validatedId]);

      logger.info('Servicio actualizado exitosamente', { id: validatedId });
      return { success: true };
    } catch (error) {
      logger.error('Error editando servicio:', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async eliminarServicio(id) {
    try {
      const validatedId = Validators.id(id);

      // Marcar como inactivo en lugar de eliminar
      const res = await db.query('UPDATE servicios SET activo = false WHERE id = $1', [validatedId]);

      if (res.rowCount === 0) {
        return { success: false, error: 'Servicio no encontrado' };
      }

      logger.info('Servicio desactivado exitosamente', { id: validatedId });
      return { success: true };
    } catch (error) {
      logger.error('Error eliminando servicio:', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  async obtenerServicioPorId(id) {
    try {
      const validatedId = Validators.id(id);

      const res = await db.query(`
        SELECT s.*, c.nombre as categoria_nombre
        FROM servicios s
        LEFT JOIN categorias c ON s.categoria_id = c.id
        WHERE s.id = $1
      `, [validatedId]);

      return res.rows[0] || null;
    } catch (error) {
      logger.error('Error obteniendo servicio:', { error: error.message });
      return null;
    }
  }
}

module.exports = new SalesService();
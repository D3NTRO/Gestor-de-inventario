const db = require('../config/database');

class ProductService {
  async listarProductos(page = 1, limit = 100, filtros = {}) {
    try {
      const offset = (page - 1) * limit;
      const { categoria, subcategoria, mostrarSinStock = true, busqueda } = filtros;
      
      let whereClause = [];
      let params = [];
      let paramCount = 1;

      if (!mostrarSinStock) {
        whereClause.push('p.stock > 0');
      }

      if (categoria) {
        whereClause.push(`p.categoria_id = $${paramCount}`);
        params.push(categoria);
        paramCount++;
      }

      if (subcategoria) {
        whereClause.push(`p.subcategoria_id = $${paramCount}`);
        params.push(subcategoria);
        paramCount++;
      }

      if (busqueda) {
        whereClause.push(`(p.nombre ILIKE $${paramCount} OR p.descripcion ILIKE $${paramCount})`);
        params.push(`%${busqueda}%`);
        paramCount++;
      }

      const whereString = whereClause.length > 0 ? 'WHERE ' + whereClause.join(' AND ') : '';

      // Consulta principal con paginación
      const query = `
        SELECT 
          p.id, p.nombre, p.descripcion, p.precio, p.precio_usd, p.precio_cup,
          p.stock, p.cantidad, p.oprecio_cup, p.pxg_cup, p.extracciones, p.defectuosos,
          p.categoria_id, p.subcategoria_id, p.fecha_ingreso,
          c.nombre as categoria_nombre,
          s.nombre as subcategoria_nombre,
          CASE 
            WHEN p.stock = 0 THEN 'sin_stock'
            WHEN p.stock <= 5 THEN 'stock_bajo'
            WHEN p.stock <= 20 THEN 'stock_medio'
            ELSE 'stock_alto'
          END as estado_stock
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        LEFT JOIN subcategorias s ON p.subcategoria_id = s.id
        ${whereString}
        ORDER BY p.nombre
        LIMIT $${paramCount} OFFSET $${paramCount + 1}
      `;

      params.push(limit, offset);

      // Consulta para contar total
      const countQuery = `
        SELECT COUNT(*) as total
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        LEFT JOIN subcategorias s ON p.subcategoria_id = s.id
        ${whereString}
      `;

      const [dataRes, countRes] = await Promise.all([
        db.query(query, params),
        db.query(countQuery, params.slice(0, -2)) // Remover limit y offset para count
      ]);

      return {
        productos: dataRes.rows,
        total: parseInt(countRes.rows[0].total),
        page,
        totalPages: Math.ceil(countRes.rows[0].total / limit)
      };
    } catch (error) {
      console.error('Error listando productos:', error);
      return { productos: [], total: 0, page: 1, totalPages: 0 };
    }
  }

  async obtenerProductoPorId(id) {
    try {
      const res = await db.query(`
        SELECT 
          p.*,
          c.nombre as categoria_nombre,
          s.nombre as subcategoria_nombre
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        LEFT JOIN subcategorias s ON p.subcategoria_id = s.id
        WHERE p.id = $1
      `, [id]);

      return res.rows[0] || null;
    } catch (error) {
      console.error('Error obteniendo producto:', error);
      return null;
    }
  }

  async agregarProducto(data) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const { 
        nombre, descripcion, precio_usd, precio_cup, stock, cantidad,
        oprecio_cup, pxg_cup, extracciones, defectuosos,
        categoria_id, subcategoria_id, codigo_barras, proveedor 
      } = data;
      
      // Validaciones
      if (!nombre?.trim()) {
        throw new Error('El nombre del producto es requerido');
      }
      
      if (!categoria_id) {
        throw new Error('La categoría es requerida');
      }
      
      // Auto-calcular precio_cup si no se proporciona
      const TASA_CAMBIO = 395; // Mover a configuración
      let finalPrecioCup = precio_cup;
      if (!finalPrecioCup && precio_usd) {
        finalPrecioCup = precio_usd * TASA_CAMBIO;
      }
      
      const res = await client.query(`
        INSERT INTO productos (
          nombre, descripcion, precio, precio_usd, precio_cup, stock, cantidad,
          oprecio_cup, pxg_cup, extracciones, defectuosos,
          categoria_id, subcategoria_id, codigo_barras, proveedor
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id
      `, [
        nombre.trim(), 
        descripcion?.trim() || null, 
        precio_usd || 0,
        precio_usd || 0, 
        finalPrecioCup || 0, 
        stock || 0, 
        cantidad || 1, 
        oprecio_cup || 0, 
        pxg_cup || 0, 
        extracciones || 0, 
        defectuosos || 0,
        categoria_id, 
        subcategoria_id || null, 
        codigo_barras || null, 
        proveedor || null
      ]);

      // Registrar movimiento de stock inicial
      if (stock > 0) {
        await client.query(`
          INSERT INTO movimientos_stock (
            producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, motivo
          ) VALUES ($1, 'entrada', $2, 0, $2, 'Stock inicial')
        `, [res.rows[0].id, stock]);
      }

      await client.query('COMMIT');
      return { success: true, id: res.rows[0].id };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error agregando producto:', error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  async actualizarProducto(data) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      const { id, ...updateData } = data;
      
      if (!id) {
        throw new Error('ID de producto requerido');
      }

      // Obtener valores actuales para comparación
      const currentProduct = await this.obtenerProductoPorId(id);
      if (!currentProduct) {
        throw new Error('Producto no encontrado');
      }
      
      // Campos permitidos para actualización con validación
      const allowedFields = {
        'nombre': { column: 'nombre', validate: (v) => v?.trim() },
        'descripcion': { column: 'descripcion', validate: (v) => v?.trim() || null },
        'stock': { column: 'stock', validate: (v) => parseInt(v) >= 0 ? parseInt(v) : 0 },
        'cantidad': { column: 'cantidad', validate: (v) => parseInt(v) >= 1 ? parseInt(v) : 1 },
        'precio_usd': { column: 'precio_usd', validate: (v) => parseFloat(v) >= 0 ? parseFloat(v) : 0 },
        'precio_cup': { column: 'precio_cup', validate: (v) => parseFloat(v) >= 0 ? parseFloat(v) : 0 },
        'oprecio_cup': { column: 'oprecio_cup', validate: (v) => parseFloat(v) >= 0 ? parseFloat(v) : 0 },
        'pxg_cup': { column: 'pxg_cup', validate: (v) => parseFloat(v) >= 0 ? parseFloat(v) : 0 },
        'extracciones': { column: 'extracciones', validate: (v) => parseInt(v) >= 0 ? parseInt(v) : 0 },
        'defectuosos': { column: 'defectuosos', validate: (v) => parseInt(v) >= 0 ? parseInt(v) : 0 },
        'categoria_id': { column: 'categoria_id', validate: (v) => parseInt(v) || null },
        'subcategoria_id': { column: 'subcategoria_id', validate: (v) => parseInt(v) || null }
      };
      
      const fields = [];
      const values = [];
      let paramCount = 1;
      
      // Procesar campos de actualización
      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields[key]) {
          const fieldConfig = allowedFields[key];
          const validatedValue = fieldConfig.validate(value);
          
          fields.push(`${fieldConfig.column} = $${paramCount}`);
          values.push(validatedValue);
          paramCount++;

          // Registrar movimiento de stock si cambió
          if (key === 'stock' && validatedValue !== currentProduct.stock) {
            const diferencia = validatedValue - currentProduct.stock;
            const tipoMovimiento = diferencia > 0 ? 'entrada' : 'salida';
            
            await client.query(`
              INSERT INTO movimientos_stock (
                producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, motivo
              ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [
              id, 
              tipoMovimiento, 
              Math.abs(diferencia), 
              currentProduct.stock, 
              validatedValue, 
              'Ajuste manual'
            ]);
          }
        }
      }
      
      if (fields.length === 0) {
        throw new Error('No hay campos válidos para actualizar');
      }
      
      // Agregar fecha de actualización
      fields.push(`fecha_actualizacion = NOW()`);
      values.push(id);
      
      const query = `UPDATE productos SET ${fields.join(', ')} WHERE id = $${paramCount}`;
      await client.query(query, values);
      
      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error actualizando producto:', error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  async eliminarProducto(id) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      if (!id) {
        throw new Error('ID de producto requerido');
      }
      
      // Verificar si el producto existe y obtener datos para el log
      const producto = await this.obtenerProductoPorId(id);
      if (!producto) {
        throw new Error('Producto no encontrado');
      }
      
      // Registrar eliminación en movimientos si había stock
      if (producto.stock > 0) {
        await client.query(`
          INSERT INTO movimientos_stock (
            producto_id, tipo_movimiento, cantidad, stock_anterior, stock_nuevo, motivo
          ) VALUES ($1, 'salida', $2, $2, 0, 'Producto eliminado')
        `, [id, producto.stock]);
      }
      
      // Eliminar producto
      const res = await client.query('DELETE FROM productos WHERE id = $1', [id]);
      
      if (res.rowCount === 0) {
        throw new Error('No se pudo eliminar el producto');
      }
      
      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error eliminando producto:', error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }
}

module.exports = new ProductService();
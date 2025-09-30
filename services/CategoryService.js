const db = require('../config/database');

class CategoryService {
  async listarCategorias() {
    try {
      const res = await db.query('SELECT * FROM categorias ORDER BY nombre');
      return res.rows;
    } catch (error) {
      console.error('Error listando categorías:', error);
      return [];
    }
  }

  async listarCategoriasConSubcategorias() {
    try {
      const res = await db.query(`
        SELECT 
          c.id, c.nombre,
          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT('id', s.id, 'nombre', s.nombre)
              ORDER BY s.nombre
            ) FILTER (WHERE s.id IS NOT NULL),
            '[]'
          ) as subcategorias
        FROM categorias c
        LEFT JOIN subcategorias s ON c.id = s.categoria_id
        GROUP BY c.id, c.nombre
        ORDER BY c.nombre
      `);
      
      return res.rows;
    } catch (error) {
      console.error('Error listando categorías con subcategorías:', error);
      return [];
    }
  }

  async agregarCategoria(nombre) {
    try {
      if (!nombre?.trim()) {
        throw new Error('El nombre de la categoría es requerido');
      }
      
      const res = await db.query(
        'INSERT INTO categorias (nombre) VALUES ($1) RETURNING id', 
        [nombre.trim()]
      );
      
      return { success: true, id: res.rows[0].id };
    } catch (error) {
      console.error('Error agregando categoría:', error);
      
      if (error.code === '23505') { // Violación de constraint único
        return { success: false, error: 'Ya existe una categoría con ese nombre' };
      }
      
      return { success: false, error: error.message };
    }
  }

  async actualizarCategoria(id, nombre) {
    try {
      if (!id || !nombre?.trim()) {
        throw new Error('ID y nombre de categoría son requeridos');
      }
      
      const res = await db.query(
        'UPDATE categorias SET nombre = $1 WHERE id = $2', 
        [nombre.trim(), id]
      );
      
      if (res.rowCount === 0) {
        throw new Error('Categoría no encontrada');
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error actualizando categoría:', error);
      
      if (error.code === '23505') {
        return { success: false, error: 'Ya existe una categoría con ese nombre' };
      }
      
      return { success: false, error: error.message };
    }
  }

  async eliminarCategoria(id) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      if (!id) {
        throw new Error('ID de categoría requerido');
      }
      
      // Verificar si hay productos asociados
      const productCheck = await client.query(
        'SELECT COUNT(*) as count FROM productos WHERE categoria_id = $1', 
        [id]
      );
      
      if (parseInt(productCheck.rows[0].count) > 0) {
        throw new Error('No se puede eliminar la categoría porque tiene productos asociados');
      }
      
      // Eliminar subcategorías primero
      await client.query('DELETE FROM subcategorias WHERE categoria_id = $1', [id]);
      
      // Eliminar categoría
      const res = await client.query('DELETE FROM categorias WHERE id = $1', [id]);
      
      if (res.rowCount === 0) {
        throw new Error('Categoría no encontrada');
      }
      
      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error eliminando categoría:', error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  // Métodos para subcategorías
  async listarSubcategorias(categoriaId) {
    try {
      const res = await db.query(
        'SELECT * FROM subcategorias WHERE categoria_id = $1 ORDER BY nombre',
        [categoriaId]
      );
      return res.rows;
    } catch (error) {
      console.error('Error listando subcategorías:', error);
      return [];
    }
  }

  async agregarSubcategoria(nombre, categoriaId) {
    try {
      if (!nombre?.trim()) {
        throw new Error('El nombre de la subcategoría es requerido');
      }
      
      if (!categoriaId) {
        throw new Error('La categoría padre es requerida');
      }
      
      const res = await db.query(
        'INSERT INTO subcategorias (nombre, categoria_id) VALUES ($1, $2) RETURNING id',
        [nombre.trim(), categoriaId]
      );
      
      return { success: true, id: res.rows[0].id };
    } catch (error) {
      console.error('Error agregando subcategoría:', error);
      
      if (error.code === '23505') {
        return { success: false, error: 'Ya existe una subcategoría con ese nombre en esta categoría' };
      }
      
      return { success: false, error: error.message };
    }
  }

  async actualizarSubcategoria(id, nombre) {
    try {
      if (!id || !nombre?.trim()) {
        throw new Error('ID y nombre de subcategoría son requeridos');
      }
      
      const res = await db.query(
        'UPDATE subcategorias SET nombre = $1 WHERE id = $2', 
        [nombre.trim(), id]
      );
      
      if (res.rowCount === 0) {
        throw new Error('Subcategoría no encontrada');
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error actualizando subcategoría:', error);
      
      if (error.code === '23505') {
        return { success: false, error: 'Ya existe una subcategoría con ese nombre en esta categoría' };
      }
      
      return { success: false, error: error.message };
    }
  }

  async eliminarSubcategoria(id) {
    try {
      if (!id) {
        throw new Error('ID de subcategoría requerido');
      }
      
      // Verificar si hay productos asociados
      const productCheck = await db.query(
        'SELECT COUNT(*) as count FROM productos WHERE subcategoria_id = $1', 
        [id]
      );
      
      if (parseInt(productCheck.rows[0].count) > 0) {
        throw new Error('No se puede eliminar la subcategoría porque tiene productos asociados');
      }
      
      const res = await db.query('DELETE FROM subcategorias WHERE id = $1', [id]);
      
      if (res.rowCount === 0) {
        throw new Error('Subcategoría no encontrada');
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error eliminando subcategoría:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new CategoryService();
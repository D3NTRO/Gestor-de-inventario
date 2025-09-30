-- Active: 1743523369124@@127.0.0.1@5432@miapp
-- Crear tabla de usuarios
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
);

-- Insertar usuario inicial con contraseña encriptada usando la extensión pgcrypto
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO usuarios (username, password_hash)
VALUES ('admin', crypt('1234', gen_salt('bf')));

-- Verificar que el usuario fue creado
SELECT * FROM usuarios;

ALTER TABLE usuarios ADD COLUMN rol VARCHAR(20) DEFAULT 'usuario';

-- Actualizar el usuario inicial como admin
UPDATE usuarios SET rol = 'admin' WHERE username = 'admin';

-- Tabla de inventario 
CREATE TABLE inventario (
    id SERIAL PRIMARY KEY,
    producto VARCHAR(150) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    cantidad INT NOT NULL DEFAULT 1,
    precio_usd NUMERIC(10,2) NOT NULL,
    precio_cup NUMERIC(12,2) NOT NULL,
    oprecio_cup NUMERIC(12,2),   -- costo u otro precio
    pxg_cup NUMERIC(12,2),       -- precio por grupo o ganancia
    fecha_ingreso TIMESTAMP DEFAULT NOW()
);
--inventario
INSERT INTO inventario (producto, stock, cantidad, precio_usd, precio_cup, oprecio_cup, pxg_cup)
VALUES 
('Audífonos Bluetooth / Redmi Buds', 1, 1, 20.00, 7900, NULL, NULL),
('Audífonos Bluetooth / Casco Sindae IH-819', 1, 1, 30.00, 11850, NULL, NULL);


-- Tabla de registros de ventas
CREATE TABLE ventas (
    id SERIAL PRIMARY KEY,
    inventario_id INT REFERENCES inventario(id),
    cantidad INTEGER NOT NULL,
    precio_total NUMERIC(10,2) NOT NULL,
    fecha TIMESTAMP DEFAULT NOW()
);
--categorias
-- Tabla de Categorías
CREATE TABLE categorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE
);
INSERT INTO categorias (nombre) VALUES
('Electrónica'),
('Ropa'),
('Alimentos'),
('Accesorios');
ALTER TABLE inventario
ADD COLUMN categoria_id INT REFERENCES categorias(id);
INSERT INTO inventario (producto, stock, cantidad, precio_usd, precio_cup, categoria_id)
VALUES ('Audífonos Bluetooth / Redmi Buds', 1, 1, 20.00, 7900, 1);
SELECT i.producto, i.stock, i.precio_usd, i.precio_cup, c.nombre AS categoria
FROM inventario i
JOIN categorias c ON i.categoria_id = c.id;

--subcategorias
CREATE TABLE subcategorias (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    categoria_id INT NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
    UNIQUE (nombre, categoria_id) -- evita duplicados dentro de una misma categoría
);

-- Insertamos categoría Móviles
INSERT INTO categorias (nombre) VALUES ('Móviles');

-- Recuperamos el id de Móviles
SELECT id FROM categorias WHERE nombre = 'Móviles';

-- Supongamos que el id es 1
INSERT INTO subcategorias (nombre, categoria_id) VALUES
('Samsung', 1),
('iPhone', 1),
('Xiaomi', 1);
--dd categoria
INSERT INTO categorias (nombre) VALUES ($1);
UPDATE categorias
SET nombre = $1
WHERE id = $2;
DELETE FROM categorias WHERE id = $1;
SELECT * FROM categorias ORDER BY nombre;

--crud subcategorias
INSERT INTO subcategorias (nombre, categoria_id) VALUES ($1, $2);
--Editar subcategoría
UPDATE subcategorias
SET nombre = $1
WHERE id = $2;
--Eliminar subcategoría
DELETE FROM subcategorias WHERE id = $1;
--Listar subcategorías de una categoría
SELECT * FROM subcategorias WHERE categoria_id = $1 ORDER BY nombre;


-- Ejemplo de inserción de subcategorías para "Móviles"
-- Supongamos que "Móviles" tiene id = 1
INSERT INTO subcategorias (nombre, categoria_id) VALUES
('Samsung', 1),
('Xiaomi', 1),
('Apple', 1),
('Huawei', 1);

-- Tabla de productos, con categoría obligatoria y subcategoría opcional
-- Tabla de Productos
CREATE TABLE productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10,2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    categoria_id INT REFERENCES categorias(id) ON DELETE SET NULL,
    subcategoria_id INT REFERENCES subcategorias(id) ON DELETE SET NULL
);
INSERT INTO productos (nombre, descripcion, precio, stock, categoria_id, subcategoria_id)
VALUES ($1, $2, $3, $4, $5, $6);
--Editar producto

UPDATE productos
SET nombre = $1, descripcion = $2, precio = $3, stock = $4,
    categoria_id = $5, subcategoria_id = $6
WHERE id = $7;
--Eliminar producto
DELETE FROM productos WHERE id = $1;
--Listar productos por categoría
SELECT * FROM productos WHERE categoria_id = $1 ORDER BY nombre;
--Listar productos por subcategoría

SELECT * FROM productos WHERE subcategoria_id = $1 ORDER BY nombre;

-- 1. MIGRACIÓN DE DATOS DE INVENTARIO A PRODUCTOS
-- Primero migrar los datos existentes de inventario a productos
INSERT INTO productos (nombre, precio, stock, categoria_id)
SELECT 
    producto as nombre,
    COALESCE(precio_cup, precio_usd * 395) as precio, -- Conversión aproximada si no hay precio_cup
    stock,
    categoria_id
FROM inventario 
WHERE NOT EXISTS (
    SELECT 1 FROM productos p WHERE p.nombre = inventario.producto
);

-- 2. AGREGAR COLUMNAS FALTANTES A PRODUCTOS PARA COMPATIBILIDAD
ALTER TABLE productos 
ADD COLUMN IF NOT EXISTS precio_usd NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS precio_cup NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS fecha_ingreso TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS codigo_barras VARCHAR(50),
ADD COLUMN IF NOT EXISTS proveedor VARCHAR(100),
ADD COLUMN IF NOT EXISTS ubicacion VARCHAR(100);

-- 3. ACTUALIZAR PRODUCTOS CON DATOS DE INVENTARIO
UPDATE productos 
SET 
    precio_usd = i.precio_usd,
    precio_cup = i.precio_cup,
    fecha_ingreso = i.fecha_ingreso
FROM inventario i 
WHERE productos.nombre = i.producto;

-- 4. TABLA DE SESIONES PARA MANEJAR AUTENTICACIÓN
CREATE TABLE IF NOT EXISTS sesiones (
    id SERIAL PRIMARY KEY,
    usuario_id INT REFERENCES usuarios(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT NOW(),
    fecha_expiracion TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours'),
    activa BOOLEAN DEFAULT true
);

-- 5. TABLA DE VENTAS MEJORADA
DROP TABLE IF EXISTS ventas;
CREATE TABLE ventas (
    id SERIAL PRIMARY KEY,
    producto_id INT REFERENCES productos(id) ON DELETE SET NULL,
    cantidad INTEGER NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(10,2) NOT NULL,
    precio_total NUMERIC(10,2) NOT NULL,
    descuento NUMERIC(5,2) DEFAULT 0,
    metodo_pago VARCHAR(50) DEFAULT 'efectivo',
    usuario_id INT REFERENCES usuarios(id),
    fecha TIMESTAMP DEFAULT NOW(),
    notas TEXT
);

-- 6. TABLA DE SERVICIOS
CREATE TABLE IF NOT EXISTS servicios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    precio NUMERIC(10,2) NOT NULL,
    duracion_estimada INTEGER, -- en minutos
    categoria_id INT REFERENCES categorias(id),
    activo BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP DEFAULT NOW()
);

-- 7. TABLA DE ÓRDENES DE SERVICIO
CREATE TABLE IF NOT EXISTS ordenes_servicio (
    id SERIAL PRIMARY KEY,
    servicio_id INT REFERENCES servicios(id),
    cliente_nombre VARCHAR(100),
    cliente_telefono VARCHAR(20),
    cliente_email VARCHAR(100),
    estado VARCHAR(50) DEFAULT 'pendiente', -- pendiente, en_proceso, completado, cancelado
    fecha_solicitud TIMESTAMP DEFAULT NOW(),
    fecha_completado TIMESTAMP,
    precio_final NUMERIC(10,2),
    notas TEXT,
    usuario_asignado_id INT REFERENCES usuarios(id)
);

-- 8. TABLA DE MOVIMIENTOS DE STOCK (PARA TRAZABILIDAD)
CREATE TABLE IF NOT EXISTS movimientos_stock (
    id SERIAL PRIMARY KEY,
    producto_id INT REFERENCES productos(id) ON DELETE CASCADE,
    tipo_movimiento VARCHAR(20) NOT NULL, -- 'entrada', 'salida', 'ajuste'
    cantidad INTEGER NOT NULL,
    stock_anterior INTEGER NOT NULL,
    stock_nuevo INTEGER NOT NULL,
    motivo VARCHAR(100),
    usuario_id INT REFERENCES usuarios(id),
    fecha TIMESTAMP DEFAULT NOW()
);

-- 9. ÍNDICES PARA MEJORAR RENDIMIENTO
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_productos_subcategoria ON productos(subcategoria_id);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_ventas_producto ON ventas(producto_id);
CREATE INDEX IF NOT EXISTS idx_sesiones_token ON sesiones(token);
CREATE INDEX IF NOT EXISTS idx_movimientos_producto ON movimientos_stock(producto_id);

-- 10. FUNCIÓN PARA ACTUALIZAR STOCK AUTOMÁTICAMENTE
CREATE OR REPLACE FUNCTION actualizar_stock_venta()
RETURNS TRIGGER AS $$
BEGIN
    -- Registrar movimiento de stock
    INSERT INTO movimientos_stock (
        producto_id, 
        tipo_movimiento, 
        cantidad, 
        stock_anterior, 
        stock_nuevo, 
        motivo, 
        usuario_id
    )
    SELECT 
        NEW.producto_id,
        'salida',
        NEW.cantidad,
        p.stock,
        p.stock - NEW.cantidad,
        'Venta #' || NEW.id,
        NEW.usuario_id
    FROM productos p 
    WHERE p.id = NEW.producto_id;
    
    -- Actualizar stock del producto
    UPDATE productos 
    SET stock = stock - NEW.cantidad 
    WHERE id = NEW.producto_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para actualizar stock automáticamente
CREATE TRIGGER trigger_actualizar_stock_venta
    AFTER INSERT ON ventas
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_stock_venta();

-- 11. VISTA PARA REPORTES DE INVENTARIO
CREATE OR REPLACE VIEW vista_inventario_completo AS
SELECT 
    p.id,
    p.nombre,
    p.descripcion,
    p.precio,
    p.precio_usd,
    p.precio_cup,
    p.stock,
    c.nombre as categoria,
    s.nombre as subcategoria,
    p.fecha_ingreso,
    CASE 
        WHEN p.stock = 0 THEN 'Sin stock'
        WHEN p.stock <= 5 THEN 'Stock bajo'
        WHEN p.stock <= 20 THEN 'Stock medio'
        ELSE 'Stock alto'
    END as estado_stock
FROM productos p
LEFT JOIN categorias c ON p.categoria_id = c.id
LEFT JOIN subcategorias s ON p.subcategoria_id = s.id;

-- 12. VISTA PARA REPORTE DE VENTAS
CREATE OR REPLACE VIEW vista_ventas_detalle AS
SELECT 
    v.id,
    p.nombre as producto,
    v.cantidad,
    v.precio_unitario,
    v.precio_total,
    v.descuento,
    v.metodo_pago,
    u.username as vendedor,
    v.fecha,
    c.nombre as categoria
FROM ventas v
LEFT JOIN productos p ON v.producto_id = p.id
LEFT JOIN usuarios u ON v.usuario_id = u.id
LEFT JOIN categorias c ON p.categoria_id = c.id;

-- 13. LIMPIAR TABLA INVENTARIO ANTIGUA (COMENTADO POR SEGURIDAD)
 DROP TABLE inventario; -- Descomenta solo después de verificar que la migración fue exitosa

 -- Actualizar tabla de productos para coincidir con el Excel
ALTER TABLE productos 
ADD COLUMN IF NOT EXISTS oprecio_cup NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS pxg_cup NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS extracciones INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS defectuosos INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cantidad INTEGER DEFAULT 1;

-- Actualizar datos existentes si los hay
UPDATE productos 
SET cantidad = 1 
WHERE cantidad IS NULL;

-- Agregar índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_productos_stock ON productos(stock);
CREATE INDEX IF NOT EXISTS idx_productos_precio_usd ON productos(precio_usd);
CREATE INDEX IF NOT EXISTS idx_productos_precio_cup ON productos(precio_cup);

-- Función para calcular conversión automática USD a CUP
CREATE OR REPLACE FUNCTION actualizar_precio_cup()
RETURNS TRIGGER AS $$
BEGIN
    -- Si se actualiza precio_usd pero no precio_cup, calcular automáticamente
    IF NEW.precio_usd IS NOT NULL AND (NEW.precio_cup IS NULL OR NEW.precio_cup = 0) THEN
        NEW.precio_cup = NEW.precio_usd * 395; -- Tasa de cambio aproximada
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para conversión automática
DROP TRIGGER IF EXISTS trigger_actualizar_precio_cup ON productos;
CREATE TRIGGER trigger_actualizar_precio_cup
    BEFORE INSERT OR UPDATE ON productos
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_precio_cup();

-- Vista mejorada para inventario completo
CREATE OR REPLACE VIEW vista_inventario_excel AS
SELECT 
    p.id,
    p.stock,
    p.nombre as producto,
    p.cantidad,
    COALESCE(p.precio_usd, 0) as precio_venta_usd,
    COALESCE(p.precio_cup, 0) as precio_venta_cup,
    COALESCE(p.oprecio_cup, 0) as oprecio_cup,
    COALESCE(p.pxg_cup, 0) as pxg_cup,
    COALESCE(p.extracciones, 0) as extracciones,
    COALESCE(p.defectuosos, 0) as defectuosos,
    c.nombre as categoria,
    s.nombre as subcategoria,
    p.descripcion,
    p.fecha_ingreso,
    CASE 
        WHEN p.stock = 0 THEN 'Sin stock'
        WHEN p.stock <= 5 THEN 'Stock bajo'
        WHEN p.stock <= 20 THEN 'Stock medio'
        ELSE 'Stock alto'
    END as estado_stock
FROM productos p
LEFT JOIN categorias c ON p.categoria_id = c.id
LEFT JOIN subcategorias s ON p.subcategoria_id = s.id
ORDER BY p.nombre;

-- Función para ocultar/mostrar productos sin stock
CREATE OR REPLACE FUNCTION filtrar_productos_stock(mostrar_sin_stock BOOLEAN DEFAULT TRUE)
RETURNS TABLE (
    id INTEGER,
    stock INTEGER,
    producto VARCHAR,
    cantidad INTEGER,
    precio_venta_usd NUMERIC,
    precio_venta_cup NUMERIC,
    oprecio_cup NUMERIC,
    pxg_cup NUMERIC,
    extracciones INTEGER,
    defectuosos INTEGER,
    categoria VARCHAR,
    subcategoria VARCHAR
) AS $$
BEGIN
    IF mostrar_sin_stock THEN
        RETURN QUERY SELECT * FROM vista_inventario_excel;
    ELSE
        RETURN QUERY SELECT * FROM vista_inventario_excel WHERE vista_inventario_excel.stock > 0;
    END IF;
END;
$$ LANGUAGE plpgsql;
CREATE TABLE IF NOT EXISTS currency_config (
    id SERIAL PRIMARY KEY,
    from_currency VARCHAR(3) NOT NULL,
    to_currency VARCHAR(3) NOT NULL,
    exchange_rate DECIMAL(10,4) NOT NULL,
    last_updated TIMESTAMP DEFAULT NOW(),
    created_by INT REFERENCES usuarios(id),
    UNIQUE(from_currency, to_currency)
);

INSERT INTO currency_config (from_currency, to_currency, exchange_rate) 
VALUES ('USD', 'CUP', 395.0)
ON CONFLICT (from_currency, to_currency) DO NOTHING;

ALTER TABLE productos 
ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMP DEFAULT NOW();
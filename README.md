# Sistema de Gestión de Inventario

Sistema completo de gestión de inventario desarrollado con Electron, Node.js y PostgreSQL.

## Características

- ✅ Gestión completa de inventario (productos, categorías, subcategorías)
- ✅ Sistema de usuarios con roles (admin/usuario)
- ✅ Edición en línea estilo Excel
- ✅ Seguimiento de movimientos de stock
- ✅ Registro de ventas
- ✅ Reportes y estadísticas
- ✅ Exportación a Excel/CSV
- ✅ Interfaz moderna y responsive

## Requisitos del Sistema

- Node.js >= 16.0.0
- PostgreSQL >= 12.0
- npm o yarn

## Instalación

1. Clonar el repositorio
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Copiar y configurar variables de entorno:
   ```bash
   cp .env.example .env
   ```
4. Editar `.env` con tus credenciales de base de datos
5. Ejecutar migraciones:
   ```bash
   npm run migrate
   ```
6. Cargar datos iniciales (opcional):
   ```bash
   npm run seed
   ```

## Uso

### Modo desarrollo:
```bash
npm run dev
```

### Modo producción:
```bash
npm start
```

## Estructura del Proyecto

```
├── config/          # Configuración de la aplicación
├── services/        # Lógica de negocio
├── middleware/      # Middleware de autenticación y validación
├── utils/           # Utilidades y helpers
├── public/          # Archivos del frontend
├── database/        # Schema y migraciones
└── logs/           # Archivos de log
```

## Configuración de Base de Datos

El sistema utiliza PostgreSQL. Asegúrate de tener una base de datos creada y las credenciales correctas en tu archivo `.env`.

## Scripts Disponibles

- `npm start` - Ejecutar en producción
- `npm run dev` - Ejecutar en desarrollo con nodemon
- `npm run migrate` - Ejecutar migraciones
- `npm run seed` - Cargar datos iniciales

## Tecnologías Utilizadas

- **Backend:** Node.js, Electron, PostgreSQL
- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Base de Datos:** PostgreSQL con extensión pgcrypto
- **Autenticación:** Sistema de sesiones con tokens

## Licencia

MIT
# Roles y Permisos - Documentación

## Descripción General

El sistema de roles y permisos permite a los administradores crear y gestionar roles personalizados con permisos específicos para controlar el acceso a diferentes partes del panel de administración.

## Características

- ✅ Crear, editar y eliminar roles personalizados
- ✅ Asignar permisos granulares a cada rol
- ✅ Roles del sistema protegidos (no se pueden modificar ni eliminar)
- ✅ Visualización de cantidad de usuarios por rol
- ✅ Interfaz multiidioma (Español/Inglés)
- ✅ Validación de datos con Zod
- ✅ Protección CSRF en todas las operaciones

## Estructura de la Base de Datos

### Tabla `roles`

```sql
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  is_system_role BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
```

### Columna adicional en `profiles`

```sql
ALTER TABLE public.profiles ADD COLUMN role_id UUID REFERENCES public.roles(id);
```

## Permisos Disponibles

| Permiso | Descripción |
|---------|-------------|
| `access_admin_panel` | Permite acceder al panel de administración (permiso base requerido para cualquier admin) |
| `view_dashboard` | Ver el panel de administración (widgets, métricas básicas) |
| `manage_users` | Gestionar usuarios (crear, editar, suspender, impersonar) |
| `manage_products` | Gestionar productos |
| `manage_orders` | Gestionar pedidos (ventas, estado de órdenes, bodega) |
| `manage_payments` | Gestionar pagos (retiros, abonos, conciliaciones) |
| `manage_plans` | Gestionar planes de suscripción |
| `manage_content` | Gestionar contenido del sitio (páginas, videos, tutoriales, mensajes, SEO) |
| `manage_settings` | Gestionar configuración de la aplicación (app settings, límites, configuración de contacto) |
| `view_reports` | Ver reportes y estadísticas |
| `manage_security` | Gestionar seguridad (IP whitelist/blacklist, CAPTCHA, agentes de confianza, rotación de secretos) |
| `manage_roles` | Gestionar roles y permisos (crear/editar/eliminar roles) |
| `view_audit_logs` | Ver los logs de auditoría del sistema (actividad de usuarios/admins) |

## Roles del Sistema

El sistema incluye 2 roles predefinidos que no se pueden modificar ni eliminar:

1. **Super Admin**: Acceso completo a todas las funcionalidades críticas del panel (todos los permisos). Siempre tiene `access_admin_panel`.
2. **Member**: Rol por defecto para usuarios normales de la aplicación. **No es admin** porque no tiene `access_admin_panel`; sólo tiene `view_dashboard` (puede ver su propio dashboard de usuario, pero no entrar al panel admin).

### Roles recomendados (no de sistema)

Los siguientes roles son sugerencias de configuración que puedes crear desde `/admin/roles` combinando los permisos anteriores:

- **Admin Operaciones**
  Permisos: `access_admin_panel`, `view_dashboard`, `manage_products`, `manage_orders`, `view_reports`.

- **Admin Finanzas**
  Permisos: `access_admin_panel`, `view_dashboard`, `manage_payments`, `manage_plans`, `view_reports`.

- **Admin Contenido / Marketing**
  Permisos: `access_admin_panel`, `view_dashboard`, `manage_content`.

- **Admin Soporte**
  Permisos: `access_admin_panel`, `view_dashboard`, `manage_users`.

- **Admin Configuración**
  Permisos: `access_admin_panel`, `view_dashboard`, `manage_settings`.

- **Admin Seguridad**
  Permisos: `access_admin_panel`, `view_dashboard`, `manage_security`, `view_audit_logs`.

- **Auditor / Compliance**
  Permisos: `access_admin_panel`, `view_dashboard`, `view_reports`, `view_audit_logs`.

## Rutas y Páginas

### Páginas del Admin

- `/admin/roles` - Lista de todos los roles
- `/admin/roles/new` - Crear nuevo rol
- `/admin/roles/edit/[id]` - Editar rol existente

### API Endpoints

- `GET /api/admin/roles` - Obtener todos los roles
- `POST /api/admin/roles` - Crear nuevo rol
- `GET /api/admin/roles/[id]` - Obtener rol por ID
- `PUT /api/admin/roles/[id]` - Actualizar rol
- `DELETE /api/admin/roles/[id]` - Eliminar rol

## Componentes

### `RoleForm`
Componente reutilizable para crear y editar roles. Incluye:
- Campo de nombre
- Campo de descripción
- Checkboxes para seleccionar permisos
- Validación en tiempo real

### `DeleteRoleButton`
Componente para eliminar roles con confirmación mediante AlertDialog.

## Servicios

### `role-service.ts`

Funciones disponibles:
- `getAllRoles()` - Obtiene todos los roles con conteo de usuarios
- `getRoleById(id)` - Obtiene un rol específico
- `createRole(input)` - Crea un nuevo rol
- `updateRole(id, input)` - Actualiza un rol existente
- `deleteRole(id)` - Elimina un rol

## Validación

Todos los datos se validan usando Zod schemas:

```typescript
const CreateRoleSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  permissions: z.array(PermissionSchema).min(1),
});
```

## Seguridad

- ✅ Todas las rutas requieren autenticación de administrador
- ✅ RLS (Row Level Security) habilitado en la tabla `roles`
- ✅ Los roles del sistema están protegidos contra modificación
- ✅ No se pueden eliminar roles con usuarios asignados
- ✅ Validación de permisos en el backend

## Migración

Para aplicar la migración de la base de datos:

```bash
# Ejecutar en Supabase SQL Editor
psql -f docs/migrations/20250116_create_roles_table.sql
```

O copiar y pegar el contenido del archivo en el SQL Editor de Supabase.

## Uso

### Crear un nuevo rol

1. Ir a `/admin/roles`
2. Hacer clic en "Crear Rol"
3. Completar el formulario:
   - Nombre del rol
   - Descripción (opcional)
   - Seleccionar permisos
4. Guardar

### Editar un rol

1. Ir a `/admin/roles`
2. Hacer clic en el menú de acciones (⋮) del rol
3. Seleccionar "Editar Rol"
4. Modificar los campos necesarios
5. Guardar

### Eliminar un rol

1. Ir a `/admin/roles`
2. Hacer clic en el menú de acciones (⋮) del rol
3. Seleccionar "Eliminar Rol"
4. Confirmar la eliminación

**Nota**: No se pueden eliminar roles del sistema ni roles con usuarios asignados.

## Próximos Pasos

Para implementar completamente el sistema de permisos:

1. Actualizar `AdminGuard` para verificar permisos específicos
2. Crear middleware para verificar permisos en rutas API
3. Agregar verificación de permisos en componentes del admin
4. Implementar asignación de roles a usuarios en la página de edición de usuarios

## Soporte

Para más información, consultar:
- `src/lib/models/role.ts` - Definiciones de tipos y schemas
- `src/lib/services/role-service.ts` - Lógica de negocio
- `docs/admin-guide.md` - Guía general del admin


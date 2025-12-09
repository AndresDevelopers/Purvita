# Página de Registros de Auditoría del Admin

## 📋 Descripción

La página de Registros de Auditoría (`/admin/audit-logs`) proporciona una interfaz completa para visualizar y analizar todas las actividades del sistema y acciones administrativas. Esta herramienta es esencial para:

- **Seguridad**: Rastrear acciones sospechosas o no autorizadas
- **Cumplimiento**: Mantener registros de auditoría para regulaciones (GDPR, SOC 2, etc.)
- **Debugging**: Investigar problemas y entender el flujo de eventos
- **Accountability**: Saber quién hizo qué, cuándo y desde dónde

## 🔐 Seguridad

### Control de Acceso

- **Permiso requerido**: `view_audit_logs`
- **Verificación**: Middleware de autenticación admin + verificación de permisos RBAC
- **IP Whitelist**: Aplica la lista blanca de IPs para rutas admin
- **Encriptación de IPs**: Las direcciones IP se almacenan encriptadas (AES-256-GCM)

### Protección de Datos

- **IPs encriptadas por defecto**: Las direcciones IP se muestran como `[ENCRYPTED]` a menos que se active la opción de desencriptado
- **Desencriptado controlado**: Solo usuarios con el permiso `view_audit_logs` pueden desencriptar IPs
- **Cumplimiento GDPR/CCPA**: Sistema de encriptación cumple con regulaciones de privacidad

## 🎯 Características

### Filtros Avanzados

1. **Búsqueda de texto**: Busca en acciones y tipos de entidad
2. **Filtro por acción**: Filtra por acciones específicas (ej: `PRODUCT_CREATED`, `USER_UPDATED`)
3. **Filtro por tipo de entidad**: Filtra por tipo (ej: `product`, `user`, `payment`)
4. **Rango de fechas**: Filtra por fecha de inicio y fin
5. **Desencriptado de IPs**: Opción para ver IPs desencriptadas

### Tabla de Datos

La tabla muestra:
- **Fecha/Hora**: Timestamp formateado con zona horaria
- **Usuario**: Nombre y email del usuario que realizó la acción (o "Sistema" si fue automático)
- **Acción**: Tipo de acción realizada (con badge de color)
- **Entidad**: Tipo de entidad y su ID
- **Estado**: Estado de la operación (success, failure, pending)
- **IP**: Dirección IP (encriptada o desencriptada)
- **Detalles**: Metadata adicional en formato JSON expandible

### Paginación

- **Registros por página**: 50 (configurable)
- **Navegación**: Botones anterior/siguiente
- **Contador**: Muestra rango actual y total de registros

## 🚀 Uso

### Acceso

1. Navega a `/admin/audit-logs` en el panel de administración
2. El sistema verificará automáticamente:
   - Autenticación de usuario
   - Permiso `view_audit_logs`
   - IP en lista blanca

### Búsqueda y Filtrado

1. **Búsqueda rápida**: Usa el campo de búsqueda para encontrar acciones o tipos específicos
2. **Filtros específicos**: Completa los campos de filtro según necesites
3. **Aplicar filtros**: Haz clic en "Aplicar Filtros"
4. **Limpiar filtros**: Usa "Limpiar Filtros" para resetear

### Ver Detalles

- Haz clic en "Ver metadata" en la columna de Detalles para expandir el JSON con información adicional
- La metadata puede incluir:
  - Campos modificados
  - Valores anteriores y nuevos
  - Información de contexto
  - Datos de la solicitud

### Desencriptar IPs

1. Marca la casilla "Desencriptar IPs"
2. Aplica los filtros
3. Las IPs se mostrarán en texto plano en lugar de `[ENCRYPTED]`

**⚠️ Nota**: Solo usa esta función cuando sea necesario para investigaciones de seguridad.

## 📊 API Endpoint

### GET `/api/admin/audit-logs`

**Parámetros de consulta**:
- `page` (number): Número de página (default: 1)
- `limit` (number): Registros por página (default: 50, max: 100)
- `action` (string): Filtrar por acción específica
- `entity_type` (string): Filtrar por tipo de entidad
- `user_id` (string): Filtrar por ID de usuario
- `search` (string): Búsqueda de texto
- `start_date` (ISO datetime): Fecha de inicio
- `end_date` (ISO datetime): Fecha de fin
- `decrypt_ips` (boolean): Desencriptar IPs (default: false)

**Respuesta**:
```json
{
  "logs": [
    {
      "id": "uuid",
      "action": "PRODUCT_CREATED",
      "entity_type": "product",
      "entity_id": "product-uuid",
      "user_id": "user-uuid",
      "ip_address": "[ENCRYPTED]",
      "user_agent": "Mozilla/5.0...",
      "status": "success",
      "metadata": {},
      "created_at": "2025-01-17T10:30:00Z",
      "profiles": {
        "id": "user-uuid",
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "totalPages": 3
  }
}
```

## 🔧 Configuración

### Agregar el Permiso al Rol

Ejecuta la migración SQL:

```bash
psql -h your-db-host -U your-user -d your-database -f docs/database/migrations/add_view_audit_logs_permission.sql
```

O ejecuta manualmente en Supabase SQL Editor:

```sql
UPDATE public.roles
SET permissions = array_append(permissions, 'view_audit_logs')
WHERE name = 'Super Admin' AND is_system_role = true;
```

## 📝 Tipos de Acciones Comunes

- `PRODUCT_CREATED`, `PRODUCT_UPDATED`, `PRODUCT_DELETED`
- `USER_CREATED`, `USER_UPDATED`, `USER_SUSPENDED`
- `ORDER_CREATED`, `ORDER_UPDATED`, `ORDER_CANCELED`
- `PAYMENT_CREATED`, `PAYMENT_COMPLETED`, `PAYMENT_FAILED`
- `ADMIN_ACCESS`, `ADMIN_IMPERSONATE_USER`
- `SETTINGS_CHANGED`, `USER_ROLE_CHANGED`
- `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`

## 🎨 Personalización

### Modificar Límite de Registros

En `src/app/api/admin/audit-logs/route.ts`:

```typescript
const QuerySchema = z.object({
  // ...
  limit: z.coerce.number().int().min(1).max(200).default(100), // Cambiar max
});
```

### Agregar Nuevos Filtros

1. Actualiza el schema de validación en la API
2. Agrega el campo de filtro en el componente de página
3. Actualiza la lógica de construcción de query en la API

## 🐛 Troubleshooting

### No se muestran registros

1. Verifica que tienes el permiso `view_audit_logs`
2. Revisa los filtros aplicados
3. Verifica la conexión a la base de datos

### Error de permisos

- Asegúrate de que tu rol tiene el permiso `view_audit_logs`
- Verifica que tu IP está en la lista blanca de admin

### IPs no se desencriptan

- Verifica que la variable de entorno `IP_ENCRYPTION_KEY` está configurada
- Revisa los logs del servidor para errores de desencriptación


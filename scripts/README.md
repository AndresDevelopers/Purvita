# 📜 Scripts de Utilidad - PūrVita Network

Esta carpeta contiene scripts de utilidad para desarrollo, diagnóstico, testing y mantenimiento del proyecto.

## 📑 Índice

- [Generadores](#-generadores)
- [Diagnóstico](#-diagnóstico)
- [Testing](#-testing)
- [Seguridad](#-seguridad)
- [Deployment](#-deployment)

---

## 🎨 Generadores

### `setup-bypass-route.js`
Genera automáticamente la ruta física del admin bypass basándose en `NEXT_PUBLIC_ADMIN_BYPASS_URL`.

**Uso:**
```bash
npm run setup-bypass
```

**Qué hace:**
1. ✅ Lee la URL configurada en `NEXT_PUBLIC_ADMIN_BYPASS_URL`
2. 🗑️ Elimina automáticamente las carpetas de bypass antiguas
3. ✅ Crea la nueva carpeta con la URL configurada
4. ✅ Genera el archivo `page.tsx` con la lógica de validación

**Ejemplo de salida:**
```
🔍 Buscando rutas de bypass antiguas...
🗑️  Eliminando ruta antigua: aadmin
✅ Eliminadas 1 ruta(s) de bypass antigua(s)

✅ Created directory: src/app/[lang]/super-secret-2024
✅ Created file: src/app/[lang]/super-secret-2024/page.tsx

🎉 Admin bypass route configured for: /super-secret-2024
   Access it at: http://localhost:9001/es/super-secret-2024
   Redirects to: /admin/login?lang=es
```

**Cuándo ejecutar:**
- Cada vez que cambies `NEXT_PUBLIC_ADMIN_BYPASS_URL` en `.env.local`
- Siempre reinicia el servidor después de ejecutar

**Documentación completa:** [docs/dynamic-admin-urls.md](../docs/dynamic-admin-urls.md)

---

### `add-language.ts`
Genera automáticamente archivos de idioma para el sistema i18n.

**Uso:**
```bash
npm run add-language -- --code fr --name "Français"
npm run add-language -- --code pt --name "Português" --auto-translate
```

**Características:**
- Crea archivo de traducciones con estructura base
- Actualiza índice automáticamente
- Genera recordatorios para agregar bandera
- Proporciona guía de próximos pasos

**Archivos generados:**
- `src/i18n/dictionaries/locales/{code}.ts`
- Actualiza `src/i18n/dictionaries/locales/index.ts`

---

### `add-payment-provider.ts`
Genera estructura completa para integrar nuevos proveedores de pago.

**Uso:**
```bash
npm run add-payment -- --name mercadopago --display "Mercado Pago"
npm run add-payment -- --name square --display "Square"
```

**Características:**
- Crea servicio de pago con plantilla
- Genera rutas API (create-order)
- Crea webhook con validación de firma
- Incluye TODOs para implementación

**Archivos generados:**
- `src/modules/payments/services/payment-providers/{name}-service.ts`
- `src/app/api/payments/{name}/create-order/route.ts`
- `src/app/api/webhooks/{name}/route.ts`

**Pasos manuales requeridos:**
1. Actualizar schema de proveedores en `payment-gateway.ts`
2. Registrar en Payment Provider Factory
3. Actualizar tipos de credenciales
4. Agregar registro en base de datos

---

### `add-registration-code.ts`
Agrega códigos de acceso para registro de usuarios.

**Uso:**
```bash
npx tsx scripts/add-registration-code.ts [código] [días-validez]
npx tsx scripts/add-registration-code.ts PURVITA-2025 30
```

**Características:**
- Inserta código en tabla `registration_access_codes`
- Configura período de validez
- Requiere `SUPABASE_SERVICE_ROLE_KEY`

---

## 🔍 Diagnóstico

### `check-database-status.js`
Verifica existencia de tablas requeridas en la base de datos.

**Uso:**
```bash
node scripts/check-database-status.js
```

**Verifica:**
- Conexión a Supabase
- Existencia de tablas: `profiles`, `network_commissions`, `payout_accounts`, `payout_preferences`, `wallet`, `subscriptions`
- Proporciona guía de migraciones faltantes

**Códigos de salida:**
- `0`: Todas las tablas existen
- `1`: Error de conexión o variables faltantes
- `2`: Tablas faltantes

---

### `check-payment-status.ts`
Verifica estado de gateways de pago y variables de entorno.

**Uso:**
```bash
npx tsx scripts/check-payment-status.ts
```

**Verifica:**
- Estado de gateways en base de datos (PayPal, Stripe, Wallet)
- Variables de entorno para test y producción
- Modo y funcionalidad de cada gateway

---

### `check-redis-status.ts`
Verifica configuración y estado de Redis/Upstash.

**Uso:**
```bash
npx tsx scripts/check-redis-status.ts
```

**Muestra:**
- Estado de Redis (habilitado/deshabilitado)
- Variables de entorno configuradas
- Tipo de caché (Redis distribuido vs memoria local)
- Recomendaciones según entorno (dev/prod)

---

### `check-sponsor-capacity.ts`
Verifica si el sponsor de un usuario ha alcanzado su límite de capacidad.

**Uso:**
```bash
npx tsx scripts/check-sponsor-capacity.ts <user-id>
```

**Analiza:**
- Red del usuario y sponsor
- Suscripción y fase del sponsor
- Conteo de miembros directos del sponsor
- Límites de capacidad por fase
- Disponibilidad de slots

---

### `check-wallet-balance.ts`
Verifica balance de wallet de un usuario específico.

**Uso:**
```bash
npx tsx scripts/check-wallet-balance.ts
```

**Nota:** Actualmente tiene user-id hardcodeado. Considerar parametrizar.

---

### `diagnose-wallet-subscription.ts`
Diagnóstico completo de wallet y suscripciones de un usuario.

**Uso:**
```bash
npx tsx scripts/diagnose-wallet-subscription.ts <user-id>
```

**Analiza:**
- Perfil de usuario
- Balance de wallet
- Transacciones recientes (últimas 10)
- Planes de suscripción disponibles
- Estado de suscripción actual
- Configuración de payment gateways
- Recomendaciones personalizadas

**Reporte incluye:**
- Capacidad de pago con balance actual
- Fondos adicionales necesarios
- Guía de recarga de wallet

---

### `check-orders-and-tracking.ts`
Verifica órdenes y sistema de tracking de almacén.

**Uso:**
```bash
npx tsx scripts/check-orders-and-tracking.ts
```

**Verifica:**
- Tabla `orders` y datos
- Tabla `warehouse_tracking_entries`
- Vista `warehouse_tracking_admin_view`

---

## 🧪 Testing

### `test-api-call.js` ⭐ **MEJORADO**
Herramienta genérica para probar cualquier endpoint de API.

**Uso:**
```bash
# Básico
node scripts/test-api-call.js /api/profile/summary --user-id abc-123

# Con método POST y body
node scripts/test-api-call.js /api/products --method POST --body '{"name":"Test"}'

# Con headers personalizados
node scripts/test-api-call.js /api/data --header "Authorization:Bearer token"

# Con URL base personalizada
node scripts/test-api-call.js /api/health --base-url http://localhost:3000

# Con timeout personalizado
node scripts/test-api-call.js /api/slow --timeout 30000
```

**Opciones:**
- `--user-id <id>`: User ID para header x-user-id
- `--method <method>`: Método HTTP (GET, POST, PUT, DELETE, PATCH)
- `--body <json>`: Cuerpo de la petición como JSON
- `--header <key:val>`: Headers adicionales (repetible)
- `--base-url <url>`: URL base del servidor
- `--timeout <ms>`: Timeout en milisegundos

**Características:**
- Validación de argumentos
- Medición de tiempo de respuesta
- Análisis de errores con sugerencias
- Soporte para múltiples métodos HTTP
- Headers personalizables
- Truncado inteligente de respuestas largas

---

### `test-tree-api.js` ⭐ **MEJORADO**
Prueba el endpoint `/api/tree` para verificar estructura MLM.

**Uso:**
```bash
# Básico
node scripts/test-tree-api.js <user-id>

# Modo verbose (información detallada)
node scripts/test-tree-api.js abc-123 --verbose

# Salida JSON cruda
node scripts/test-tree-api.js abc-123 --json

# URL personalizada
node scripts/test-tree-api.js abc-123 --base-url http://localhost:3000
```

**Opciones:**
- `--base-url <url>`: URL base del servidor
- `--timeout <ms>`: Timeout en milisegundos
- `--verbose`: Mostrar información detallada de cada miembro
- `--json`: Mostrar respuesta JSON sin formato

**Muestra:**
- Estadísticas generales del árbol
- Estructura por niveles
- Conteo de miembros por nivel
- Estado de suscripciones
- Información detallada en modo verbose

---

### `test-redis-connection.ts`
Suite completa de tests para verificar conexión y operaciones de Redis.

**Uso:**
```bash
npx tsx scripts/test-redis-connection.ts
```

**Tests incluidos:**
1. Set - Guardar valor en caché
2. Get - Obtener valor de caché
3. Exists - Verificar existencia de clave
4. TTL - Verificar tiempo de vida
5. Increment - Incrementar contador
6. Delete - Eliminar valores
7. Get-or-Set - Patrón de caché con fallback
8. CacheKeys - Generadores de claves

**Requiere:**
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

---

### `test-dashboard-metrics.ts`
Prueba la función RPC `admin_dashboard_metrics_extended`.

**Uso:**
```bash
npx tsx scripts/test-dashboard-metrics.ts
```

**Verifica:**
- Ejecución de función RPC
- Datos de métricas del dashboard admin
- Formato de respuesta

---

### `test-cache-headers.ps1` / `test-cache-headers.sh`
Verifica headers de caché en producción.

**Uso:**
```bash
# PowerShell
.\scripts\test-cache-headers.ps1 [domain]

# Bash
./scripts/test-cache-headers.sh [domain]
```

**Verifica:**
- Páginas dinámicas (no deben cachear)
- Páginas públicas (cache corto)
- Assets estáticos (cache largo)
- APIs públicas
- Estado de caché de Cloudflare

---

## 🔒 Seguridad

### `security-check.sh`
Suite completa de verificaciones de seguridad.

**Uso:**
```bash
./scripts/security-check.sh
```

**Verificaciones:**
1. ✅ .env files no están en Git
2. ✅ .env files están en .gitignore
3. ✅ No hay secretos hardcodeados
4. ✅ npm audit (vulnerabilidades)
5. ✅ No hay console.log con datos sensibles
6. ✅ Protección CSRF en endpoints
7. ✅ Autenticación en endpoints admin
8. ✅ Variables de entorno requeridas

**Códigos de salida:**
- `0`: Todas las verificaciones pasaron
- `1`: Fallos críticos encontrados

---

### `check-dependencies.js`
Verifica vulnerabilidades y paquetes desactualizados.

**Uso:**
```bash
node scripts/check-dependencies.js
```

**Verifica:**
- Vulnerabilidades conocidas
- Paquetes desactualizados (>2 años)
- Ejecuta npm audit si está disponible

**Recomendaciones:**
- Comandos para actualizar
- Uso de dependabot
- Revisión de licencias

---

## 🚀 Deployment

### `deploy-edge-function.ps1`
Despliega Edge Functions de Supabase (PowerShell).

**Uso:**
```bash
.\scripts\deploy-edge-function.ps1
```

**Características:**
- Verifica instalación de Supabase CLI
- Valida link al proyecto
- Despliega función `registration-access-code`
- Opción para ver logs en tiempo real

**Requiere:**
- Supabase CLI instalado
- Proyecto linkeado con `supabase link`

---

## 📝 Notas Generales

### Variables de Entorno Requeridas

La mayoría de scripts requieren estas variables en `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Redis (opcional, solo para scripts de Redis)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# Base URL (opcional)
BASE_URL=http://localhost:9002
```

### Convenciones

- Scripts TypeScript: Usar `npx tsx scripts/nombre.ts`
- Scripts JavaScript: Usar `node scripts/nombre.js`
- Scripts Shell: Dar permisos de ejecución `chmod +x scripts/nombre.sh`

### Agregar al package.json

Considera agregar estos comandos npm para facilitar el uso:

```json
{
  "scripts": {
    "add-language": "tsx scripts/add-language.ts",
    "add-payment": "tsx scripts/add-payment-provider.ts",
    "check:db": "node scripts/check-database-status.js",
    "check:redis": "tsx scripts/check-redis-status.ts",
    "check:security": "bash scripts/security-check.sh",
    "test:api": "node scripts/test-api-call.js",
    "test:tree": "node scripts/test-tree-api.js",
    "test:redis": "tsx scripts/test-redis-connection.ts"
  }
}
```

---

## 🤝 Contribuir

Al crear nuevos scripts:

1. Agregar documentación clara en el header
2. Incluir ejemplos de uso
3. Validar argumentos de entrada
4. Proporcionar mensajes de error útiles
5. Actualizar este README
6. Considerar agregar comando npm en package.json

---

## 📚 Recursos Adicionales

- [Documentación del Proyecto](../docs/README.md)
- [Guía de Desarrollo](../docs/setup.md)
- [Arquitectura](../docs/architecture.md)
- [Sistema de Pagos](../docs/payment-system.md)

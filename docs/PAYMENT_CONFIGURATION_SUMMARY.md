# Resumen de Configuración de Pagos - Sistema Actualizado

## 🎯 Cambios Implementados

### 1. Interfaz Visual Mejorada en `/admin/pays`

La página `/admin/pays` ahora incluye:

#### **Pasarelas de Pago Externas**
- ✅ **PayPal** (Producción y Test/Sandbox)
  - Client ID, Client Secret, Webhook Secret, Connect Client ID
  - Tabs separadas para Producción y Test
  - Switch para activar/desactivar
  - Badge de modo (Producción/Test)
  
- ✅ **Stripe** (Producción y Test)
  - Publishable Key, Secret Key, Webhook Secret, Connect Client ID
  - Tabs separadas para Producción y Test
  - Switch para activar/desactivar
  - Badge de modo (Producción/Test)

#### **Métodos de Pago Internos**
- ✅ **Wallet (Billetera Interna)**
  - Switch para activar/desactivar
  - No requiere credenciales externas
  - Siempre disponible
  
- ✅ **Depósito Manual**
  - Botón para configurar métodos (USDT, Bitcoin, Transferencia Bancaria, etc.)
  - Redirige a `/admin/payment-wallets`
  - Gestión de múltiples métodos de depósito

### 2. Gestión de Credenciales

#### **Almacenamiento Seguro**
- Todas las credenciales se almacenan **encriptadas** en la base de datos
- Encriptación AES-256-GCM con salt e IV únicos
- Clave maestra: `CREDENTIALS_ENCRYPTION_KEY` (64 caracteres hex)

#### **Configuración desde Panel de Admin**
- No requiere acceso al servidor
- No requiere redeploy
- Cambios en tiempo real
- Auditoría completa de cambios

#### **Soporte para Múltiples Ambientes**
- Credenciales separadas para Producción y Test/Sandbox
- Cambio de modo sin reconfigurar credenciales
- Pruebas sin afectar producción

### 3. Variables de Entorno Actualizadas

#### **Variables Requeridas (MANTENER)**
```env
# Encriptación de credenciales (CRÍTICO)
CREDENTIALS_ENCRYPTION_KEY=tu_clave_de_64_caracteres_hex

# Firma de custom IDs de PayPal (CRÍTICO)
CUSTOM_ID_SECRET=tu_secret_de_64_caracteres_hex

# Verificación de webhooks de PayPal (OPCIONAL pero recomendado)
PAYPAL_WEBHOOK_ID=tu_webhook_id
```

#### **Variables Deprecadas (ELIMINAR después de migrar)**
```env
# Estas se configuran desde /admin/pays
# STRIPE_SECRET_KEY=sk_xxx
# STRIPE_WEBHOOK_SECRET=whsec_xxx
# PAYPAL_CLIENT_ID=xxx
# PAYPAL_CLIENT_SECRET=xxx
```

### 4. Script de Migración SQL

**Ubicación**: `docs/database/migrations/migrate-payment-credentials-from-env.sql`

**Funciones**:
- Limpia credenciales antiguas de `payment_gateways`
- Prepara la estructura para nueva configuración
- Crea audit log de la migración
- Incluye queries de verificación

**Uso**:
```sql
-- Ejecutar en la base de datos
\i docs/database/migrations/migrate-payment-credentials-from-env.sql
```

### 5. Documentación Completa

#### **Archivo `.env.example` Actualizado**
- Documentación completa de configuración de pagos
- Instrucciones de cómo obtener credenciales de PayPal y Stripe
- Explicación de modos Producción vs Test
- Notas de seguridad y mejores prácticas
- Marcado de variables deprecadas

#### **Guía de Migración**
**Ubicación**: `docs/payment-credentials-migration.md`

**Contenido**:
- Proceso paso a paso de migración
- Verificación de funcionamiento
- Rollback en caso de problemas
- Preguntas frecuentes
- Comparación antes/después

## 📋 Cómo Usar el Sistema

### Para Nuevos Despliegues

1. **Configurar variables de entorno básicas**:
   ```env
   CREDENTIALS_ENCRYPTION_KEY=<generar con: openssl rand -hex 32>
   CUSTOM_ID_SECRET=<generar con: openssl rand -hex 32>
   PAYPAL_WEBHOOK_ID=<opcional>
   ```

2. **Acceder al panel de administración**:
   - Ir a: `https://tu-dominio.com/admin/pays`

3. **Configurar métodos de pago**:
   - PayPal: Configurar credenciales de producción y/o test
   - Stripe: Configurar credenciales de producción y/o test
   - Wallet: Activar/desactivar según necesites
   - Depósito Manual: Configurar desde `/admin/payment-wallets`

4. **Activar métodos de pago**:
   - Usar el switch en cada tarjeta
   - Solo los métodos activos aparecen en el checkout

### Para Migrar desde Variables de Entorno

1. **Respaldar `.env` actual**:
   ```bash
   cp .env .env.backup
   ```

2. **Ejecutar script de migración**:
   ```sql
   \i docs/database/migrations/migrate-payment-credentials-from-env.sql
   ```

3. **Configurar credenciales desde `/admin/pays`**

4. **Verificar funcionamiento**

5. **Eliminar variables de entorno antiguas**

Ver guía completa en: `docs/payment-credentials-migration.md`

## 🔒 Seguridad

### Encriptación de Credenciales

```typescript
// Ejemplo de credencial encriptada en la base de datos
{
  "secret": "abc123:def456:ghi789:jkl012",  // salt:iv:authTag:ciphertext
  "clientId": "xxx",                         // Público
  "mode": "production"
}
```

### Niveles de Acceso

- **Administradores**: Ver y editar todas las credenciales
- **Usuarios**: Solo ven métodos de pago activos (sin credenciales)
- **APIs Públicas**: Solo exponen métodos activos y claves públicas

### Auditoría

Todos los cambios se registran en `audit_logs`:
```sql
SELECT action, metadata, created_at
FROM audit_logs
WHERE action LIKE '%PAYMENT%'
ORDER BY created_at DESC;
```

## 🎨 Componentes Creados

### `SimplePaymentMethodCard`
**Ubicación**: `src/modules/payments/views/simple-payment-method-card.tsx`

**Uso**: Tarjetas simples para Wallet y Depósito Manual

**Props**:
- `provider`: Tipo de método de pago
- `title`, `description`: Textos
- `onToggle`: Callback para activar/desactivar
- `configureHref`: Link a configuración adicional (opcional)

### `AdminPaymentSettingsController` (Actualizado)
**Ubicación**: `src/modules/payments/controllers/admin-payment-settings-controller.tsx`

**Cambios**:
- Sección "Pasarelas de Pago Externas" (PayPal, Stripe)
- Sección "Métodos de Pago Internos" (Wallet, Depósito Manual)
- Soporte para tarjetas simples
- Gestión de estado mejorada

## 📊 Estructura de Base de Datos

### Tabla `payment_gateways`

```sql
CREATE TABLE payment_gateways (
  id uuid PRIMARY KEY,
  provider text UNIQUE NOT NULL,  -- 'paypal', 'stripe', 'wallet'
  is_active boolean DEFAULT FALSE,
  credentials jsonb DEFAULT '{}',  -- Credenciales encriptadas
  created_at timestamptz,
  updated_at timestamptz
);
```

### Estructura de `credentials` (JSONB)

**PayPal**:
```json
{
  "clientId": "xxx",
  "secret": "encrypted:xxx",
  "webhookSecret": "encrypted:xxx",
  "connectClientId": "xxx",
  "testClientId": "xxx",
  "testSecret": "encrypted:xxx",
  "testWebhookSecret": "encrypted:xxx",
  "testConnectClientId": "xxx",
  "mode": "production"
}
```

**Stripe**:
```json
{
  "publishableKey": "pk_xxx",
  "secret": "encrypted:xxx",
  "webhookSecret": "encrypted:xxx",
  "connectClientId": "ca_xxx",
  "testPublishableKey": "pk_test_xxx",
  "testSecret": "encrypted:xxx",
  "testWebhookSecret": "encrypted:xxx",
  "testConnectClientId": "ca_test_xxx",
  "mode": "production"
}
```

**Wallet**:
```json
{
  "walletBalanceCents": 0
}
```

## 🚀 Próximos Pasos

1. **Ejecutar migración en desarrollo**:
   - Probar el script SQL
   - Configurar credenciales desde `/admin/pays`
   - Verificar que todo funciona

2. **Actualizar documentación de equipo**:
   - Informar sobre el nuevo proceso
   - Compartir guía de migración

3. **Planificar migración en producción**:
   - Elegir ventana de mantenimiento
   - Preparar rollback plan
   - Notificar a stakeholders

4. **Ejecutar migración en producción**:
   - Seguir guía paso a paso
   - Verificar funcionamiento
   - Monitorear logs

## 📚 Archivos Modificados/Creados

### Creados
- ✅ `src/modules/payments/views/simple-payment-method-card.tsx`
- ✅ `docs/database/migrations/migrate-payment-credentials-from-env.sql`
- ✅ `docs/payment-credentials-migration.md`
- ✅ `docs/PAYMENT_CONFIGURATION_SUMMARY.md`

### Modificados
- ✅ `.env.example` - Documentación completa de configuración
- ✅ `src/modules/payments/controllers/admin-payment-settings-controller.tsx` - Nuevas secciones
- ✅ `src/app/admin/pays/page.tsx` - Soporte para wallet y manual deposit
- ✅ `src/lib/env.ts` - Marcado de variables deprecadas

## ✅ Checklist de Implementación

- [x] Actualizar interfaz visual de `/admin/pays`
- [x] Agregar tarjetas para Wallet y Depósito Manual
- [x] Crear script SQL de migración
- [x] Marcar variables de entorno como deprecadas
- [x] Actualizar `.env.example` con documentación completa
- [x] Crear guía de migración completa
- [x] Documentar proceso de configuración
- [ ] Probar migración en desarrollo
- [ ] Ejecutar migración en producción
- [ ] Eliminar variables de entorno antiguas

## 🆘 Soporte

Para problemas o preguntas:
1. Revisar `docs/payment-credentials-migration.md`
2. Revisar logs de `audit_logs`
3. Verificar `CREDENTIALS_ENCRYPTION_KEY` está configurada
4. Hacer rollback si es necesario


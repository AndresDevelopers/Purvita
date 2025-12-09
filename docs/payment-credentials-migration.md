# Migración de Credenciales de Pago: Variables de Entorno → Base de Datos

## 📋 Resumen

Este documento describe el proceso de migración de credenciales de pago desde variables de entorno (`.env`) a la base de datos encriptada, donde se gestionan desde el panel de administración `/admin/pays`.

## 🎯 Objetivos

1. **Seguridad mejorada**: Credenciales encriptadas con AES-256 en la base de datos
2. **Gestión centralizada**: Configuración desde el panel de administración sin necesidad de redeploy
3. **Múltiples ambientes**: Soporte para credenciales de producción y test/sandbox simultáneamente
4. **Auditoría completa**: Registro de todos los cambios en `audit_logs`

## ⚠️ Antes de Comenzar

### Variables de Entorno Requeridas (NO ELIMINAR)

Estas variables **DEBEN** permanecer en tu `.env`:

```env
# CRÍTICO - Nunca eliminar
CREDENTIALS_ENCRYPTION_KEY=tu_clave_de_64_caracteres_hex
CUSTOM_ID_SECRET=tu_secret_de_64_caracteres_hex

# Opcional pero recomendado
PAYPAL_WEBHOOK_ID=tu_webhook_id_de_paypal
```

### Variables que se Migrarán (ELIMINAR después de migrar)

Estas variables se eliminarán después de la migración:

```env
# Estas se configurarán desde /admin/pays
STRIPE_SECRET_KEY=sk_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
PAYPAL_CLIENT_ID=xxx
PAYPAL_CLIENT_SECRET=xxx
```

## 📝 Proceso de Migración

### Paso 1: Preparación

1. **Respaldar credenciales actuales**:
   ```bash
   # Guardar una copia de tu .env actual
   cp .env .env.backup
   ```

2. **Verificar que tienes las claves de encriptación**:
   ```bash
   # Verificar que estas variables existen y tienen 64 caracteres
   grep CREDENTIALS_ENCRYPTION_KEY .env
   grep CUSTOM_ID_SECRET .env
   ```

   Si no existen, generarlas:
   ```bash
   # Generar CREDENTIALS_ENCRYPTION_KEY
   openssl rand -hex 32
   
   # Generar CUSTOM_ID_SECRET
   openssl rand -hex 32
   ```

### Paso 2: Ejecutar Script de Migración

1. **Conectarse a la base de datos**:
   ```bash
   # Usando psql
   psql -h tu-host -U tu-usuario -d tu-database
   
   # O desde Supabase Dashboard: SQL Editor
   ```

2. **Ejecutar el script de migración**:
   ```sql
   -- Copiar y pegar el contenido de:
   -- docs/database/migrations/migrate-payment-credentials-from-env.sql
   ```

3. **Verificar que la migración fue exitosa**:
   ```sql
   -- Ver estado de payment_gateways
   SELECT provider, is_active, credentials->>'mode' as mode
   FROM public.payment_gateways
   ORDER BY provider;
   ```

### Paso 3: Configurar Credenciales desde el Panel

1. **Acceder al panel de administración**:
   - Ir a: `https://tu-dominio.com/admin/pays`
   - Iniciar sesión como administrador

2. **Configurar PayPal** (si lo usas):
   
   **Producción**:
   - Client ID: `tu_client_id_de_produccion`
   - Client Secret: `tu_client_secret_de_produccion`
   - Webhook Secret: `tu_webhook_secret` (opcional)
   - Connect Client ID: `tu_connect_client_id` (opcional, para PayPal Connect)
   - Modo: Seleccionar "Producción"
   - Estado: Activar switch
   - Guardar

   **Test/Sandbox**:
   - Client ID (Test): `tu_client_id_de_sandbox`
   - Client Secret (Test): `tu_client_secret_de_sandbox`
   - Webhook Secret (Test): `tu_webhook_secret_test` (opcional)
   - Connect Client ID (Test): `tu_connect_client_id_test` (opcional)
   - Modo: Seleccionar "Test"
   - Guardar

3. **Configurar Stripe** (si lo usas):
   
   **Producción**:
   - Publishable Key: `pk_live_xxx`
   - Secret Key: `sk_live_xxx`
   - Webhook Secret: `whsec_xxx` (opcional)
   - Connect Client ID: `ca_xxx` (opcional, para Stripe Connect)
   - Modo: Seleccionar "Producción"
   - Estado: Activar switch
   - Guardar

   **Test**:
   - Publishable Key (Test): `pk_test_xxx`
   - Secret Key (Test): `sk_test_xxx`
   - Webhook Secret (Test): `whsec_test_xxx` (opcional)
   - Connect Client ID (Test): `ca_test_xxx` (opcional)
   - Modo: Seleccionar "Test"
   - Guardar

4. **Configurar Wallet** (billetera interna):
   - Activar/desactivar según necesites
   - No requiere credenciales externas

5. **Configurar Depósito Manual** (opcional):
   - Click en "Configurar Métodos"
   - Ir a `/admin/payment-wallets`
   - Configurar métodos: USDT, Bitcoin, Transferencia Bancaria, etc.

### Paso 4: Verificar Funcionamiento

1. **Probar checkout con PayPal**:
   - Crear una orden de prueba
   - Verificar que el checkout de PayPal funciona
   - Verificar que los webhooks se reciben correctamente

2. **Probar checkout con Stripe**:
   - Crear una orden de prueba
   - Verificar que el checkout de Stripe funciona
   - Verificar que los webhooks se reciben correctamente

3. **Revisar logs de auditoría**:
   ```sql
   SELECT action, metadata, created_at
   FROM public.audit_logs
   WHERE action LIKE '%PAYMENT%'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

### Paso 5: Limpiar Variables de Entorno

1. **Editar `.env` y eliminar**:
   ```env
   # ELIMINAR estas líneas:
   # STRIPE_SECRET_KEY=sk_xxx
   # STRIPE_WEBHOOK_SECRET=whsec_xxx
   # PAYPAL_CLIENT_ID=xxx
   # PAYPAL_CLIENT_SECRET=xxx
   ```

2. **Mantener estas variables**:
   ```env
   # MANTENER - Son críticas:
   CREDENTIALS_ENCRYPTION_KEY=tu_clave_de_64_caracteres_hex
   CUSTOM_ID_SECRET=tu_secret_de_64_caracteres_hex
   PAYPAL_WEBHOOK_ID=tu_webhook_id_de_paypal
   ```

3. **Si usas plataforma de hosting** (Vercel, Railway, etc.):
   - Eliminar las variables de entorno de pago de la configuración
   - Mantener `CREDENTIALS_ENCRYPTION_KEY` y `CUSTOM_ID_SECRET`

### Paso 6: Desplegar en Producción

1. **Ejecutar el script de migración en producción**
2. **Configurar credenciales desde `/admin/pays`**
3. **Eliminar variables de entorno de la plataforma**
4. **Verificar que todo funciona correctamente**

## 🔄 Rollback (En Caso de Problemas)

Si necesitas revertir la migración:

1. **Restaurar variables de entorno**:
   ```bash
   # Restaurar desde el backup
   cp .env.backup .env
   ```

2. **El sistema automáticamente usará las variables de entorno como fallback**
   - No es necesario ejecutar ningún script SQL
   - Los servicios detectan automáticamente si no hay credenciales en la base de datos

3. **Reconfigurar en la plataforma de hosting** (si es necesario)

## 📊 Comparación: Antes vs Después

### Antes (Variables de Entorno)

```env
# .env
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
PAYPAL_CLIENT_ID=xxx
PAYPAL_CLIENT_SECRET=xxx
```

**Desventajas**:
- ❌ Credenciales en texto plano
- ❌ Requiere redeploy para cambiar credenciales
- ❌ No soporta múltiples ambientes (prod/test) simultáneamente
- ❌ Sin auditoría de cambios
- ❌ Difícil de gestionar en equipos

### Después (Base de Datos Encriptada)

**Ventajas**:
- ✅ Credenciales encriptadas con AES-256
- ✅ Cambios sin redeploy desde `/admin/pays`
- ✅ Soporte para prod y test simultáneamente
- ✅ Auditoría completa en `audit_logs`
- ✅ Gestión visual desde el panel de admin
- ✅ Activación/desactivación de métodos en tiempo real

## 🔒 Seguridad

### Encriptación

- **Algoritmo**: AES-256-GCM
- **Clave**: `CREDENTIALS_ENCRYPTION_KEY` (32 bytes)
- **Salt único**: Generado para cada credencial
- **IV único**: Generado para cada operación de encriptación
- **Auth Tag**: Verificación de integridad

### Almacenamiento

```sql
-- Estructura en payment_gateways
{
  "secret": "salt:iv:authTag:ciphertext",  -- Encriptado
  "clientId": "xxx",                        -- Público
  "mode": "production"                      -- Configuración
}
```

### Acceso

- Solo administradores pueden ver/editar credenciales
- Las credenciales nunca se exponen en APIs públicas
- Los usuarios solo ven métodos de pago activos, no las credenciales

## 📚 Referencias

- [Documentación de Encriptación](./security/credentials-encryption.md)
- [Configuración de Pagos](./payment-system.md)
- [Variables de Entorno](./environment-variables.md)
- [Script de Migración SQL](./database/migrations/migrate-payment-credentials-from-env.sql)

## ❓ Preguntas Frecuentes

### ¿Puedo usar variables de entorno y base de datos al mismo tiempo?

Sí, el sistema usa este orden de prioridad:
1. Credenciales de la base de datos (si existen)
2. Variables de entorno (como fallback)

Sin embargo, **no es recomendado** para producción. Usa solo base de datos.

### ¿Qué pasa si pierdo la CREDENTIALS_ENCRYPTION_KEY?

⚠️ **CRÍTICO**: Si pierdes esta clave, **perderás acceso a todas las credenciales encriptadas**.

**Prevención**:
- Respaldar en 1Password, AWS Secrets Manager, o similar
- Nunca commitear al repositorio
- Documentar en lugar seguro

**Recuperación**:
- No hay forma de recuperar credenciales sin la clave
- Deberás reconfigurar todas las credenciales desde `/admin/pays`

### ¿Cómo cambio entre modo producción y test?

Desde `/admin/pays`:
1. Configurar credenciales en ambas tabs (Producción y Test)
2. Cambiar el modo desde el badge en la tarjeta
3. Guardar

El sistema usará automáticamente las credenciales del modo seleccionado.

### ¿Los webhooks siguen funcionando después de la migración?

Sí, los webhooks funcionan igual. Solo asegúrate de:
- Configurar `PAYPAL_WEBHOOK_ID` en `.env` (opcional pero recomendado)
- Configurar Webhook Secrets desde `/admin/pays`

## 🆘 Soporte

Si encuentras problemas durante la migración:

1. Revisar logs de la aplicación
2. Revisar `audit_logs` en la base de datos
3. Verificar que `CREDENTIALS_ENCRYPTION_KEY` está configurada
4. Hacer rollback si es necesario (ver sección Rollback)


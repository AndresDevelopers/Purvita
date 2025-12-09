# Guía de Métodos de Pago Manual (Depósito Manual)

## 📋 Descripción General

El sistema de **Depósito Manual** permite al administrador configurar múltiples métodos de pago para que los usuarios puedan recargar su saldo. Incluye:

- **Transferencias Bancarias** (Bank Transfer)
- **Criptomonedas** (USDT TRC20, USDT ERC20, Bitcoin, Ethereum)
- **Servicios P2P** (Zelle, Cash App, Venmo)
- **Servicios de Transferencia** (Western Union, MoneyGram)

---

## 🚀 Configuración Inicial

### Paso 1: Ejecutar Migración SQL (Opcional)

Si la tabla `payment_wallets` no tiene registros iniciales, ejecuta:

```bash
psql -d your_database -f docs/database/migrations/insert-manual-payment-methods.sql
```

Esto creará 10 métodos de pago con configuración inicial.

### Paso 2: Activar Depósito Manual

1. Ir a `/admin/pays`
2. Buscar la tarjeta **"Depósito Manual"**
3. Activar el switch
4. Hacer clic en **"Guardar"**

### Paso 3: Configurar Métodos de Pago

1. En la tarjeta de Depósito Manual, hacer clic en **"Configurar Métodos"**
2. Se abrirá la página `/admin/payment-wallets`

---

## 💳 Configuración de Métodos de Pago

### Crear Nuevo Método de Pago

1. Hacer clic en **"Add Payment Method"**
2. Seleccionar el tipo de método (Bank Transfer, USDT, Zelle, etc.)
3. Hacer clic en **"Create"**
4. Configurar los detalles del método

### Configurar Transferencia Bancaria

**Campos disponibles:**

- **Display Name**: Nombre descriptivo (ej: "Bank of America - Cuenta Principal")
- **Account Holder Name**: Nombre del titular de la cuenta
- **Bank Name**: Nombre del banco
- **Account Number**: Número de cuenta
- **Routing Number / Sort Code**: Número de ruta (US) o código de clasificación (UK)
- **SWIFT/BIC Code**: Código SWIFT para transferencias internacionales
- **IBAN**: Número de cuenta bancaria internacional (si aplica)
- **Minimum Amount**: Monto mínimo de depósito
- **Maximum Amount**: Monto máximo de depósito
- **Instructions**: Instrucciones personalizadas para el usuario

**Ejemplo de configuración:**

```
Display Name: Bank of America - Cuenta Principal
Account Holder: John Doe
Bank Name: Bank of America
Account Number: 1234567890
Routing Number: 026009593
SWIFT Code: BOFAUS3N
IBAN: (dejar vacío si no aplica)
Minimum Amount: $10.00
Maximum Amount: $10,000.00
```

### Configurar Criptomonedas (USDT, Bitcoin, Ethereum)

**Campos disponibles:**

- **Display Name**: Nombre descriptivo (ej: "USDT TRC20 - Wallet Principal")
- **Wallet Address**: Dirección de la wallet
- **Network**: Red blockchain (TRC20, ERC20, Bitcoin, Ethereum)
- **QR Code URL**: URL de la imagen del código QR (opcional)
- **Minimum Amount**: Monto mínimo de depósito
- **Maximum Amount**: Monto máximo de depósito
- **Instructions**: Instrucciones personalizadas

**Ejemplo de configuración USDT TRC20:**

```
Display Name: USDT TRC20 - Wallet Principal
Wallet Address: TXYZabc123def456ghi789jkl012mno345pqr678
Network: TRC20
QR Code URL: https://example.com/qr/usdt-trc20.png
Minimum Amount: $10.00
Maximum Amount: $10,000.00
```

### Configurar Servicios P2P (Zelle, Cash App, Venmo)

**Campos disponibles:**

- **Display Name**: Nombre descriptivo (ej: "Zelle - Cuenta Personal")
- **Account/Username**: Usuario o email de la cuenta
- **Phone Number**: Número de teléfono asociado
- **Email**: Email asociado
- **Minimum Amount**: Monto mínimo
- **Maximum Amount**: Monto máximo
- **Instructions**: Instrucciones personalizadas

**Ejemplo de configuración Zelle:**

```
Display Name: Zelle - Cuenta Personal
Account/Username: john.doe@example.com
Phone Number: +1 (555) 123-4567
Email: john.doe@example.com
Minimum Amount: $10.00
Maximum Amount: $5,000.00
```

### Configurar Western Union / MoneyGram

**Campos disponibles:**

- **Display Name**: Nombre descriptivo
- **Receiver Name**: Nombre del receptor
- **Receiver Country**: País del receptor
- **Receiver City**: Ciudad del receptor
- **Minimum Amount**: Monto mínimo
- **Maximum Amount**: Monto máximo
- **Instructions**: Instrucciones detalladas

---

## 🎯 Flujo de Usuario

### Cuando un usuario quiere recargar su saldo:

1. Va a la página de recarga
2. Selecciona **"Depósito Manual"**
3. Ve la lista de métodos de pago activos
4. Selecciona un método (ej: Bank Transfer)
5. Ve los detalles de la cuenta bancaria:
   - Nombre del banco
   - Número de cuenta
   - Nombre del titular
   - SWIFT/IBAN (si aplica)
   - Instrucciones adicionales
6. Realiza la transferencia desde su banco
7. Sube el comprobante de pago
8. El admin revisa y aprueba la recarga

---

## ⚙️ Configuración Avanzada

### Instrucciones Personalizadas

Puedes agregar instrucciones específicas en inglés y español:

**Formato JSON:**

```json
{
  "en": "Please include your user ID in the transfer reference",
  "es": "Por favor incluya su ID de usuario en la referencia de la transferencia"
}
```

### Metadata Personalizada

El campo `metadata` almacena información específica de cada método:

**Bank Transfer:**
```json
{
  "bank_name": "Bank of America",
  "account_holder": "John Doe",
  "account_number": "1234567890",
  "routing_number": "026009593",
  "swift": "BOFAUS3N",
  "iban": ""
}
```

**Crypto:**
```json
{
  "network": "TRC20",
  "qr_code_url": "https://example.com/qr.png"
}
```

**P2P Services:**
```json
{
  "phone": "+1 (555) 123-4567",
  "email": "john.doe@example.com"
}
```

---

## 📊 Límites de Monto

Los límites se almacenan en **centavos** (cents):

- `min_amount_cents: 1000` = $10.00
- `max_amount_cents: 1000000` = $10,000.00

**Conversión:**
- $1.00 = 100 cents
- $10.00 = 1,000 cents
- $100.00 = 10,000 cents
- $1,000.00 = 100,000 cents
- $10,000.00 = 1,000,000 cents

---

## ✅ Checklist de Configuración

- [ ] Ejecutar migración SQL (si es necesario)
- [ ] Activar "Depósito Manual" en `/admin/pays`
- [ ] Crear métodos de pago en `/admin/payment-wallets`
- [ ] Configurar cuenta bancaria con todos los detalles
- [ ] Configurar criptomonedas (si aplica)
- [ ] Configurar servicios P2P (si aplica)
- [ ] Activar los métodos que deseas ofrecer
- [ ] Configurar límites mínimos y máximos
- [ ] Agregar instrucciones personalizadas
- [ ] Probar el flujo de recarga como usuario

---

## 🔒 Seguridad

- **NO** almacenes contraseñas o claves privadas en el sistema
- Solo almacena información pública (números de cuenta, direcciones de wallet)
- Las credenciales de PayPal y Stripe se configuran en variables de entorno
- Los métodos manuales solo almacenan información de recepción de pagos

---

## 📝 Notas Importantes

1. **Activación**: Un método debe estar activo (`is_active = true`) para que los usuarios lo vean
2. **Múltiples Métodos**: Puedes tener múltiples métodos del mismo tipo (ej: 2 cuentas bancarias)
3. **Instrucciones**: Siempre agrega instrucciones claras para evitar errores de los usuarios
4. **Límites**: Configura límites realistas según tu operación
5. **QR Codes**: Para criptomonedas, sube el QR code a un servidor y guarda la URL

---

## 🆘 Solución de Problemas

### No veo ningún método de pago

1. Verifica que ejecutaste la migración SQL
2. Verifica que activaste "Depósito Manual" en `/admin/pays`
3. Crea un nuevo método con el botón "Add Payment Method"

### Los usuarios no ven el método

1. Verifica que el método esté activo (switch "Active" en ON)
2. Verifica que "Depósito Manual" esté activo en `/admin/pays`
3. Verifica que el método tenga un nombre descriptivo

### Error al guardar

1. Verifica que todos los campos requeridos estén llenos
2. Verifica que los límites sean válidos (mínimo < máximo)
3. Revisa la consola del navegador para más detalles

---

## 📞 Soporte

Para más ayuda, contacta al equipo de desarrollo.


# IP Address Encryption - Privacy Protection

## 📋 Resumen

Este sistema encripta las direcciones IP almacenadas en los audit logs para proteger la privacidad de los usuarios y cumplir con regulaciones como GDPR y CCPA.

## 🔐 Características

### Encriptación

- **Algoritmo**: AES-256-GCM (mismo que credenciales de pago)
- **Formato**: `salt:iv:authTag:ciphertext` (base64)
- **Clave**: Usa `CREDENTIALS_ENCRYPTION_KEY` del entorno
- **Automática**: Se encripta al guardar en audit logs

### Privacidad

- ✅ Protege la ubicación del usuario
- ✅ Cumple con GDPR/CCPA
- ✅ Previene tracking no autorizado
- ✅ Mantiene integridad del audit trail

### Acceso

- **Usuarios normales**: No pueden ver IPs (ni encriptadas ni desencriptadas)
- **Admins**: Pueden desencriptar IPs cuando sea necesario para investigaciones de seguridad

---

## 🚀 Uso

### Encriptar IP (Automático)

El sistema encripta automáticamente las IPs al guardar audit logs:

```typescript
import { logUserAction } from '@/lib/services/audit-log-service';

// La IP se encripta automáticamente
await logUserAction(
  'LOGIN_SUCCESS',
  'user',
  userId,
  { browser: 'Chrome' },
  '192.168.1.1',  // ← Se encripta antes de guardar
  'Mozilla/5.0...'
);
```

### Desencriptar IP (Solo Admins)

```typescript
import { getAllAuditLogs } from '@/lib/services/audit-log-service';

// Sin desencriptar (por defecto)
const logs = await getAllAuditLogs(50, false);
// logs[0].ip_address = "abc123...:def456..." (encriptado)

// Con desencriptación (admin only)
const logsDecrypted = await getAllAuditLogs(50, true);
// logsDecrypted[0].ip_address = "192.168.1.1" (desencriptado)
```

### Encriptación Manual

```typescript
import { encryptIP, decryptIP } from '@/lib/security/ip-encryption';

// Encriptar
const encrypted = await encryptIP('192.168.1.1');
// Returns: "abc123...:def456...:ghi789...:jkl012..."

// Desencriptar
const original = await decryptIP(encrypted);
// Returns: "192.168.1.1"
```

### Anonimización (Alternativa)

Para analytics sin encriptación completa:

```typescript
import { anonymizeIP } from '@/lib/security/ip-encryption';

const anonymized = anonymizeIP('192.168.1.100');
// Returns: "192.168.1.xxx"

const anonymizedIPv6 = anonymizeIP('2001:0db8:85a3::7334');
// Returns: "2001:db8:85a3::xxx"
```

---

## 🔧 Migración de IPs Existentes

Si ya tienes audit logs con IPs sin encriptar, usa el script de migración:

### Dry Run (Prueba sin cambios)

```bash
DRY_RUN=true npx tsx scripts/migrate-encrypt-ips.ts
```

### Migración Real

```bash
npx tsx scripts/migrate-encrypt-ips.ts
```

### Características del Script

- ✅ **Idempotente**: Puede ejecutarse múltiples veces
- ✅ **Batch processing**: Procesa en lotes de 100
- ✅ **Skip encrypted**: Omite IPs ya encriptadas
- ✅ **Progress logging**: Muestra progreso en tiempo real
- ✅ **Error handling**: Continúa si falla un registro

### Salida Esperada

```text
🔐 IP Address Encryption Migration
=====================================
Mode: LIVE
Batch size: 100

📊 Total audit logs with IP addresses: 1,234

📦 Processing batch 1...
✅ Encrypted IP for log abc-123
✅ Encrypted IP for log def-456
⏭️  Skipping ghi-789: Already encrypted

📈 Progress: 100/1234 (8%)
   ✅ Encrypted: 95
   ⏭️  Skipped: 5
   ❌ Failed: 0

...

=====================================
🎉 Migration Complete!
=====================================
Total processed: 1,234
✅ Successfully encrypted: 1,200
⏭️  Already encrypted (skipped): 30
❌ Failed: 4
```

---

## 🔍 Verificación

### Verificar Encriptación en Base de Datos

```sql
-- Ver IPs encriptadas (formato: salt:iv:authTag:ciphertext)
SELECT id, ip_address, created_at 
FROM audit_logs 
WHERE ip_address IS NOT NULL 
LIMIT 10;

-- Contar IPs encriptadas vs sin encriptar
SELECT 
  COUNT(*) FILTER (WHERE ip_address LIKE '%:%:%:%') as encrypted,
  COUNT(*) FILTER (WHERE ip_address NOT LIKE '%:%:%:%') as unencrypted
FROM audit_logs 
WHERE ip_address IS NOT NULL;
```

### Verificar en Código

```typescript
import { isEncrypted } from '@/lib/security/ip-encryption';

const ip = "abc:def:ghi:jkl";
console.log(isEncrypted(ip)); // true

const plainIP = "192.168.1.1";
console.log(isEncrypted(plainIP)); // false
```

---

## 🛡️ Seguridad

### Protección de la Clave

La clave de encriptación (`CREDENTIALS_ENCRYPTION_KEY`) debe:

- ✅ Tener 64 caracteres hexadecimales (32 bytes)
- ✅ Generarse con `crypto.randomBytes(32).toString('hex')`
- ✅ Almacenarse en variables de entorno (nunca en código)
- ✅ Rotarse periódicamente (cada 6-12 meses)
- ✅ Tener backup seguro (para desencriptar datos antiguos)

### Generación de Clave

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Rotación de Clave

Si necesitas rotar la clave:

1. Genera nueva clave
2. Desencripta todas las IPs con clave antigua
3. Re-encripta con clave nueva
4. Actualiza `CREDENTIALS_ENCRYPTION_KEY`

---

## 📊 Compliance

### GDPR (Europa)

- ✅ **Art. 32**: Encriptación de datos personales
- ✅ **Art. 25**: Privacy by design
- ✅ **Art. 5**: Minimización de datos

### CCPA (California)

- ✅ **§1798.81.5**: Encriptación de información personal
- ✅ **§1798.150**: Protección contra brechas de datos

### Beneficios

1. **Reduce riesgo de brechas**: IPs encriptadas son inútiles si se filtran
2. **Cumplimiento legal**: Satisface requisitos de privacidad
3. **Confianza del usuario**: Demuestra compromiso con privacidad
4. **Auditoría**: Mantiene logs útiles sin comprometer privacidad

---

## 🔧 Troubleshooting

### Error: "CREDENTIALS_ENCRYPTION_KEY not set"

**Solución**: Configura la variable de entorno

```bash
# .env.local
CREDENTIALS_ENCRYPTION_KEY=your-64-char-hex-key-here
```

### Error: "Failed to encrypt IP address"

**Causas posibles**:

- Clave de encriptación inválida
- IP en formato incorrecto
- Problemas de memoria

**Solución**: Verifica logs para detalles específicos

### IPs no se desencriptan

**Verificar**:

1. Usuario es admin
2. `decryptIPs=true` en la llamada
3. Clave de encriptación es la misma que se usó para encriptar

---

## 📚 Referencias

- [AES-256-GCM](https://en.wikipedia.org/wiki/Galois/Counter_Mode)
- [GDPR Art. 32](https://gdpr-info.eu/art-32-gdpr/)
- [CCPA §1798.81.5](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.81.5)
- [OWASP Cryptographic Storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)

---

## 🎯 Próximos Pasos

1. ✅ Ejecutar migración de IPs existentes
2. ✅ Verificar que nuevas IPs se encriptan automáticamente
3. ✅ Documentar proceso de rotación de claves
4. ⏳ Considerar encriptar otros datos sensibles (teléfono, dirección)
5. ⏳ Implementar política de retención de audit logs


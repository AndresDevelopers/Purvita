# Consideraciones de Seguridad - Authorize.net y Payoneer

## ⚠️ ADVERTENCIAS IMPORTANTES

### Authorize.net - Manejo de Datos de Tarjeta

**ESTADO ACTUAL:** La implementación actual maneja datos de tarjeta de crédito directamente en el cliente y los envía al servidor.

**RIESGOS:**
- ❌ Los datos de tarjeta pasan por el cliente (navegador)
- ❌ Los datos de tarjeta pasan por nuestro servidor antes de llegar a Authorize.net
- ❌ Esto requiere cumplimiento PCI DSS nivel más alto (SAQ D)
- ❌ Mayor responsabilidad legal y de seguridad

**RECOMENDACIONES PARA PRODUCCIÓN:**

1. **Implementar Accept.js (Recomendado)**
   ```javascript
   // En lugar de enviar cardNumber directamente:
   // Usar Accept.js para tokenizar en el cliente
   Accept.dispatchData(secureData, responseHandler);
   ```
   - Los datos de tarjeta nunca tocan nuestro servidor
   - Reduce el alcance de PCI DSS a SAQ A-EP
   - Authorize.net proporciona un token que usamos para procesar

2. **Implementar Accept Hosted**
   - Redirige al usuario a una página segura de Authorize.net
   - Authorize.net maneja todo el formulario de pago
   - Nuestro servidor solo recibe notificaciones de resultado
   - Alcance PCI DSS: SAQ A

3. **Validación Adicional**
   - Implementar Luhn algorithm para validar números de tarjeta
   - Validar formato de fecha de expiración
   - Validar CVV (3-4 dígitos)
   - Implementar rate limiting en el endpoint

### Validación de Pagos

**CONFIGURACIÓN ACTUAL:**

El archivo `src/lib/security/payment-validation.ts` ha sido actualizado para:

✅ Permitir las siguientes claves de metadata para Authorize.net:
- `cardNumber` - Solo dígitos, espacios y barras
- `expirationDate` - Solo dígitos, espacios y barras  
- `cvv` - Solo dígitos, espacios y barras
- `firstName`, `lastName`, `address`, `city`, `state`, `zip`, `country`
- `customerEmail`
- `affiliateReferralCode`, `affiliateId`, `saleChannel`

✅ Permitir las siguientes claves para Payoneer:
- `payeeId`
- `payeeEmail`

✅ Permitir `cartItems` para información del carrito

**SANITIZACIÓN:**
- Los datos de tarjeta (`cardNumber`, `expirationDate`, `cvv`) se limpian pero se preservan
- Solo se permiten dígitos, espacios y barras (/)
- Otros campos se sanitizan completamente contra XSS y SQL injection

### Variables de Entorno

**SEGURIDAD DE CREDENCIALES:**

```bash
# ✅ CORRECTO: Variables en .env (nunca en código)
AUTHORIZE_NET_API_LOGIN_ID=your_login_id
AUTHORIZE_NET_TRANSACTION_KEY=your_key

# ❌ INCORRECTO: Hardcoded en código
const apiLoginId = "123456789";
```

**ROTACIÓN DE CREDENCIALES:**
- Rotar credenciales cada 90 días
- Usar credenciales de TEST para desarrollo
- NUNCA compartir credenciales de producción en repositorios

### Modo Automático

El sistema detecta automáticamente el modo (production/test) basado en:

1. Si hay credenciales de producción → Usa producción
2. Si NO hay credenciales de producción pero SÍ hay de test → Usa test automáticamente
3. Si no hay ninguna → Error de configuración

Esto previene:
- ✅ Usar accidentalmente producción en desarrollo
- ✅ Cobros reales en ambiente de pruebas
- ✅ Confusión de configuración

### HTTPS Obligatorio

**CRÍTICO:** Authorize.net y Payoneer REQUIEREN HTTPS en producción.

```nginx
# Nginx - Forzar HTTPS
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    # Configuración SSL moderna
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
}
```

### Rate Limiting

**IMPLEMENTAR EN PRODUCCIÓN:**

```typescript
// Ejemplo con Redis
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests por minuto
});

// En el API route
const { success } = await ratelimit.limit(ipAddress);
if (!success) {
  return NextResponse.json(
    { error: "Too many requests" },
    { status: 429 }
  );
}
```

### Logging y Monitoreo

**QUÉ REGISTRAR:**
- ✅ Intentos de pago (sin datos de tarjeta)
- ✅ Errores de validación
- ✅ Cambios de configuración
- ✅ Accesos al panel de admin

**QUÉ NO REGISTRAR:**
- ❌ Números de tarjeta completos
- ❌ CVV
- ❌ Credenciales de API
- ❌ Tokens de sesión completos

```typescript
// ✅ CORRECTO
console.log(`Payment attempt: amount=${amount}, provider=authorize_net, last4=${cardNumber.slice(-4)}`);

// ❌ INCORRECTO
console.log(`Payment attempt: cardNumber=${cardNumber}, cvv=${cvv}`);
```

### Webhook Security

**Authorize.net Webhooks:**
```typescript
// Verificar firma del webhook
verifyWebhookSignature(payload, signature, credentials): boolean {
  // TODO: Implementar verificación SHA-512
  // https://developer.authorize.net/api/reference/features/webhooks.html
}
```

**Payoneer Webhooks:**
```typescript
// Verificar firma HMAC
verifyWebhookSignature(payload, signature, credentials): boolean {
  // TODO: Implementar verificación HMAC
  // https://developers.payoneer.com/docs/webhooks
}
```

## Checklist de Producción

Antes de lanzar a producción, verificar:

- [ ] Implementar Accept.js o Accept Hosted para Authorize.net
- [ ] Configurar HTTPS con certificado válido
- [ ] Implementar rate limiting en endpoints de pago
- [ ] Configurar variables de entorno de producción
- [ ] Rotar credenciales de test a producción
- [ ] Implementar logging sin datos sensibles
- [ ] Configurar webhooks con verificación de firma
- [ ] Probar flujo completo en sandbox
- [ ] Configurar alertas de errores de pago
- [ ] Documentar proceso de rotación de credenciales
- [ ] Implementar backup de configuración
- [ ] Configurar monitoreo de transacciones
- [ ] Revisar cumplimiento PCI DSS
- [ ] Configurar políticas de reembolso
- [ ] Documentar procedimientos de emergencia

## Recursos

- [Authorize.net Accept.js](https://developer.authorize.net/api/reference/features/acceptjs.html)
- [Authorize.net Accept Hosted](https://developer.authorize.net/api/reference/features/accept_hosted.html)
- [PCI DSS Compliance](https://www.pcisecuritystandards.org/)
- [Payoneer API Documentation](https://developers.payoneer.com/)
- [OWASP Payment Security](https://owasp.org/www-community/vulnerabilities/Payment_Card_Industry_Data_Security_Standard)

---

**Última actualización:** 2025-11-26
**Versión:** 1.0
**Autor:** Sistema de Desarrollo

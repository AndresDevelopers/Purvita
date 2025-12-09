# Configuración de Rate Limiting para Login

## 🔐 Protección Contra Brute Force

El sistema de login ahora incluye **rate limiting configurable** que bloquea automáticamente a usuarios que intentan múltiples logins fallidos, protegiendo tu aplicación contra ataques de fuerza bruta.

---

## ⚙️ Configuración (Admin Panel - Recomendado)

### Configuración desde el Admin Panel

**IMPORTANTE**: La forma recomendada de configurar el rate limiting es desde el Admin Panel:

1. Accede a **Admin → Security**
2. Haz clic en la pestaña **"Rate Limit"**
3. En la sección **"Login Rate Limiting"**, configura:
   - **Max Attempts**: Número máximo de intentos de login (1-100)
   - **Time Window**: Ventana de tiempo en segundos (mínimo 1)
4. Haz clic en **"Save Configuration"**

**Ventajas**:
- ✅ Cambios en tiempo real sin reiniciar el servidor
- ✅ Configuración centralizada en la base de datos
- ✅ Caché Redis para rendimiento óptimo
- ✅ Interfaz visual intuitiva

---

## 🔧 Variables de Entorno (Fallback Opcional)

### Configuración Básica

**NOTA**: Las variables de entorno son **opcionales** y solo se usan como fallback si la base de datos no está disponible.

Si prefieres usar variables de entorno, agrega estas a tu `.env.local` (desarrollo) o en las variables de entorno de tu plataforma (producción):

```bash
# Número máximo de intentos de login antes de bloquear
LOGIN_RATE_LIMIT_ATTEMPTS=5

# Tiempo de bloqueo en segundos después de exceder los intentos
LOGIN_RATE_LIMIT_WINDOW_SECONDS=60
```

### Valores por Defecto

Si no configuras estas variables, el sistema usa:
- **Intentos permitidos:** 5
- **Ventana de tiempo:** 60 segundos

---

## 📋 Ejemplos de Configuración

### 1. Configuración Estricta (Producción)
Para máxima seguridad en producción:

```bash
LOGIN_RATE_LIMIT_ATTEMPTS=3
LOGIN_RATE_LIMIT_WINDOW_SECONDS=300  # 5 minutos
```

**Comportamiento:** 3 intentos fallidos = bloqueado por 5 minutos

### 2. Configuración Balanceada (Recomendada)
Para balance entre seguridad y usabilidad:

```bash
LOGIN_RATE_LIMIT_ATTEMPTS=5
LOGIN_RATE_LIMIT_WINDOW_SECONDS=60  # 1 minuto
```

**Comportamiento:** 5 intentos fallidos = bloqueado por 1 minuto

### 3. Configuración Permisiva (Desarrollo)
Para desarrollo y testing:

```bash
LOGIN_RATE_LIMIT_ATTEMPTS=10
LOGIN_RATE_LIMIT_WINDOW_SECONDS=30  # 30 segundos
```

**Comportamiento:** 10 intentos fallidos = bloqueado por 30 segundos

### 4. Configuración Muy Estricta (Alta Seguridad)
Para aplicaciones con requisitos de seguridad extremos:

```bash
LOGIN_RATE_LIMIT_ATTEMPTS=3
LOGIN_RATE_LIMIT_WINDOW_SECONDS=600  # 10 minutos
```

**Comportamiento:** 3 intentos fallidos = bloqueado por 10 minutos

---

## 🧪 Cómo Probar el Rate Limiting

### Prueba Manual

1. **Inicia tu aplicación:**
   ```bash
   npm run dev
   ```

2. **Ve a la página de login:**
   ```
   http://localhost:9000/es/auth/login
   ```

3. **Intenta login con contraseña incorrecta 6 veces**
   - Email: cualquier email válido
   - Password: contraseña incorrecta

4. **Resultado esperado:**
   - Intentos 1-5: Error "Invalid email or password"
   - Intento 6: Error "Too many login attempts. Please wait X seconds before trying again."
   - El formulario queda bloqueado temporalmente

### Prueba Automatizada con cURL

```bash
# Crear archivo de prueba
cat > test-rate-limit.sh << 'EOF'
#!/bin/bash

echo "🧪 Probando Rate Limiting del Login..."
echo "========================================="

for i in {1..7}; do
  echo ""
  echo "📤 Intento #$i"

  RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
    -X POST http://localhost:9000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrongpassword"}')

  HTTP_BODY=$(echo "$RESPONSE" | sed -e 's/HTTP_STATUS:.*$//')
  HTTP_STATUS=$(echo "$RESPONSE" | tr -d '\n' | sed -e 's/.*HTTP_STATUS://')

  echo "Status: $HTTP_STATUS"
  echo "Response: $HTTP_BODY" | jq . 2>/dev/null || echo "$HTTP_BODY"

  if [ "$HTTP_STATUS" = "429" ]; then
    echo "✅ Rate limiting funcionando correctamente!"
    echo "🔒 Usuario bloqueado después de $i intentos"
    break
  fi

  sleep 1
done

echo ""
echo "========================================="
echo "✅ Prueba completada"
EOF

# Hacer ejecutable
chmod +x test-rate-limit.sh

# Ejecutar
./test-rate-limit.sh
```

### Resultado Esperado

```
🧪 Probando Rate Limiting del Login...
=========================================

📤 Intento #1
Status: 401
Response: {"error":"Authentication failed","message":"Invalid email or password","remainingAttempts":4}

📤 Intento #2
Status: 401
Response: {"error":"Authentication failed","message":"Invalid email or password","remainingAttempts":3}

📤 Intento #3
Status: 401
Response: {"error":"Authentication failed","message":"Invalid email or password","remainingAttempts":2}

📤 Intento #4
Status: 401
Response: {"error":"Authentication failed","message":"Invalid email or password","remainingAttempts":1}

📤 Intento #5
Status: 401
Response: {"error":"Authentication failed","message":"Invalid email or password","remainingAttempts":0}

📤 Intento #6
Status: 429
Response: {"error":"Too many login attempts","message":"You have exceeded the maximum number of login attempts. Please try again later.","retryAfter":1730480980,"remainingAttempts":0}

✅ Rate limiting funcionando correctamente!
🔒 Usuario bloqueado después de 6 intentos
=========================================
✅ Prueba completada
```

---

## 📊 Monitoreo de Rate Limiting

### Headers de Respuesta

Cada intento de login incluye headers informativos:

```http
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 1730480980
```

- **X-RateLimit-Limit:** Número máximo de intentos permitidos
- **X-RateLimit-Remaining:** Intentos restantes antes del bloqueo
- **X-RateLimit-Reset:** Timestamp Unix cuando se resetea el contador

### Cuando se Excede el Límite

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1730480980
Retry-After: 60

{
  "error": "Too many login attempts",
  "message": "You have exceeded the maximum number of login attempts. Please try again later.",
  "retryAfter": 1730480980,
  "remainingAttempts": 0
}
```

---

## 🔍 Identificación de Usuarios

El rate limiting identifica usuarios por:

1. **Dirección IP** (header `x-forwarded-for`)
2. **Fallback:** "anonymous" si no hay IP

### Consideraciones

- **VPN/Proxy:** Usuarios detrás del mismo proxy comparten el límite
- **IPv6:** Se trata como dirección única
- **Desarrollo local:** Usa "anonymous" si no hay proxy

---

## 🚀 Despliegue en Producción

### Vercel

1. Ve a tu proyecto → **Settings** → **Environment Variables**
2. Agrega:
   ```
   LOGIN_RATE_LIMIT_ATTEMPTS = 5
   LOGIN_RATE_LIMIT_WINDOW_SECONDS = 60
   ```
3. **Redeploy** tu aplicación

### Railway

1. Ve a tu proyecto → **Variables**
2. Agrega las variables
3. Railway se redeploya automáticamente

### Render

1. Ve a tu servicio → **Environment** → **Add Environment Variable**
2. Agrega las variables
3. **Save Changes**

---

## 🛠️ Troubleshooting

### Problema: "Too many requests" en desarrollo

**Causa:** Estás probando repetidamente con la misma IP

**Solución temporal:**
```bash
# Opción 1: Espera el tiempo configurado (60 segundos por defecto)

# Opción 2: Reinicia el servidor
npm run dev

# Opción 3: Usa configuración más permisiva en .env.local
LOGIN_RATE_LIMIT_ATTEMPTS=100
LOGIN_RATE_LIMIT_WINDOW_SECONDS=10
```

### Problema: Rate limiting no funciona

**Verificar:**

1. **¿Las variables están en .env.local?**
   ```bash
   cat .env.local | grep LOGIN_RATE_LIMIT
   ```

2. **¿Reiniciaste el servidor después de agregar variables?**
   ```bash
   # Detener con Ctrl+C y ejecutar:
   npm run dev
   ```

3. **¿Redis está disponible?**
   El rate limiting usa Redis. Si no está configurado, usa fallback in-memory (funciona, pero se resetea al reiniciar).

### Problema: Usuarios legítimos bloqueados

**Opciones:**

1. **Aumentar intentos permitidos:**
   ```bash
   LOGIN_RATE_LIMIT_ATTEMPTS=10
   ```

2. **Reducir ventana de bloqueo:**
   ```bash
   LOGIN_RATE_LIMIT_WINDOW_SECONDS=30
   ```

3. **Implementar sistema de recuperación:**
   - Agregar "Olvidé mi contraseña"
   - Agregar CAPTCHA después de 3 intentos
   - Enviar email de notificación al usuario

---

## 📈 Métricas Recomendadas

### Valores de Producción según Tipo de App

| Tipo de Aplicación | Intentos | Ventana | Razón |
|-------------------|----------|---------|-------|
| **E-commerce** | 5 | 60s | Balance seguridad/UX |
| **Banking/Finance** | 3 | 300s | Máxima seguridad |
| **Internal Tools** | 10 | 60s | Usuarios conocidos |
| **Public API** | 5 | 60s | Estándar de industria |
| **Gaming** | 8 | 120s | Usuarios pueden olvidar password |

---

## ✅ Checklist de Implementación

- [x] Agregar `LOGIN_RATE_LIMIT_ATTEMPTS` a .env.example
- [x] Agregar `LOGIN_RATE_LIMIT_WINDOW_SECONDS` a .env.example
- [x] Validar variables en src/lib/env.ts
- [x] Implementar rate limiting en /api/auth/login
- [x] Modificar formularios de login (Desktop y Mobile)
- [ ] Agregar variables en .env.local para desarrollo
- [ ] Agregar variables en producción (Vercel/Railway)
- [ ] Probar rate limiting manualmente
- [ ] Probar rate limiting con script automatizado
- [ ] Documentar para el equipo
- [ ] Monitorear en producción primeros 7 días

---

## 🔗 Referencias

- **Archivo principal:** `src/app/api/auth/login/route.ts`
- **Formulario:** `src/app/[lang]/auth/login/page.tsx`
- **Validación:** `src/lib/env.ts`
- **Documentación completa:** `SECURITY_IMPROVEMENTS_APPLIED.md`

---

**Última actualización:** 2025-11-02
**Versión:** 1.0.0

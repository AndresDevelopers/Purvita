# Configuración de CRON_SECRET

## ⚠️ IMPORTANTE: Acción Requerida Antes de Producción

El `CRON_SECRET` es una variable de entorno crítica que protege tus endpoints de cron jobs de accesos no autorizados.

## 🔐 Generar CRON_SECRET

### Opción 1: Usando OpenSSL (Recomendado)
```bash
openssl rand -base64 32
```

### Opción 2: Usando Node.js
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Opción 3: Generador Online
Visita: https://www.random.org/strings/?num=1&len=32&digits=on&upperalpha=on&loweralpha=on&unique=on&format=html&rnd=new

## 📝 Configuración por Entorno

### Desarrollo Local (.env.local)
```bash
# Genera un secreto para desarrollo
CRON_SECRET=<tu-secreto-generado>
```

### Producción (Vercel/Railway/Otros)

#### Vercel
1. Ve a tu proyecto en [Vercel Dashboard](https://vercel.com/dashboard)
2. Settings → Environment Variables
3. Agrega una nueva variable:
   - **Name:** `CRON_SECRET`
   - **Value:** Tu secreto generado
   - **Environment:** Production, Preview (opcional)
4. Redeploy tu aplicación

#### Railway
1. Ve a tu proyecto en [Railway Dashboard](https://railway.app/dashboard)
2. Variables → New Variable
3. Agrega:
   - **Variable:** `CRON_SECRET`
   - **Value:** Tu secreto generado
4. Deploy

#### Render
1. Ve a tu servicio en [Render Dashboard](https://dashboard.render.com/)
2. Environment → Add Environment Variable
3. Agrega:
   - **Key:** `CRON_SECRET`
   - **Value:** Tu secreto generado
4. Save Changes

## 🔄 Configurar Cron Jobs

### Vercel Cron
Crea o actualiza `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/subscription-renewals",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/payment-reminders",
      "schedule": "0 8 * * *"
    }
  ]
}
```

**Nota:** Vercel Cron automáticamente incluye el header `Authorization: Bearer <CRON_SECRET>` cuando está configurado como variable de entorno.

### GitHub Actions
Crea `.github/workflows/cron.yml`:
```yaml
name: Daily Cron Jobs
on:
  schedule:
    # Runs at 00:00 UTC every day
    - cron: '0 0 * * *'
  workflow_dispatch: # Allows manual trigger

jobs:
  subscription-renewals:
    runs-on: ubuntu-latest
    steps:
      - name: Call subscription renewals endpoint
        run: |
          curl -X GET https://tu-dominio.com/api/cron/subscription-renewals \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"

  payment-reminders:
    runs-on: ubuntu-latest
    steps:
      - name: Call payment reminders endpoint
        run: |
          curl -X GET https://tu-dominio.com/api/cron/payment-reminders \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

Configura el secreto en GitHub:
1. Repositorio → Settings → Secrets and variables → Actions
2. New repository secret
3. Name: `CRON_SECRET`
4. Value: Tu secreto generado

### Servicio Externo (Cron-job.org, EasyCron, etc.)
Configura un job que llame a tu endpoint con el header correcto:

**URL:** `https://tu-dominio.com/api/cron/subscription-renewals`
**Method:** GET
**Headers:**
```
Authorization: Bearer tu-secreto-generado
```

## ✅ Verificación

### Probar el endpoint manualmente:
```bash
curl -X GET https://tu-dominio.com/api/cron/subscription-renewals \
  -H "Authorization: Bearer tu-secreto-generado"
```

### Respuesta esperada (éxito):
```json
{
  "success": true,
  "summary": {
    "totalProcessed": 5,
    "successful": 4,
    "failed": 1
  },
  "timestamp": "2025-11-01T10:00:00.000Z"
}
```

### Respuesta esperada (sin autorización):
```json
{
  "error": "Unauthorized"
}
```
**HTTP Status:** 401

## 🔄 Rotación de Secretos

### Procedimiento recomendado (cada 90 días):

1. **Generar nuevo secreto:**
   ```bash
   openssl rand -base64 32
   ```

2. **Actualizar en producción:**
   - Agrega el nuevo secreto como variable de entorno
   - NO elimines el anterior todavía

3. **Actualizar servicios de cron:**
   - Actualiza GitHub Actions Secrets
   - Actualiza servicios externos (cron-job.org, etc.)

4. **Verificar que funcione:**
   - Espera 24 horas
   - Verifica logs de cron jobs

5. **Eliminar secreto antiguo:**
   - Solo después de verificar que todo funciona

## 🚨 Troubleshooting

### Error: "Unauthorized" en cron jobs
- Verifica que `CRON_SECRET` esté configurado en tu plataforma
- Verifica que el header `Authorization: Bearer <secret>` esté correcto
- No debe haber espacios extra en el secreto

### Error: "CRON_SECRET is not set"
- Asegúrate de que la variable esté en environment variables
- Redeploy la aplicación después de agregar la variable

### Cron jobs no se ejecutan
- Verifica la sintaxis de cron schedule
- En Vercel, asegúrate de estar en plan Pro o superior
- Verifica logs en tu plataforma

## 📚 Referencias

- Endpoints protegidos:
  - `/api/cron/subscription-renewals` - Renovación automática de suscripciones
  - `/api/cron/payment-reminders` - Recordatorios de pago

- Documentación completa:
  - `docs/subscription-renewal-system.md`
  - `docs/payment-reminders.md`
  - `AUDITORIA_SEGURIDAD.md`

## ✅ Checklist de Implementación

- [ ] Generar `CRON_SECRET` fuerte con OpenSSL
- [ ] Agregar a `.env.local` para desarrollo
- [ ] Agregar a variables de entorno en producción (Vercel/Railway)
- [ ] Configurar cron jobs (Vercel Cron o GitHub Actions)
- [ ] Probar endpoint manualmente
- [ ] Verificar que responde 401 sin el secreto
- [ ] Verificar que responde 200 con el secreto correcto
- [ ] Esperar 24 horas y verificar ejecución automática
- [ ] Documentar fecha de creación del secreto (para rotación futura)

---

**Última actualización:** 2025-11-01

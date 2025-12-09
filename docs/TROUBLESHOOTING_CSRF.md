# Troubleshooting: Error al Guardar Configuración (CSRF)

## Error: "We couldn't save the application configuration"

### Síntomas
- El formulario de configuración de multinivel no guarda cambios
- Error en la consola del navegador: `We couldn't save the application configuration`
- Los endpoints del admin devuelven error 403 Forbidden

### Causas Posibles

#### 1. **Falta `CSRF_SECRET` en `.env.local`** ⚠️ MÁS COMÚN

**Solución:**
```bash
# Generar un nuevo CSRF_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Copiar el resultado y agregarlo a .env.local
CSRF_SECRET=<tu_valor_generado>
```

Luego reinicia el servidor de desarrollo:
```bash
npm run dev
```

#### 2. **Token CSRF no se envía en las peticiones**

**Verificar en DevTools (Network tab):**
- Abre la pestaña Network
- Intenta guardar la configuración
- Busca la petición a `/api/admin/app-settings`
- Verifica que el header `X-CSRF-Token` esté presente

**Si no está presente:**
- Asegúrate de que el formulario usa `adminApi` en lugar de `fetch()`
- Ejemplo correcto:
  ```typescript
  import { adminApi } from '@/lib/utils/admin-csrf-helpers';
  
  const response = await adminApi.put('/api/admin/app-settings', payload);
  ```

#### 3. **Cookie CSRF no se envía**

**Verificar en DevTools (Application > Cookies):**
- Busca la cookie `csrf-token`
- Verifica que tenga el atributo `HttpOnly`
- Verifica que `SameSite=Lax`

**Si no existe:**
- Recarga la página (Ctrl+F5)
- Limpia las cookies del navegador
- Intenta de nuevo

#### 4. **Token CSRF expirado**

**Síntoma:** Token válido pero rechazado

**Solución:**
- Recarga la página
- Limpia las cookies
- Intenta de nuevo

### Checklist de Verificación

- [ ] `CSRF_SECRET` está configurado en `.env.local` (64 caracteres hexadecimales)
- [ ] Servidor de desarrollo reiniciado después de agregar `CSRF_SECRET`
- [ ] Página recargada en el navegador (Ctrl+F5)
- [ ] Cookies del navegador limpias
- [ ] Header `X-CSRF-Token` presente en las peticiones
- [ ] Cookie `csrf-token` presente en el navegador
- [ ] Usando `adminApi` en lugar de `fetch()` en formularios

### Logs del Servidor

Busca estos mensajes en los logs del servidor:

```
# Token válido
[CSRF] Token validated successfully

# Token inválido
[CSRF] Token mismatch
[CSRF] Token missing
[CSRF] Token invalid or expired
```

### Archivos Relacionados

- **Configuración CSRF:** `src/lib/security/csrf-protection.ts`
- **Helper de API:** `src/lib/utils/admin-csrf-helpers.ts`
- **Formulario de app-settings:** `src/app/admin/app-settings/app-settings-form.tsx`
- **Endpoint de app-settings:** `src/app/api/admin/app-settings/route.ts`

### Contacto

Si el problema persiste después de verificar todo:
1. Verifica los logs del servidor
2. Abre DevTools y revisa la consola del navegador
3. Revisa la pestaña Network para ver las respuestas del servidor


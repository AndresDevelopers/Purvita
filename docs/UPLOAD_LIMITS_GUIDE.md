# 📁 Sistema de Límites de Carga - Guía de Uso

## 📋 Descripción General

El sistema de límites de carga permite a los administradores configurar los límites de tamaño para la carga de imágenes en la plataforma.

## 🎯 Características Implementadas

- ✅ Configuración de tamaño máximo para imágenes generales (productos, páginas, marketing)
- ✅ Configuración de tamaño máximo para avatares de usuarios
- ✅ API de validación para feedback en tiempo real
- ✅ Protección CSRF y audit logging
- ✅ Interfaz de administración simplificada

## 🗂️ Estructura de Archivos

```
src/
├── modules/upload/
│   ├── domain/models/upload-limits.ts       # Modelos y validación Zod
│   └── services/upload-limits-service.ts    # Lógica de negocio
├── app/
│   ├── admin/upload-limits/page.tsx         # Página de administración
│   └── api/
│       ├── admin/upload-limits/route.ts     # API de configuración
│       └── upload/validate/route.ts         # API de validación
└── supabase/migrations/
    └── 20251115_upload_limits_config.sql    # Esquema de base de datos
```

## 🚀 Configuración Inicial

### 1. Ejecutar Migración de Base de Datos

```bash
# Aplicar la migración a Supabase
supabase db push
```

La migración creará:
- Tabla `upload_limits_config` con una configuración por defecto
- Políticas RLS para acceso admin y lectura pública
- Triggers para actualizar timestamps

### 2. Acceder al Panel de Administración

Navega a: `/admin/upload-limits`

**Requisitos**:
- Usuario autenticado
- Rol `admin` en la base de datos

## 📝 Uso del Panel de Administración

### Opciones de Configuración

#### **Límites de Imágenes**
- **Tamaño Máximo de Imagen (MB)**: Tamaño máximo en MB para imágenes de productos, páginas y marketing (0.1 - 100 MB)
- **Tamaño Máximo de Avatar (MB)**: Límite separado para fotos de perfil de usuarios y afiliados (0.1 - 10 MB)
- **Tipos permitidos**: JPEG, JPG, PNG, WebP, GIF, SVG

### Dónde se aplican estos límites

- **Imágenes generales**: Productos, páginas estáticas, contenido de marketing
- **Avatares**: Fotos de perfil de usuarios y afiliados

### Botones de Acción

- **Guardar Cambios**: Guarda la configuración actual
- **Restaurar Valores**: Restaura los valores por defecto
- **Cancelar**: Descarta cambios y recarga la configuración

## 🔌 Uso de la API

### 1. Obtener Configuración Actual

```typescript
// GET /api/admin/upload-limits
const response = await fetch('/api/admin/upload-limits');
const { config } = await response.json();

console.log(config.max_image_size_mb); // 5.0
console.log(config.allowed_image_types); // ['image/jpeg', 'image/png', ...]
```

### 2. Actualizar Configuración

```typescript
// PUT /api/admin/upload-limits
const csrfResponse = await fetch('/api/csrf-token');
const { token } = await csrfResponse.json();

const response = await fetch('/api/admin/upload-limits', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': token,
  },
  body: JSON.stringify({
    max_image_size_mb: 10.0,
    max_video_size_mb: 200.0,
    enable_image_compression: true,
  }),
});

const { config } = await response.json();
```

### 3. Resetear a Valores por Defecto

```typescript
// POST /api/admin/upload-limits
const csrfResponse = await fetch('/api/csrf-token');
const { token } = await csrfResponse.json();

const response = await fetch('/api/admin/upload-limits', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': token,
  },
});

const { config, message } = await response.json();
```

### 4. Validar Archivo Antes de Subir

```typescript
// POST /api/upload/validate
const file = document.getElementById('file-input').files[0];

const response = await fetch('/api/upload/validate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    size: file.size,
    type: file.type,
    category: 'image', // 'image' | 'avatar'
  }),
});

const result = await response.json();

if (result.valid) {
  // Proceder con la carga
  console.log('File is valid!');
} else {
  // Mostrar error al usuario
  alert(result.error);
}
```

## 💻 Integración en Componentes

### Ejemplo: Validación de Imagen en Frontend

```typescript
'use client';

import { useState } from 'react';

export default function ImageUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);

    // Validar antes de permitir la carga
    const response = await fetch('/api/upload/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        size: selectedFile.size,
        type: selectedFile.type,
        category: 'image',
      }),
    });

    const result = await response.json();

    if (!result.valid) {
      setError(result.error);
      setFile(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      alert('Image uploaded successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={uploading}
      />

      {error && <p className="text-red-500">{error}</p>}

      {file && !error && (
        <button onClick={handleUpload} disabled={uploading}>
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
      )}
    </div>
  );
}
```

### Ejemplo: Usar el Servicio Directamente en API Routes

```typescript
import { UploadLimitsService } from '@/modules/upload/services/upload-limits-service';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const service = new UploadLimitsService(supabase);

  // Obtener archivo del formData
  const formData = await req.formData();
  const file = formData.get('file') as File;

  // Validar el archivo
  const validation = await service.validateFile(
    {
      size: file.size,
      type: file.type,
    },
    'image'
  );

  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    );
  }

  // Proceder con la carga...
  // ...
}
```

## 🔐 Seguridad

### Protecciones Implementadas

1. **CSRF Protection**: Todos los endpoints de modificación requieren token CSRF
2. **Validación Zod**: Validación estricta de datos de entrada
3. **RLS (Row Level Security)**: Control de acceso a nivel de base de datos
4. **Audit Logging**: Registro de cambios de configuración
5. **Admin Only**: Solo administradores pueden modificar la configuración
6. **Lectura Pública**: La configuración es de lectura pública para validación durante uploads

### Políticas RLS

```sql
-- Admin puede leer y actualizar
CREATE POLICY "Admins can read upload limits"
  ON upload_limits_config FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- Público puede leer para validación
CREATE POLICY "Public can read upload limits for validation"
  ON upload_limits_config FOR SELECT
  TO anon, authenticated
  USING (true);
```

## 📊 Valores por Defecto

```typescript
{
  // Imágenes generales (productos, páginas, marketing)
  max_image_size_mb: 5.0,
  allowed_image_types: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'],

  // Avatares (fotos de perfil)
  max_avatar_size_mb: 2.0,
}
```

## 🛠️ Troubleshooting

### Error: "Upload limits configuration not found"

**Solución**: Ejecutar la migración de base de datos:
```bash
supabase db push
```

### Error: "Forbidden: Admin access required"

**Solución**: Verificar que el usuario tiene rol `admin` en la tabla `profiles`:
```sql
UPDATE profiles SET role = 'admin' WHERE id = 'USER_ID';
```

### Error: "CSRF token validation failed"

**Solución**: Asegurarse de obtener y enviar el token CSRF:
```typescript
const csrfResponse = await fetch('/api/csrf-token');
const { token } = await csrfResponse.json();
// Usar token en header X-CSRF-Token
```

## 📚 Recursos Adicionales

- [Modelos TypeScript](/src/modules/upload/domain/models/upload-limits.ts)
- [Servicio de Límites](/src/modules/upload/services/upload-limits-service.ts)
- [API de Configuración](/src/app/api/admin/upload-limits/route.ts)
- [API de Validación](/src/app/api/upload/validate/route.ts)
- [Migración SQL](/supabase/migrations/20251115_upload_limits_config.sql)

## 🎉 Conclusión

El sistema de límites de carga proporciona una solución robusta y flexible para gestionar restricciones de archivos en tu aplicación, con una interfaz intuitiva para administradores y una API fácil de usar para desarrolladores.

---

**Última actualización**: 15 de Noviembre de 2025

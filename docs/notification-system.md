# Sistema de Notificaciones / Notification System

## Descripción / Description

**ES:** Sistema completo de notificaciones por correo electrónico que permite a los usuarios gestionar sus preferencias de notificación y recibir actualizaciones sobre ofertas promocionales, actualizaciones de equipo y nuevo contenido de video.

**EN:** Complete email notification system that allows users to manage their notification preferences and receive updates about promotional offers, team updates, and new video content.

---

## Características / Features

### 1. Preferencias de Notificación / Notification Preferences

Los usuarios pueden activar/desactivar las siguientes notificaciones:

**Promotional Offers (Ofertas Promocionales)**
- Se integra con Mailchimp
- Al activar: Suscribe al usuario a la lista de Mailchimp
- Al desactivar: Da de baja al usuario de Mailchimp
- Envía ofertas especiales, descuentos y lanzamientos de productos

**Team Updates (Actualizaciones de Equipo)**
- Notifica cuando alguien se une al equipo del usuario
- Envía email con información del nuevo miembro
- Ayuda a mantener conexión con el equipo

**New Video Content (Nuevo Contenido de Video)**
- Notifica sobre nuevos videos de entrenamiento
- Incluye título, descripción y enlace al video
- Mantiene a los usuarios informados sobre nuevo contenido

---

## Arquitectura / Architecture

### Base de Datos / Database

**Tabla: `notification_preferences`**
```sql
CREATE TABLE notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES profiles(id),
  promotional_offers boolean DEFAULT true,
  team_updates boolean DEFAULT true,
  new_video_content boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Módulos / Modules

```
src/modules/notifications/
├── domain/
│   ├── models/
│   │   └── notification-preferences.ts    # Modelos y esquemas Zod
│   └── contracts/
│       └── notification-preferences-repository.ts
├── data/
│   └── repositories/
│       └── supabase-notification-preferences-repository.ts
├── services/
│   ├── notification-preferences-service.ts    # Lógica de negocio
│   └── notification-email-service.ts          # Envío de emails
└── factories/
    └── notification-module.ts
```

### APIs / API Endpoints

**GET /api/notifications/preferences**
- Obtiene las preferencias del usuario autenticado
- Crea preferencias por defecto si no existen

**PUT /api/notifications/preferences**
- Actualiza las preferencias del usuario
- Maneja suscripción/desuscripción de Mailchimp automáticamente

**POST /api/notifications/team-member-added**
- Envía notificación cuando se agrega un miembro al equipo
- Llamado internamente después del registro

---

## Integración con Mailchimp / Mailchimp Integration

### Funciones Disponibles / Available Functions

**subscribeToMailchimp(params)**
```typescript
await subscribeToMailchimp({
  email: 'user@example.com',
  firstName: 'John',
  lastName: 'Doe',
  tags: ['promotional-offers']
});
```

**unsubscribeFromMailchimp(params)**
```typescript
await unsubscribeFromMailchimp({
  email: 'user@example.com'
});
```

### Configuración / Configuration

Variables de entorno requeridas:
```env
MAILCHIMP_API_KEY=your_api_key_here
MAILCHIMP_AUDIENCE_ID=your_audience_id_here
```

---

## Flujo de Notificaciones / Notification Flow

### 1. Promotional Offers

```
Usuario activa "Promotional Offers"
    ↓
API actualiza preferencias en DB
    ↓
Servicio llama a subscribeToMailchimp()
    ↓
Usuario es agregado a lista de Mailchimp
    ↓
Mailchimp envía campañas promocionales
```

### 2. Team Updates

```
Nuevo usuario se registra con código de referido
    ↓
Trigger de DB detecta nuevo miembro
    ↓
API /notifications/team-member-added es llamada
    ↓
Servicio verifica preferencias del sponsor
    ↓
Si está habilitado, envía email al sponsor
```

### 3. New Video Content

```
Admin agrega nuevo video
    ↓
Sistema llama a notifyNewVideoContent()
    ↓
Servicio obtiene usuarios con preferencia habilitada
    ↓
Envía email a cada usuario con el nuevo contenido
```

---

## Uso en el Frontend / Frontend Usage

### Página de Configuración / Settings Page

```typescript
// Cargar preferencias
const response = await fetch('/api/notifications/preferences');
const preferences = await response.json();

// Actualizar preferencias
await fetch('/api/notifications/preferences', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    promotionalOffers: true,
    teamUpdates: false,
    newVideoContent: true
  })
});
```

### Páginas Disponibles / Available Pages

- `/[lang]/settings/notifications` - Configuración principal
- `/[lang]/affiliate/[code]/settings/notifications` - Configuración de afiliado

---

## Triggers de Base de Datos / Database Triggers

### trigger_notify_team_member_added

Se ejecuta cuando se inserta un nuevo perfil con `referred_by`:

```sql
CREATE TRIGGER trigger_notify_team_member_added
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION notify_team_member_added();
```

La función verifica si el sponsor tiene notificaciones habilitadas y registra el evento.

---

## Plantillas de Email / Email Templates

### Team Member Added

```html
<h2>Great News, {sponsorName}!</h2>
<p><strong>{newMemberName}</strong> ({newMemberEmail}) has just joined your team.</p>
<p>This is a great opportunity to reach out and welcome them to the team.</p>
```

### New Video Content

```html
<h2>New Video Content Available!</h2>
<h3>{videoTitle}</h3>
<p>{videoDescription}</p>
<a href="{videoUrl}">Watch Now</a>
```

---

## Migraciones / Migrations

### Opción 1: Usar el schema completo (Recomendado para nuevas instalaciones)

El archivo `docs/database/full-schema.sql` ya incluye todas las tablas y triggers necesarios:

```bash
# Aplicar el schema completo (incluye notification_preferences)
psql -f docs/database/full-schema.sql
```

### Opción 2: Aplicar solo las migraciones de notificaciones (Para bases de datos existentes)

Si ya tienes una base de datos configurada, puedes aplicar solo las migraciones de notificaciones:

```bash
# 1. Crear tabla de preferencias
psql -f docs/database/migrations/create-notification-preferences-table.sql

# 2. Crear trigger de notificaciones
psql -f docs/database/migrations/create-team-notification-trigger.sql
```

**Nota:** El archivo `full-schema.sql` ha sido actualizado para incluir:
- Tabla `notification_preferences` con políticas RLS
- Función `notify_team_member_added()`
- Trigger `trigger_notify_team_member_added`
- Índices para optimización de consultas

---

## Testing

### Probar Notificación de Equipo / Test Team Notification

```typescript
await fetch('/api/notifications/team-member-added', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sponsorId: 'uuid-del-sponsor',
    newMemberId: 'uuid-del-nuevo-miembro'
  })
});
```

### Probar Mailchimp

```typescript
import { subscribeToMailchimp, unsubscribeFromMailchimp } from '@/lib/services/mailchimp-service';

// Suscribir
await subscribeToMailchimp({
  email: 'test@example.com',
  firstName: 'Test',
  tags: ['test']
});

// Desuscribir
await unsubscribeFromMailchimp({
  email: 'test@example.com'
});
```

---

## Seguridad / Security

- ✅ Row Level Security (RLS) habilitado en `notification_preferences`
- ✅ Los usuarios solo pueden ver/editar sus propias preferencias
- ✅ Las APIs verifican autenticación antes de procesar
- ✅ Los emails solo se envían a usuarios con preferencias habilitadas
- ✅ Mailchimp API key se mantiene en el servidor (no se expone al cliente)

---

## Próximos Pasos / Next Steps

1. **Implementar notificaciones de video**: Conectar con el sistema de gestión de videos
2. **Dashboard de notificaciones**: Panel para ver historial de notificaciones enviadas
3. **Plantillas personalizables**: Permitir a admins personalizar plantillas de email
4. **Notificaciones push**: Agregar soporte para notificaciones push en navegador
5. **Preferencias granulares**: Permitir configurar frecuencia de notificaciones

---

## Soporte / Support

Para problemas o preguntas:
- Revisar logs en consola del servidor
- Verificar configuración de Mailchimp
- Confirmar que RESEND_API_KEY está configurado para emails
- Revisar tabla `notification_preferences` en la base de datos

---

**Última actualización / Last updated:** 2025-10-22


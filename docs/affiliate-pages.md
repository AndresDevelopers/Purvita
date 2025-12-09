# Sistema de Páginas de Afiliado

## Descripción General

El sistema de páginas de afiliado permite que cada usuario con una suscripción activa tenga su propia **tienda online completa** para vender productos directamente. Los visitantes pueden comprar productos sin necesidad de registrarse primero, y todas las compras se rastrean automáticamente al afiliado dueño de la página, quien recibe comisiones según la configuración de `app-settings`.

Esta página se accede a través de un link único basado en el código de referido del usuario.

## Guía Rápida

### ¿Qué son las Páginas de Afiliado?

Las páginas de afiliado son páginas personalizadas que cada usuario con suscripción activa obtiene automáticamente para:
- Vender productos del catálogo
- Reclutar nuevos miembros con su código de referido pre-cargado
- Compartir en redes sociales y generar conversiones

### Cómo Obtener tu Página de Afiliado

**Paso 1: Activa tu Suscripción**
- Tener una suscripción activa (status = 'active')
- No estar en lista de espera (waitlisted = false)

**Paso 2: Configura tu Código de Referido**
- Ve a tu perfil: `/{lang}/profile`
- En la sección "Affiliate link", verás tu código de referido
- Puedes personalizarlo (4-32 caracteres, solo letras minúsculas, números y guiones)

**Paso 3: Copia tu Link de Afiliado**
```
https://tudominio.com/{lang}/affiliate/{tu-codigo-de-referido}
```

Ejemplos:
- `https://app.com/en/affiliate/john-smith-abc123`
- `https://app.com/es/affiliate/maria-garcia-xyz789`

## Características Principales

### 1. Requisitos para Tener una Página Activa

Para que un usuario tenga una página de afiliado activa, debe cumplir:

1. **Tener un código de referido configurado** en su perfil
2. **Tener una suscripción activa** (`status = 'active'`)
3. **No estar en lista de espera** (`waitlisted = false`)

Si alguna de estas condiciones no se cumple, la página mostrará un error 404 personalizado.

### 2. Contenido de la Página de Afiliado

La página de afiliado es una **tienda online completa** que incluye:

#### Sección Hero
- Avatar del afiliado (iniciales si no hay imagen)
- Nombre del afiliado
- Mensaje de bienvenida personalizado
- Badge con el código de referido

#### Sección de Productos (Tienda Completa)
- Grid responsive de productos (2 columnas en móvil, 3 en tablet, 4 en desktop)
- Muestra los primeros 6 productos por defecto
- Botón "Ver Más Productos" si hay más de 6
- Usa el componente `ProductCard` existente con funcionalidad completa de compra
- Los visitantes pueden:
  - Ver detalles de productos
  - Agregar productos al carrito
  - Comprar directamente sin registrarse
- Mensaje de "No hay productos" si el catálogo está vacío

#### Rastreo Automático de Referidos
- Cuando un visitante accede a la página de afiliado, su código de referido se guarda automáticamente en localStorage
- El código se mantiene por 30 días (como una cookie)
- Todas las compras realizadas durante ese período se atribuyen al afiliado
- El afiliado recibe comisiones según la configuración de `app-settings`

### 3. Header de Afiliado

Las páginas de tienda de afiliado incluyen un **header similar al de la página principal**:

**Funcionalidades Incluidas:**
- ✅ Logo y branding de la aplicación
- ✅ Icono de carrito (solo para usuarios autenticados)
- ✅ Menú de usuario (perfil, settings, logout)
- ✅ Selector de idioma
- ✅ Navegación móvil responsive

**NO Incluye:**
- ❌ Descuentos por fase
- ❌ Navegación de fases
- ❌ Promociones especiales de la tienda principal

**Carrito de Compras:**
- Solo visible para usuarios autenticados
- Requiere que el país del usuario esté permitido para compras
- Redirige a `/[lang]/cart`
- Las compras se atribuyen al afiliado (metadata incluye `affiliateId`)

**Botón de Register:**
- Incluye automáticamente el código de referido del afiliado
- URL: `/auth/login?affiliateCode=ABC123&redirect=/es/affiliate/ABC123`

### 4. Contexto de Afiliado

El sistema mantiene el **contexto de afiliado** a través de diferentes páginas:

**Páginas con Header de Afiliado (cuando hay contexto):**
- Tienda de afiliado: `/es/affiliate/ABC123`
- Producto de afiliado: `/es/affiliate/ABC123/product/slug`
- Carrito: `/es/cart` (si hay contexto)
- Checkout: `/es/checkout` (si hay contexto)
- Login: `/es/auth/login?affiliateCode=...` (si hay contexto)

**Almacenamiento de Contexto:**
```typescript
interface AffiliateContext {
  affiliateCode: string;  // Código del afiliado
  timestamp: number;      // Timestamp de cuando se guardó
}
```
- **Ubicación**: localStorage con clave `affiliate_context`
- **Duración**: 1 hora (3600000 ms)
- **Limpieza**: Automática cuando expira

### 5. Settings y Profile para Afiliados

Versiones específicas de Settings y Profile para el contexto de afiliado:

**Settings de Afiliado** (`/[lang]/affiliate/[code]/settings`):
- ✅ Profile, Password, Notifications, Privacy, Language, Theme
- ❌ NO incluye: Marketing, Subscription

**Profile de Afiliado** (`/[lang]/affiliate/[code]/profile`):
- ✅ Overview, Balance, Settings
- ❌ NO incluye: MLM Network, Team Messages, Phase Rewards, Referral Settings

**Menú de Usuario para Afiliados:**
- 🏪 My Store → `/[lang]/affiliate/[code]`
- 👤 Profile → `/[lang]/affiliate/[code]/profile`
- ⚙️ Settings → `/[lang]/affiliate/[code]/settings`
- 🚪 Logout

## Arquitectura Técnica

### Estructura de Archivos

```
src/app/[lang]/affiliate/[referralCode]/
├── page.tsx                    # Componente servidor (validación y carga de datos)
├── affiliate-page-client.tsx   # Componente cliente (UI interactiva)
├── not-found.tsx              # Página 404 personalizada
├── settings/
│   └── page.tsx               # Settings específicos para afiliados
├── profile/
│   └── page.tsx               # Profile específico para afiliados
└── product/
    └── [slug]/
        └── page.tsx           # Página de producto con contexto de afiliado
```

### Flujo de Datos

1. **Server Component** (`page.tsx`):
   - Recibe el `referralCode` de los parámetros de la URL
   - Resuelve el sponsor usando `ReferralService`
   - Verifica la suscripción activa del sponsor
   - Carga los productos del catálogo
   - Si todo es válido, pasa los datos al componente cliente
   - Si no es válido, muestra `notFound()`

2. **Client Component** (`affiliate-page-client.tsx`):
   - Renderiza la UI con los datos del sponsor y productos
   - Maneja interacciones del usuario (scroll, mostrar más productos)
   - Guarda el contexto de afiliado en localStorage
   - Redirige al registro con el código de referido pre-cargado

3. **Contexto de Afiliado** (localStorage):
   - Se guarda automáticamente al visitar la página
   - Expira después de 1 hora
   - Se usa en header, carrito, checkout, login

### Servicios Utilizados

```typescript
// Resolver sponsor y validar código
const { service } = createReferralModule();
const sponsor = await service.resolveSponsor(referralCode);

// Verificar suscripción activa
const subscriptionRepo = new SubscriptionRepository(supabase);
const subscription = await subscriptionRepo.findByUserId(sponsor.sponsorId);
const hasActiveSubscription = subscription?.status === 'active' && !subscription.waitlisted;

// Cargar productos
const { repository: productRepo } = createProductModule();
const products = await productRepo.list();
```

### Helpers de Contexto

```typescript
// src/lib/helpers/affiliate-context-helper.ts

// Guardar contexto de afiliado
export function saveAffiliateContext(affiliateCode: string): void {
  const context: AffiliateContext = {
    affiliateCode,
    timestamp: Date.now(),
  };
  localStorage.setItem('affiliate_context', JSON.stringify(context));
}

// Obtener contexto de afiliado
export function getAffiliateContext(): AffiliateContext | null {
  const stored = localStorage.getItem('affiliate_context');
  if (!stored) return null;

  const context: AffiliateContext = JSON.parse(stored);
  const now = Date.now();
  const oneHour = 3600000; // 1 hora en ms

  // Verificar si expiró
  if (now - context.timestamp > oneHour) {
    clearAffiliateContext();
    return null;
  }

  return context;
}

// Limpiar contexto de afiliado
export function clearAffiliateContext(): void {
  localStorage.removeItem('affiliate_context');
}
```

## Integración con el Sistema de Referidos

### Link de Afiliado en el Perfil

El componente `ReferralSettingsForm` genera el link de afiliado usando la ruta de afiliado:

```typescript
// Link de afiliado
`${baseUrl}/${lang}/affiliate/${encodeURIComponent(shareCode)}`

// Ejemplo:
// https://app.com/es/affiliate/maria-garcia-xyz789
```

### Flujo de Registro desde Página de Afiliado

1. Usuario visita `/{lang}/affiliate/{referralCode}`
2. El sistema guarda el contexto de afiliado en localStorage
3. Usuario hace clic en "Únete Ahora" o "Registrarse Ahora"
4. Es redirigido a `/{lang}/auth/login?affiliateCode={referralCode}&redirect=/es/affiliate/{referralCode}`
5. El formulario de registro detecta el parámetro `affiliateCode` y pre-carga el código
6. Al registrarse, el nuevo usuario queda automáticamente vinculado al sponsor
7. Después del registro, es redirigido de vuelta a la página de afiliado

### Flujo de Compra desde Página de Afiliado

1. Visitante accede a `/{lang}/affiliate/{referralCode}`
2. El sistema guarda el contexto de afiliado en localStorage
3. Visitante navega a productos y agrega al carrito
4. El header detecta el contexto de afiliado y muestra el logo/branding apropiado
5. Al hacer checkout, el sistema incluye `affiliateId` en los metadatos de la orden
6. El afiliado recibe comisiones automáticamente según `app-settings`

## Traducciones

### Claves de Diccionario

Todas las traducciones están en `dict.affiliate`:

```typescript
{
  welcomeTitle: "Welcome to {{name}}'s Store",
  welcomeSubtitle: "Discover amazing products and join our community",
  joinNow: "Join Now",
  viewProducts: "View Products",
  referralCode: "Referral Code",
  productsTitle: "Featured Products",
  productsSubtitle: "Browse our selection of quality products",
  showMore: "Show More Products",
  noProducts: "No products available",
  noProductsDescription: "Check back soon for new products",
  joinCtaTitle: "Ready to Get Started?",
  joinCtaDescription: "Join our community and start enjoying exclusive benefits",
  step1Title: "Sign Up",
  step1Description: "Create your free account",
  step2Title: "Shop",
  step2Description: "Browse and purchase products",
  step3Title: "Grow",
  step3Description: "Build your network",
  registerButton: "Register Now",
  alreadyMember: "Already a member?",
  signIn: "Sign in",
}
```

### Idiomas Soportados

- **Inglés** (`en`): Definido en `src/i18n/dictionaries/default.ts`
- **Español** (`es`): Definido en `src/i18n/dictionaries/locales/es.ts`

## Casos de Uso

### Caso 1: Usuario Activo Comparte su Link

1. María tiene una suscripción activa y código de referido `maria-garcia-xyz`
2. Copia su link de afiliado desde su perfil: `https://app.com/es/affiliate/maria-garcia-xyz`
3. Comparte el link en redes sociales
4. Los visitantes ven su página personalizada con productos
5. Pueden registrarse directamente desde ahí con su código pre-cargado
6. Pueden comprar productos y María recibe comisiones automáticamente

### Caso 2: Usuario sin Suscripción Activa

1. Juan cancela su suscripción
2. Su link de afiliado `https://app.com/en/affiliate/juan-smith-abc` deja de funcionar
3. Los visitantes ven la página 404 personalizada
4. Pueden ir al home o registrarse sin código de referido

### Caso 3: Código de Referido Inválido

1. Alguien intenta acceder a `https://app.com/en/affiliate/codigo-falso`
2. El sistema no encuentra ningún usuario con ese código
3. Se muestra la página 404 personalizada

### Caso 4: Visitante Compra desde Tienda de Afiliado

1. Pedro visita `https://app.com/es/affiliate/maria-garcia-xyz`
2. El sistema guarda el contexto de afiliado en localStorage
3. Pedro navega a un producto y lo agrega al carrito
4. El header muestra el branding de la aplicación (sin descuentos de fase)
5. Pedro hace checkout y paga
6. El sistema crea la orden con metadata:
   ```json
   {
     "affiliateId": "maria-user-id",
     "saleChannel": "affiliate_store"
   }
   ```
7. María recibe comisiones automáticamente:
   - **Ecommerce Earnings**: 30% (si está en Phase 2)
   - Sus patrocinadores reciben **Group Gain** adicional
   - Sus patrocinadores reciben **comisiones MLM** por nivel

### Caso 5: Usuario Registrado Compra desde Tienda de Afiliado

1. Carlos (ya registrado) visita `https://app.com/es/affiliate/maria-garcia-xyz`
2. El sistema guarda el contexto de afiliado
3. Carlos hace login desde el header
4. Carlos compra productos
5. María recibe comisiones solo si Carlos está en su red
6. Si Carlos NO está en la red de María, las comisiones van a su sponsor original

## Seguridad y Validaciones

### Validaciones del Servidor

1. **Código de referido válido**: Debe existir en la base de datos
2. **Suscripción activa**: `status = 'active' AND waitlisted = false`
3. **Encoding de URL**: El código se codifica con `encodeURIComponent`
4. **Contexto de afiliado**: Expira después de 1 hora
5. **Metadata de orden**: Incluye `affiliateId` y `saleChannel` para rastreo

### Manejo de Errores

- Errores de base de datos se capturan y se muestra 404
- Códigos inválidos retornan 404
- Usuarios sin suscripción retornan 404
- Contexto expirado se limpia automáticamente

### Row Level Security (RLS)

```sql
-- Los usuarios solo pueden ver sus propias páginas de afiliado
CREATE POLICY "affiliate_pages_read_self"
ON profiles
FOR SELECT
USING (
  auth.uid() = id
  OR referral_code IS NOT NULL
);

-- Solo el service_role puede modificar metadata de órdenes
CREATE POLICY "orders_metadata_service_role"
ON orders
FOR UPDATE
USING (auth.role() = 'service_role');
```

## Mejoras Futuras Sugeridas

1. **Analytics**: Rastrear visitas a páginas de afiliado
2. **Personalización**: Permitir al usuario personalizar su mensaje de bienvenida
3. **Productos destacados**: Permitir al afiliado elegir qué productos mostrar
4. **Estadísticas**: Mostrar al afiliado cuántas visitas y conversiones tiene
5. **Imagen de perfil**: Permitir subir avatar personalizado
6. **Tema personalizado**: Permitir elegir colores de la página
7. **Testimonios**: Permitir agregar testimonios de clientes
8. **Compartir en redes**: Botones para compartir en Facebook, Twitter, WhatsApp
9. **QR Code**: Generar código QR para compartir offline
10. **Email marketing**: Permitir enviar emails a leads capturados

## Referencias de Código

### Archivos Principales
- `src/app/[lang]/affiliate/[referralCode]/page.tsx` - Página principal de afiliado
- `src/app/[lang]/affiliate/[referralCode]/affiliate-page-client.tsx` - Cliente de página de afiliado
- `src/app/[lang]/affiliate/[referralCode]/settings/page.tsx` - Settings de afiliado
- `src/app/[lang]/affiliate/[referralCode]/profile/page.tsx` - Profile de afiliado
- `src/app/[lang]/affiliate/[referralCode]/product/[slug]/page.tsx` - Producto con contexto
- `src/modules/referrals/ui/referral-settings-form.tsx` - Formulario de configuración de referidos
- `src/i18n/dictionaries/default.ts` - Traducciones en inglés
- `src/i18n/dictionaries/locales/es.ts` - Traducciones en español

### Servicios y Repositorios
- `src/modules/referrals/services/referral-service.ts` - Servicio de referidos
- `src/modules/multilevel/repositories/subscription-repository.ts` - Repositorio de suscripciones
- `src/modules/products/factories/product-module.ts` - Factory de productos
- `src/modules/multilevel/services/seller-commission-service.ts` - Comisiones de vendedor
- `src/modules/multilevel/services/commission-calculator-service.ts` - Cálculo de comisiones MLM

### Helpers
- `src/lib/helpers/affiliate-context-helper.ts` - Helpers de contexto de afiliado
- `src/lib/helpers/settings-helper.ts` - Helpers de configuración

### Componentes UI
- `src/app/components/product-card.tsx` - Tarjeta de producto
- `src/app/components/header.tsx` - Header principal
- `src/app/components/affiliate-header.tsx` - Header de afiliado
- `src/components/ui/card.tsx` - Componente de tarjeta
- `src/components/ui/button.tsx` - Componente de botón
- `src/components/ui/badge.tsx` - Componente de badge
- `src/components/ui/avatar.tsx` - Componente de avatar

## Troubleshooting

### La página de afiliado muestra 404

**Posibles causas:**
1. El código de referido no existe en la base de datos
2. El usuario no tiene suscripción activa
3. El usuario está en lista de espera (waitlisted = true)

**Solución:**
```sql
-- Verificar código de referido
SELECT id, referral_code, email
FROM profiles
WHERE referral_code = 'codigo-a-verificar';

-- Verificar suscripción
SELECT status, waitlisted
FROM subscriptions
WHERE user_id = 'user-id-del-afiliado';
```

### El contexto de afiliado no se guarda

**Posibles causas:**
1. localStorage está deshabilitado en el navegador
2. El contexto expiró (más de 1 hora)
3. Error de JavaScript en el cliente

**Solución:**
1. Verificar que localStorage está habilitado
2. Revisar la consola del navegador para errores
3. Verificar que `affiliate-context-helper.ts` está importado correctamente

### Las comisiones no se atribuyen al afiliado

**Posibles causas:**
1. La metadata de la orden no incluye `affiliateId`
2. El `saleChannel` no es `'affiliate_store'`
3. El afiliado no tiene suscripción activa

**Solución:**
```sql
-- Verificar metadata de la orden
SELECT
  id,
  metadata->>'affiliateId' as affiliate_id,
  metadata->>'saleChannel' as sale_channel
FROM orders
WHERE id = 'order-id';

-- Verificar comisiones generadas
SELECT *
FROM network_commissions
WHERE metadata->>'order_id' = 'order-id';
```

### El header no muestra el contexto de afiliado

**Posibles causas:**
1. El contexto expiró
2. El componente no está usando `getAffiliateContext()`
3. El header no está usando `AffiliateHeader`

**Solución:**
1. Verificar que el contexto está guardado en localStorage
2. Verificar que el componente importa y usa `getAffiliateContext()`
3. Verificar que se está usando el componente correcto según el contexto


# Arquitectura Técnica - PūrVita Network

PūrVita es una plataforma MLM (Multi-Level Marketing) con capacidades de e-commerce construida con Next.js 15.5.6, React 19, TypeScript 5 y Supabase. La aplicación sigue el patrón **MVCS (Model-View-Controller-Service)** organizado por funcionalidad (feature-first) para máxima modularidad y mantenibilidad.

## Stack Tecnológico

### Core Framework
- **Next.js 15.5.6** con App Router y React Server Components
- **React 19.2.0** con React DOM
- **TypeScript 5** con modo estricto habilitado
- **Node.js 22.x** (versión de motor requerida)

### UI & Styling
- **Tailwind CSS 3.4** con tokens de diseño personalizados
- **ShadCN UI** (primitivos de Radix UI)
- **Lucide React** para iconos
- **next-themes** para modo oscuro/claro
- **tailwindcss-animate** para animaciones

### Backend & Data
- **Supabase** para autenticación, base de datos PostgreSQL y storage
- **@supabase/ssr** para autenticación server-side
- **Zod** para validación de esquemas y type safety
- **Upstash Redis** para caché y rate limiting

### Pagos & Servicios Externos
- **Stripe** para procesamiento de pagos y suscripciones
- **PayPal** para pagos alternativos
- **Resend** para emails transaccionales
- **Mailchimp** para automatización de marketing

### Observabilidad
- **Sentry** para tracking de errores (client, server y edge)
- **Vercel Analytics** y Speed Insights

## Estructura del Proyecto

```
├── src/                    # Código fuente de la aplicación
│   ├── app/               # Next.js App Router (rutas, layouts, páginas)
│   │   ├── [lang]/       # Rutas internacionalizadas (es/en)
│   │   ├── admin/        # Rutas exclusivas de admin
│   │   └── api/          # API route handlers
│   ├── components/       # Componentes React compartidos
│   │   └── ui/          # Primitivos de ShadCN UI
│   ├── contexts/        # React Context providers
│   ├── hooks/           # Hooks reutilizables
│   ├── i18n/            # Internacionalización
│   │   └── dictionaries/ # Archivos de traducción (es/en)
│   ├── lib/             # Utilidades y servicios core
│   │   ├── models/      # Esquemas Zod y definiciones de tipos
│   │   ├── services/    # Lógica de negocio y acceso a datos
│   │   ├── supabase/    # Configuraciones de cliente Supabase
│   │   └── utils.ts     # Funciones utilitarias
│   └── modules/         # Organización feature-first (MVCS)
│       └── <feature>/
│           ├── domain/      # Tipos y modelos
│           ├── services/    # Acceso a datos y lógica de negocio
│           ├── controllers/ # Capa de coordinación
│           ├── view-models/ # Transformación de datos
│           ├── views/       # Componentes de presentación
│           └── hooks/       # Hooks específicos del feature
├── docs/                  # Documentación completa
├── supabase/             # Migraciones y edge functions
├── scripts/              # Scripts de utilidad
├── public/               # Assets estáticos
├── testsprite_tests/     # Suite de tests E2E
└── types/                # Declaraciones TypeScript globales
```

## Patrón MVCS Feature-First

El código se organiza por funcionalidad dentro de `src/modules/<feature>` siguiendo un flujo **Model-View-Controller-Service** explícito:

### Capas del Patrón

- **Models** (`src/lib/models`, `src/modules/*/domain`): 
  - Tipos de dominio y esquemas Zod
  - Definiciones de interfaces y contratos
  - Factorías que habilitan inyección de dependencias

- **Services** (`src/lib/services`, `src/modules/*/services`):
  - Encapsulan acceso a datos (Repository Pattern)
  - Lógica de negocio y reglas cross-cutting
  - Integración con APIs externas (Stripe, PayPal, Mailchimp)

- **Controllers** (`src/modules/*/controllers`):
  - Coordinan hooks, servicios y view models
  - Deciden ejecución server-side o client-side
  - Entregan props tipadas a las vistas

- **View Models** (`src/modules/*/view-models`):
  - Transformaciones puras de datos
  - Preparan datos serializables para la UI
  - Formateo y cálculos de presentación

- **Views** (`src/modules/*/views`):
  - Componentes de presentación sin efectos secundarios
  - Reciben props tipadas desde controladores
  - Enfoque en UX y accesibilidad

### Reglas Operativas

1. **Separación de Responsabilidades**: Las vistas nunca llaman servicios directamente
2. **Server/Client Strategy**: Los controladores deciden dónde ejecutarse según requisitos
3. **Hooks de Dominio**: Encapsulan estado/efectos compartidos dentro del feature
4. **Servicios Compartidos**: Permanecen en `src/lib/services` para reutilización
5. **Páginas Delgadas**: `src/app/**/page.tsx` solo importan controladores del módulo

## Características Principales del Producto

### Sistema MLM (Multi-Level Marketing)

- **Referral System**: Códigos de referido únicos por usuario
- **Network Tree**: Árbol genealógico hasta 10 niveles de profundidad
- **Phase System**: Sistema de fases automático (0-3) basado en crecimiento de red
- **Commission Tracking**: Seguimiento de comisiones multinivel

### Sistema de Comisiones

1. **Ecommerce Earnings (%)**: Ganancia personal del vendedor en tienda de afiliado
2. **Group Gain (%)**: Ganancia adicional para patrocinadores en ventas de red
3. **MLM Commissions**: Montos fijos por nivel en compras de la red
4. **Subscription Commissions**: Comisiones cuando miembros pagan suscripción

### E-commerce

- **Product Catalog**: Catálogo con carrito, checkout y gestión de órdenes
- **Affiliate Stores**: Tiendas personalizadas por usuario con branding propio
- **Payment Processing**: Stripe, PayPal y Wallet interno
- **Order Fulfillment**: Sistema de seguimiento de pedidos y warehouse tracking

### Subscriptions & Wallet

- **Monthly Subscriptions**: Suscripciones mensuales con múltiples gateways
- **Internal Wallet**: Sistema de monedero para comisiones y pagos
- **Automatic Payouts**: Pagos automáticos configurables
- **Recharge System**: Recarga manual con múltiples métodos

## Convenciones de Código

### Routing

- **Rutas Internacionalizadas**: `app/[lang]/` para páginas específicas de locale (español primario, inglés secundario)
- **Rutas Admin**: `app/admin/` para funcionalidades administrativas (bypass i18n middleware)
- **API Routes**: `app/api/` para endpoints REST y webhooks
- **Async Params**: Las páginas reciben `params` como `Promise` (convención Next.js 15.5.6)

### Componentes

- **Server Components**: Por defecto para páginas y layouts
- **Client Components**: Marcados con directiva `'use client'`
- **UI Components**: En `components/ui/` (generados vía ShadCN CLI)
- **Shared Components**: En `components/` root
- **Feature Components**: En `modules/<feature>/views/`

### Service Layer

- **Shared Services**: `src/lib/services/` para concerns cross-cutting
- **Feature Services**: `src/modules/<feature>/services/` para lógica específica de dominio
- **Repository Pattern**: Servicios encapsulan acceso a datos con interfaces
- **Factory Pattern**: Inyección de dependencias vía funciones factory
- **Admin Client**: Usa `SUPABASE_SERVICE_ROLE_KEY` para operaciones privilegiadas

### Data Models

- **Zod Schemas**: Definidos en `src/lib/models/definitions.ts`
- **Type Inference**: Tipos TypeScript derivados de esquemas Zod
- **Runtime Validation**: Validación en cliente y servidor
- **Shared Contracts**: Mismos esquemas en frontend y backend

## Internacionalización (i18n)

### Configuración

- **Locales Soportados**: Español (es) - primario, Inglés (en) - secundario
- **Dictionary Files**: `src/i18n/dictionaries/locales/{es,en}.ts`
- **Default Fallback**: `src/i18n/dictionaries/default.ts` asegura traducciones completas
- **Middleware**: Redirige a `/en` si no hay locale especificado
- **Language Switcher**: Disponible en componente header

### Implementación

```typescript
// src/i18n/dictionaries.ts
export async function getDictionary(locale: string) {
  const defaultDict = await import('./dictionaries/default');
  const localeDict = await import(`./dictionaries/locales/${locale}`);
  return { ...defaultDict.default, ...localeDict.default };
}
```

## Base de Datos y Migraciones

### Supabase PostgreSQL

- **Full Schema**: `docs/database/database.sql` (ejecutar como transacción única)
- **Verification Suite**: `docs/database/verification-suite.sql` para health checks
- **RLS Policies**: Row-level security aplicado en todas las tablas
- **Migrations**: Archivos SQL timestamped en `supabase/migrations/`

### Tablas Principales

- `profiles`: Usuarios y perfiles con referral system
- `subscriptions`: Estado de suscripciones
- `orders` & `order_items`: Órdenes de e-commerce
- `products`: Catálogo de productos
- `wallets` & `wallet_txns`: Sistema de monedero interno
- `network_commissions`: Comisiones MLM
- `phases` & `phase_levels`: Sistema de fases configurables
- `payments` & `payment_methods`: Historial de pagos

## Seguridad

### Autenticación y Autorización

- **Supabase Auth**: Sistema de autenticación completo
- **RLS Policies**: Políticas a nivel de fila en todas las tablas
- **Role-Based Access**: Roles `member` y `admin`
- **Admin Guards**: Componentes que protegen rutas administrativas
- **Service Role**: Cliente admin para operaciones privilegiadas

### Validación y Sanitización

- **Input Validation**: Zod schemas en cliente y servidor
- **Output Encoding**: Escapado de salida hacia usuario
- **CSRF Protection**: Tokens CSRF en middleware
- **Rate Limiting**: Límites de requests por usuario/IP vía Upstash Redis

### Headers de Seguridad

- **CSP**: Content Security Policy configurado
- **HSTS**: HTTP Strict Transport Security
- **X-Frame-Options**: Protección contra clickjacking
- **CORS**: Política restrictiva de CORS

## Caché y Performance

### Sistema de Caché de Dos Niveles

1. **Cloudflare CDN**: Cachea assets estáticos y páginas públicas en el edge
2. **Redis (Upstash)**: Cachea datos de configuración y sesiones en servidor

### Estrategias por Tipo de Contenido

- **Assets Estáticos**: Cache largo (31536000s) en Cloudflare
- **Páginas Públicas**: Cache corto con revalidación
- **Contenido Dinámico**: No-cache, personalizado por usuario
- **API Responses**: Cache selectivo según endpoint

## Testing

### Herramientas

- **Vitest**: Unit tests con coverage reporting
- **Puppeteer**: E2E testing
- **@vitest/coverage-v8**: Code coverage

### Comandos

```bash
npm run test              # Ejecutar tests con coverage
npm run typecheck         # TypeScript type checking
npm run lint              # ESLint
```

## Observabilidad

### Error Tracking

- **Sentry**: Tracking de errores en client, server y edge
- **Error Boundaries**: Componentes que encapsulan fallos de UI
- **Structured Logging**: Logs estructurados y searchables

### Monitoring

- **Vercel Analytics**: Métricas de uso y performance
- **Speed Insights**: Core Web Vitals
- **Audit Logs**: Registro de acciones críticas en `audit_logs` table

## Deployment

### Entornos

- **Development**: `npm run dev` (puerto 9000 con Turbopack)
- **Production**: `npm run build && npm start`
- **Vercel**: Deploy automático desde main branch

### Variables de Entorno

Ver `docs/environment-variables.md` para lista completa. Principales:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `PAYPAL_CLIENT_ID`
- `UPSTASH_REDIS_REST_URL`

## Path Aliases

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Uso: `import { Button } from '@/components/ui/button'`

## Naming Conventions

- **Files**: kebab-case (`user-service.ts`, `product-card.tsx`)
- **Components**: PascalCase (`UserProfile`, `ProductCard`)
- **Functions**: camelCase (`getUserProfile`, `calculateCommission`)
- **Constants**: UPPER_SNAKE_CASE (`PRODUCTS_BUCKET`, `API_RATE_LIMIT`)
- **Types/Interfaces**: PascalCase (`UserProfile`, `ProductSchema`)

## Import Patterns

```typescript
// Orden de imports
// 1. External
import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// 2. Internal (usando alias @/)
import { Button } from '@/components/ui/button';
import { getUserProfile } from '@/lib/services/user-service';

// 3. Relative (solo dentro del mismo módulo)
import { UserCard } from './user-card';
```

## Puntos de Extensión

### Próximas Mejoras

- **Circuit Breakers**: Agregar wrappers en servicios para llamadas externas
- **Cache Warming**: Pre-calentar caché de datos frecuentes
- **GraphQL Layer**: Considerar GraphQL para queries complejas
- **Real-time Features**: Aprovechar Supabase Realtime para notificaciones
- **Mobile App**: React Native usando misma API

### Integraciones Pendientes

- **SMS Notifications**: Twilio para notificaciones SMS
- **Advanced Analytics**: Mixpanel o Amplitude
- **A/B Testing**: Framework de experimentación
- **CDN Assets**: Migrar assets a CDN dedicado

## Referencias de Código

### Archivos Clave

- `src/app/[lang]/dashboard/page.tsx` - Dashboard principal
- `src/app/admin/layout.tsx` - Layout administrativo
- `src/lib/supabase/server.ts` - Cliente Supabase server-side
- `src/modules/multilevel/services/commission-calculator-service.ts` - Cálculo de comisiones
- `src/modules/payments/services/payment-flow-service.ts` - Flujo de pagos
- `middleware.ts` - Middleware de i18n y seguridad
- `next.config.ts` - Configuración de Next.js

### Documentación Relacionada

- [Sistema de Comisiones](commission-system.md)
- [Sistema de Pagos](payment-system.md)
- [Sistema de Fases](phase-system.md)
- [Guía de Admin](admin-guide.md)
- [Sistema de Caché](caching-system.md)
- [Modelos de Datos](data-models.md)

# Documentación de PūrVita Network

Bienvenido al centro de documentación técnica del proyecto. Cada archivo está pensado para cubrir un tema específico sin repetir información ya incluida en otro documento.

## Mapa Rápido

### Documentación General

- [Panorama del producto](project-overview.md)
- [Configuración e instalación](setup.md)
- **[Arquitectura técnica](architecture.md)** - MVCS, feature-first, internacionalización y patrones
- [Plan de oportunidad](architecture/opportunity-plan.md)
- [Modelos de datos](data-models.md)
- [Guía de base de datos](database/README.md)
- [Estado y dependencias de migraciones](MIGRATIONS_STATUS.md)
- [Seguridad y cumplimiento](security.md)
- [Resolución de problemas](troubleshooting.md)
- [Variables de entorno](environment-variables.md)
- **[Sistema de Caché](caching-system.md)** - Redis, Cloudflare, estrategias y configuración completa

### Sistemas Principales

- **[Sistema de Comisiones MLM](commission-system.md)** - Comisiones multinivel, ecommerce earnings, group gain y suscripciones
- **[Sistema de Fases](phase-system.md)** - Cálculo automático, preservación en reactivación y recalculación en cascada
- **[Sistema de Facturas](invoices-system.md)** - Historial de órdenes, facturas de suscripción y seguimiento de pedidos
- **[Checkout y Pasarelas de Pago](payment-system.md)** - Stripe/PayPal, retorno al origen y pruebas administradas
- **[Sistema de Pagos Automáticos](payout-system.md)** - Pagos automáticos, Stripe Connect, PayPal y transferencias a wallet
- **[Páginas de Afiliado](affiliate-pages.md)** - Tiendas personalizadas, contexto de afiliado, cart y checkout

### Administración

- **[Guía para Administradores](admin-guide.md)** - Panel completo de administración, impersonación y edición de fases
- [Configuración de correos de contacto](contact-email-setup.md)
- [Sistema de Mailchimp](mailchimp-system.md)
- [Operaciones de billetera y recargas](wallet-operations.md)

### Referencia Técnica

- [Referencia de API](api-reference.md)
- [Archivo de órdenes](ARCHIVED_ORDERS_FEATURE.md)

## Resumen Express de SQL

| Archivo | Propósito principal |
| --- | --- |
| `database/database.sql` | Provisiona el estado completo de la base de datos (tablas, RLS, triggers, índices y migraciones históricas) |
| `database/verification-suite.sql` | Suite de consultas para validar tablas, datos, vistas y políticas |

## Estructura de Documentación

### Por Sistema

**Sistema de Comisiones:**

- `commission-system.md` - Documentación completa consolidada
- Cubre: Ecommerce Earnings, Group Gain, MLM Compras, MLM Suscripciones
- `GUIDE_CASCADE_PHASE_SYSTEM.md` - Cómo reinstalar/verificar el recalculo en cascada de fases

**Checkout y Pasarelas de Pago:**

- `payment-system.md` - Documentación consolidada de checkout, retornos y pruebas Stripe/PayPal
- Cubre: Generación de URLs de retorno, `/payment/result`, panel `/admin/pays`, endpoints de prueba

**Sistema de Pagos Automáticos:**

- `payout-system.md` - Documentación completa consolidada
- Cubre: Pagos automáticos, Stripe Connect, PayPal, transferencias a wallet

**Sistema de Afiliados:**

- `affiliate-pages.md` - Documentación completa consolidada
- Cubre: Tiendas personalizadas, contexto, header, settings, profile

**Panel de Administración:**

- `admin-guide.md` - Guía completa consolidada
- Cubre: Dashboard, usuarios, productos, bodega, impersonación, edición de fases

**Mailchimp:**

- `mailchimp-system.md` - Configuración de entorno, waitlist en mantenimiento y suscripción en registro
- Cubre: Variables de entorno, campos del panel admin, API `mailchimp-subscribe`, troubleshooting y seguridad

### Archivos Eliminados (Consolidados)

Los siguientes archivos fueron consolidados en los documentos principales:

**Checkout (ahora en `payment-system.md`):**

- ~~payment-return-flow.md~~
- ~~payment-testing-guide.md~~

**Pagos automáticos (ahora en `payout-system.md`):**

- ~~AUTO_PAYOUT_IMPLEMENTATION.md~~
- ~~auto-payout-system.md~~
- ~~PAYOUT_ARCHITECTURE.md~~
- ~~CAMBIOS_PAGO_AUTOMATICO.md~~
- ~~DYNAMIC_PAYMENT_CONFIGURATION.md~~

**Comisiones (ahora en `commission-system.md`):**

- ~~COMMISSION_SYSTEM_SUMMARY.md~~
- ~~MLM_COMMISSION_SYSTEM.md~~
- ~~SUBSCRIPTION_COMMISSION_SYSTEM.md~~
- ~~SUBSCRIPTION_COMMISSION_RULES.md~~
- ~~SUBSCRIPTION_COMMISSIONS_FINAL_SUMMARY.md~~
- ~~SUBSCRIPTION_COMMISSIONS_README.md~~
- ~~ECOMMERCE_EARNINGS_AND_GROUP_GAIN.md~~
- ~~COMISION_ECOMMERCE_GLOBAL.md~~
- ~~code-review-commission-service.md~~

**Afiliados (ahora en `affiliate-pages.md`):**

- ~~AFFILIATE_CONTEXT_FLOW.md~~
- ~~AFFILIATE_PAGES_QUICKSTART.md~~
- ~~AFFILIATE_SETTINGS_PROFILE.md~~
- ~~AFFILIATE_STORE_HEADER.md~~
- ~~AFFILIATE_STORE_SUBSCRIPTION_REQUIREMENT.md~~

**Admin (ahora en `admin-guide.md`):**

- ~~ADMIN_IMPERSONATE_AUTO_DETECTION.md~~
- ~~ADMIN_PHASE_REWARDS_EDIT.md~~
- ~~guide-admin.md~~ (mensajería masiva)
- ~~INTEGRACION_ADMIN_PHASE.md~~
- ~~VERIFICACION_ADMIN_PHASE.md~~

**Fases y Recompensas (ahora en `admin-guide.md`):**

- ~~PHASE_REWARDS_DISCOUNT_SYSTEM.md~~
- ~~PHASE_REWARDS_TRANSFER.md~~
- ~~DYNAMIC_PHASE_LEVELS_CONFIGURATION.md~~
- ~~PRODUCT_PHASE_DISCOUNT_IMPLEMENTATION.md~~
- ~~SUBSCRIPTION_DISCOUNT_IMPLEMENTATION.md~~
- ~~VERIFICACION_DESCUENTO_SUSCRIPCION.md~~
- ~~VISTA_PREVIA_RECOMPENSAS.md~~
- ~~INSTRUCCIONES_TRANSFERENCIA_RECOMPENSAS.md~~
- ~~COMPORTAMIENTO_GRANT_REWARD.md~~

**Sistema Multinivel (ahora en `commission-system.md`):**

- ~~MULTILEVEL_IMPLEMENTATION_GUIDE.md~~
- ~~DYNAMIC_MULTILEVEL_SYSTEM.md~~

**Configuración (ahora en documentos específicos):**

- ~~CENTRALIZED_CONFIGURATION.md~~
- ~~DYNAMIC_PRICING.md~~
- ~~CODE_IMPROVEMENTS_PHASE_CONFIG.md~~

**Mailchimp (ahora en `mailchimp-system.md`):**

- ~~mailchimp-integration.md~~
- ~~mailchimp-registration-setup.md~~

**Históricos/Changelogs:**

- ~~CHANGELOG_SUBSCRIPTION_VALIDATION.md~~

## Convenciones Generales

- Todo el código se escribe en TypeScript/React dentro del App Router de Next.js 15.5.6
- El esquema de Supabase se encuentra en `database/database.sql`; usa este archivo como fuente de verdad para la base de datos
- Cada documento incluye al final referencias a archivos clave para profundizar en el tema
- La documentación está organizada por sistema para facilitar la navegación

## Cómo Contribuir

1. Lee primero el documento relevante para evitar duplicar contenido
2. Al agregar nueva información, enlaza los archivos o rutas del código con formato `ruta/al/archivo.tsx:linea`
3. Mantener la documentación en inglés o español es válido; procura consistencia dentro de cada archivo
4. Si un tema ya está cubierto en un documento consolidado, actualiza ese documento en lugar de crear uno nuevo
5. Usa los documentos consolidados como referencia para mantener la estructura y formato

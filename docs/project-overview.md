# Panorama del producto

PūrVita es una plataforma de venta directa con capacidades multinivel construida sobre Next.js 15, React 18 y Supabase. El objetivo principal es ofrecer un catalogo de productos, permitir el registro de afiliados y brindar herramientas administrativas para monitorear la red.

## Roles y audiencias
- **Visitante**: explora productos, planes y testimonios desde la landing internacionalizada (`src/app/[lang]/page.tsx`).
- **Miembro**: accede a su panel personal, estado de suscripcion y red de referidos (`src/app/[lang]/dashboard/page.tsx`, `src/app/[lang]/team/page.tsx`).
- **Administrador**: gestiona usuarios y productos desde la seccion `/admin` usando componentes protegidos (`src/components/admin-guard.tsx`).

## Modulos funcionales
- **Landing y catalogo**: catalogo dinamico, seccion de productos destacados y testimonios, todo traducido mediante los diccionarios en `src/i18n/dictionaries.ts`.
- **Sistema MLM**: perfiles con codigo de referido, seguimiento de ganancias y vista de equipo. La logica de datos reside en `src/lib/services/user-service.ts` y `src/lib/models/definitions.ts`.
- **Gestion de productos**: CRUD completo sobre la tabla `products` con subida de imagenes a Supabase Storage (`src/lib/services/product-service.ts`).
- **Planes y pagos**: flujo de suscripciones y checkout mockeado con PayPal como pasarela (`src/app/[lang]/subscriptions/page.tsx`, `src/app/[lang]/checkout/page.tsx`).
- **Backoffice administrativo**: dashboard con métricas básicas, listado y edición de usuarios y productos (`src/app/admin/dashboard/page.tsx`, `src/app/admin/users/page.tsx`, `src/app/admin/products/page.tsx`) y seguimiento manual de bodega (`src/app/admin/bodega/page.tsx`).

## Integraciones externas
- **Supabase** para autenticacion, base de datos Postgres y storage (`src/lib/supabase.ts`).
- **Shadcn UI + Tailwind CSS** para el sistema de diseño (`src/components/ui`).
- **Lucide Icons** para iconos SVG reutilizables.
- **Mailchimp** para lista de espera y suscripciones automáticas; ver [docs/mailchimp-system.md](mailchimp-system.md).
- **Integracion de IA** pendiente de definir (Genkit fue removido).

## Internacionalizacion
La aplicacion soporta ingles y espanol mediante rutas dinamicas `[lang]`, middleware que redirige al locale por defecto (`middleware.ts`) y componentes de UI que consumen los diccionarios (`src/app/components/header.tsx`, `src/app/components/language-switcher.tsx`).

## Progresion recomendada
1. Lee `setup.md` para replicar el entorno local.
2. Revisa `architecture.md` para entender la estructura de carpetas.
3. Usa `admin-guide.md` si vas a operar el backoffice.

## Archivos clave
- `package.json`: dependencias principales.
- `src/app/layout.tsx`: layout raiz y ThemeProvider.
- `public/`: assets estaticos (favicon, imagenes, fuentes locales).

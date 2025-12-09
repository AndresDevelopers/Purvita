# Sistema de Pagos y Checkout

> Documento único que consolida la arquitectura, flujos, componentes y herramientas de pruebas del ecosistema de pagos (checkout público y panel administrativo) de **PūrVita Network**.

## Tabla de contenido

1. [Resumen ejecutivo](#resumen-ejecutivo)
2. [Arquitectura y módulos](#arquitectura-y-módulos)
3. [Flujos de checkout y retorno](#flujos-de-checkout-y-retorno)
4. [Configuración de proveedores](#configuración-de-proveedores)
5. [Panel de pruebas en Admin (`/admin/pays`)](#panel-de-pruebas-en-admin-adminpays)
6. [APIs relevantes](#apis-relevantes)
7. [Seguridad y cumplimiento](#seguridad-y-cumplimiento)
8. [Resolución de problemas](#resolución-de-problemas)
9. [Referencias de código y datos](#referencias-de-código-y-datos)

## Resumen ejecutivo

- **Proveedores soportados**: Stripe Checkout + Webhooks, PayPal Orders, Wallet interno (para recargas y suscripciones).
- **Patrones aplicados**: Factory para proveedores (`payment-provider-factory`), Repository para historial (`history/repositories/payment-history-supabase-repository.ts`), Observer para eventos UI (`PaymentGatewayEventBus`, `PaymentHistoryEventBus`), Error Boundary en vistas (`payment-gateway-error-boundary.tsx`).
- **Localización**: cadenas en `src/i18n/dictionaries/payments.ts` con traducciones por idioma.
- **Mobile-first**: loaders compactos, estados vacíos, botones táctiles ≥ 44px, soporte pull-to-refresh en historiales.

## Arquitectura y módulos

```text
┌────────────────────────────────────────────────────────┐
│          Frontend (App Router - Next.js 15)            │
│                                                        │
│  • src/modules/payments/services/payment-flow-service  │
│  • src/modules/payments/hooks/use-payment-gateways     │
│  • src/modules/payments/components/payment-result/*    │
│  • src/modules/payments/utils/payment-provider-*       │
└───────────────┬───────────────────────┬────────────────┘
                │                       │
        Stripe Checkout           PayPal Orders          Wallet interno
                │                       │                       │
┌───────────────▼──────────────┐ ┌──────▼────────────────────┐ ┌──────▼─────────────────────┐
│  /api/payments/stripe/*      │ │ /api/payments/paypal/*    │ │ /api/payments/wallet/*     │
│  (captura + webhooks)        │ │ (create/capture/cancel)   │ │ (recargas y conciliación)  │
└───────────────┬──────────────┘ └──────┬────────────────────┘ └──────┬─────────────────────┘
                │                       │                       │
        Supabase Repositories   Supabase Repositories   Supabase Repositories
                │                       │                       │
┌───────────────▼──────────────┐ ┌──────▼────────────────────┐ ┌──────▼─────────────────────┐
│ payment_history_* tables     │ │ paypal_transactions       │ │ wallet_txns / wallets      │
│ subscription_payments        │ │ subscription_payments     │ │ subscription_payments      │
└──────────────────────────────┴─┴───────────────────────────┴─┴────────────────────────────┘
```

- **Factory Pattern**: `src/modules/payments/factories/payment-provider-factory.ts` crea instancias según `PaymentGateway` (`stripe`, `paypal`, `wallet`).
- **Repository Pattern**: `src/modules/payments/history/repositories/payment-history-supabase-repository.ts` provee queries tipadas para historiales, evitando SQL embebido en componentes.
- **Observer/Event Bus**: `src/modules/payments/domain/events/payment-gateway-event-bus.ts` y `history/domain/events/payment-history-event-bus.ts` distribuyen eventos (`payment:created`, `history:refresh`, etc.) para sincronizar widgets y activar haptics en mobile.
- **Error Boundaries**: `src/modules/payments/components/payment-gateway-error-boundary.tsx` y `payment-test-error-boundary.tsx` encapsulan fallos de UI y brindan reintentos seguros en `/payment/result` y `/admin/pays`.

## Flujos de checkout y retorno

### Captura de origen

1. El cliente calcula la URL de retorno (`PaymentReturnUrlService.getCurrentOriginUrl()`) y la inyecta en `PaymentService.createPayment()`.
2. `PaymentReturnUrlService.generateReturnUrls()` genera URLs de éxito/cancelación con la URL original codificada en `origin_url`.

### Procesamiento externo

- Stripe: se crea `Checkout Session` y se redirige al `url` devuelto.
- PayPal: se crea `order`, se redirige al `approve_url`.
- Wallet: ejecuta débito inmediato vía `WalletService.spendFunds()` y retorna al origen sin redirección externa.

### Página de resultado (`/payment/result`)

- Archivo principal: `src/app/payment/result/page.tsx`.
- Responsabilidades:
  - Valida query params con `PaymentResultParamsSchema` (Zod) y decodifica `origin_url` de forma segura mediante `PaymentReturnUrlService`.
  - Renderiza UI responsive con íconos `CheckCircle/XCircle`, mensajes localizados y botones de regreso.
  - Inyecta `PaymentSuccessHandler` en cliente para capturar órdenes PayPal, esperar webhooks Stripe y redirigir tras 1.5–3 s.
- `PaymentResultHandler` se usa en escenarios de pruebas para mostrar loaders o errores específicos durante la captura.

### Parámetros intercambiados

```text
/payment/result?
  provider=paypal|stripe|wallet
  &status=success|cancel|error
  &origin_url=<URL base64>
  &payment_id=<id interno>
  &session_id=<stripe_session>
  &token=<paypal_token>
```

Al retornar a la URL de origen se anexan parámetros normalizados:

```text
<origin_url>?
  payment_status=success|error|cancelled
  &provider=paypal|stripe|wallet
  &payment_id=<id>
  &session_id=<stripe_session>
  &order_id=<paypal_order>
```

### Webhooks y conciliación

#### Stripe Webhooks

- **Ruta**: `src/app/api/webhooks/stripe/route.ts`
- **Eventos procesados**: `checkout.session.completed`, `invoice.payment_succeeded`
- **Verificación de firma**: Usa `stripe.webhooks.constructEvent()` con `STRIPE_WEBHOOK_SECRET` para validar autenticidad
- **Funcionalidad**: Aplica recompensas de fase y registra recargas (`WalletService.recordRecharge`)
- **Seguridad**: Rechaza automáticamente webhooks con firma inválida (status 400)

#### PayPal Webhooks

- **Ruta**: `src/app/api/webhooks/paypal/route.ts`
- **Eventos procesados**: `PAYMENT.SALE.COMPLETED`, `CHECKOUT.ORDER.APPROVED`
- **Verificación de firma**: Usa PayPal Webhook Verification API con OAuth 2.0
  - Requiere `PAYPAL_WEBHOOK_ID` configurado (obtener desde PayPal Dashboard)
  - Extrae headers de transmisión (`paypal-transmission-id`, `paypal-transmission-sig`, etc.)
  - Obtiene token OAuth con `client_credentials`
  - Valida firma contra `/v1/notifications/verify-webhook-signature`
- **Funcionalidad**: Gestiona recargas y recompensas de afiliados
- **Seguridad**:
  - Si `PAYPAL_WEBHOOK_ID` está configurado: verifica firma y rechaza webhooks inválidos (status 401)
  - Si no está configurado: procesa webhook pero registra advertencia de seguridad
- **Documentación completa**: Ver `docs/WEBHOOKS_AND_CORS.md`

#### Conciliación

- Ambos webhooks delegan en `SubscriptionLifecycleService.handleConfirmedPayment()` para consolidar `subscription_payments`, actualizar periodos y marcar eventos en `webhook_events` (idempotencia)
- La tabla `webhook_events` previene procesamiento duplicado usando `event_id` único

## Configuración de proveedores

### Variables de entorno

- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- PayPal: `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_ENVIRONMENT`.
- General: `NEXT_PUBLIC_APP_URL` para construir URLs absolutas de retorno.

### Sandboxes y producción

- Cambiar llaves en `/admin/pays` usando pestañas **Test** y **Production**.
- El panel valida credenciales con `POST /api/admin/payments/validate/[provider]`.
- Stripe ofrece tarjetas de prueba (`4242 4242 4242 4242`, `4000 0027 6000 3184`, etc.); PayPal genera cuentas sandbox automáticamente.

## Panel de pruebas en Admin (`/admin/pays`)

### Capacidades

- Tarjetas individuales por proveedor con estado de configuración.
- Escenarios rápidos: Basic ($10.00), Subscription ($29.99), High Value ($999.99), Minimal ($0.50).
- Escenarios personalizados con validaciones (`amount >= 0.01`).
- Historial manejado por `TestHistoryService` (repositorio en memoria con plan de persistencia Supabase) con filtros por proveedor y acciones de limpieza.

### Flujo recomendado

1. Registrar credenciales en pestaña **Configuration**.
2. Ejecutar **Check Config** → `POST /api/admin/payments/validate/[provider]`.
3. Lanzar prueba desde **Testing** (`POST /api/admin/payments/test/[provider]`).
4. Completar flujo en ventana del gateway y revisar sección **Test Results**.
5. Confirmar registro en historial y validar webhook correspondiente.

### Componentes y hooks reutilizables

- `PaymentTestPanel`, `PaymentTestInfo`, `PaymentTestResults` (`src/modules/payments/components/*`).
- Hooks `usePaymentConfiguration`, `usePaymentTesting`, `usePaymentTest` y `useTestScenarios` (`src/modules/payments/hooks/*`) orquestan loaders, validaciones y feedback táctil.
- Servicios `PaymentTestingService` (`src/modules/payments/services/payment-testing.ts`) y `TestHistoryService` (`src/modules/payments/services/test-history-service.ts`) centralizan llamadas API.

## APIs relevantes

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/api/payments/stripe/create-checkout` | Crea sesión de Stripe Checkout y retorna `url`. |
| `POST` | `/api/payments/paypal/create-order` | Genera orden PayPal con `approvalUrl`. |
| `POST` | `/api/payments/paypal/capture-order` | Captura orden PayPal tras aprobación. |
| `POST` | `/api/payments/wallet/charge` | Descuenta saldo del monedero interno. |
| `POST` | `/api/admin/payments/validate/[provider]` | Verifica credenciales desde el panel. |
| `POST` | `/api/admin/payments/test/[provider]` | Ejecuta escenarios de prueba. |
| `GET`/`DELETE` | `/api/admin/payments/test-history` | Lista o limpia historiales. |
| `GET` | `/api/admin/payments/history` | Historial con paginación infinita para conciliación. |

## Seguridad y cumplimiento

- **Validación de entrada**: Zod Schemas (`PaymentProviderSchema`, `PaymentResultQuerySchema`, `AdminPaymentTestSchema`).
- **Autenticación**: rutas `/api/admin/*` exigen rol `admin`; rutas públicas usan sesiones Supabase + CSRF tokens del middleware.
- **Rate limiting**: `src/middleware.ts` aplica límites sobre endpoints de pago y webhooks.
- **CORS**: sólo dominios propios; rechaza `origin_url` externos en `PaymentReturnUrlService.decodeOriginUrl()`.
- **Logging/Auditoría**: `logUserAction` registra recargas y pruebas relevantes; errores críticos se envían a Sentry mediante `SentryLogger.captureApiError`.

## Resolución de problemas

- **`Configuration Required`**: credenciales faltantes o proveedor desactivado. Revisar `/admin/pays` y repetir `Check Config`.
- **`Payment URL not received`**: inspeccionar respuesta de `/api/admin/payments/test/[provider]` y logs de `PaymentTestingService`.
- **`Invalid origin url`**: confirmar que `NEXT_PUBLIC_APP_URL` coincide con el host actual; la URL debe usar HTTPS en producción.
- **Webhook sin disparar**: verificar panel del proveedor, secret configurado y estado del endpoint en `supabase/edge-functions`. Stripe permite reintentos manuales.
- **Redirección manual necesaria**: usar botón **Regresar** en `/payment/result`. Si el origen no es válido, fallback a homepage (`/`).

## Referencias de código y datos

### Código

- **Frontend**: `src/app/payment/result/page.tsx`, `src/modules/payments/**/*`.
- **APIs**: `src/app/api/payments/*`, `src/app/api/admin/payments/**/*`, `src/app/api/webhooks/*`.
- **Esquema**: tablas y políticas en `docs/database/full-schema.sql` (`payment_history`, `paypal_transactions`, `wallet_txns`).
- **Migraciones**: revisar `docs/migrations/20251018_restore-commerce-foundations.sql` y el historial en `docs/MIGRATIONS_STATUS.md` para validar dependencias de pagos.
- **Observabilidad**: `src/modules/observability/services/sentry-logger.ts` y `src/lib/services/audit-log-service.ts`.

### Documentación relacionada

- `docs/WEBHOOKS_AND_CORS.md` - Guía completa de configuración y verificación de webhooks
- `docs/environment-variables.md` - Variables de entorno para pagos y seguridad
- `docs/security.md` - Medidas de seguridad implementadas
- `docs/AUDITORIA_SEGURIDAD.md` - Auditoría de seguridad completa

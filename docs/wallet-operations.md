# Wallet & Balance Operations / Operaciones de Billetera

Este documento concentra todo lo relacionado con el saldo del usuario: recargas automáticas con PayPal/Stripe, solicitudes manuales de respaldo y ajustes administrativos. El objetivo es mantener una única fuente de verdad para entender cómo se acredita, audita y muestra el balance dentro de PūrVita.

## Quick map / Mapa rápido
- [Automatic top-ups](#automatic-top-ups--recargas-automaticas)
- [Manual fallback requests](#manual-fallback-requests--solicitudes-manuales)
- [Admin adjustments](#admin-adjustments--ajustes-administrativos)
- [Security & auditing](#security--auditing)
- [References](#references)

## Automatic top-ups / Recargas automáticas

La experiencia por defecto permite que la persona usuaria recargue su saldo desde la página de perfil seleccionando PayPal o Stripe.

### Flow overview / Flujo principal
1. El usuario abre `BalanceRecharge` en `/[lang]/profile`.
2. El componente llama a `createPaymentOrder` (servicio) para generar la orden y redirigir al checkout seguro del proveedor.
3. Tras completar el pago, el proveedor redirige a la app y dispara los webhooks (`src/app/api/webhooks/paypal|stripe`).
4. `WalletService.recordRecharge` registra la transacción en `wallet_txns` y actualiza `wallets.balance_cents`.
5. La vista de perfil vuelve a consultar el resumen (`profile-summary-service.ts`) y muestra un toast de confirmación.

### Domain & services / Dominios y servicios
- `src/modules/payments/domain/orders.ts`: contratos Zod para órdenes y respuestas de los proveedores.
- `src/modules/payments/services/payment-order-service.ts`: orquesta el flujo de creación y validación de órdenes.
- `src/modules/wallet/services/wallet-service.ts`: factoría y servicio que acreditan el saldo una vez confirmado el pago.
- `src/components/user/balance-recharge.tsx`: vista client-side con manejo de estados vacíos, errores y reintentos.

### Database anchors / Secciones de base de datos
- `docs/database/database.sql` → **SECTION: Wallet, subscription & orders**: tablas `wallets`, `wallet_txns`, `subscriptions`, `payments` y triggers de sincronización.
- `docs/database/database.sql` → **SECTION: Payment gateway configuration**: tabla `payment_gateways` para activar/desactivar proveedores.
- `docs/database/database.sql` → **SECTION: Automation triggers & functions**: `refresh_subscription_phases()` recalcula la fase de progreso tras cada recarga exitosa.

### API surface / Endpoints relevantes
- `POST /api/payments/orders` → crea la orden y devuelve la URL del proveedor.
- `POST /api/webhooks/paypal` y `POST /api/webhooks/stripe` → confirman la transacción y acreditan el saldo.
- `GET /api/profile/summary` → expone el balance actualizado para el panel del usuario.

## Manual fallback requests / Solicitudes manuales

El flujo heredado permanece disponible para escenarios donde los proveedores automáticos no cubren un método específico (transferencias, cripto, etc.).

### Database schema / Esquema involucrado
- `docs/database/database.sql` → **SECTION: Manual balance recharge** crea `payment_wallets` y `payment_requests` con RLS y triggers.
- `docs/database/verification-suite.sql` contiene las consultas de auditoría `payment_wallets_check` y `payment_requests_check`.

### Operación / Operation steps
1. Administradores definen wallets alternas en `/admin/payment-wallets`.
2. El usuario envía una solicitud con `POST /api/payment-requests` adjuntando monto y comprobante opcional.
3. El equipo admin revisa solicitudes pendientes en `/admin/payment-requests`.
4. `PaymentWalletService.approvePaymentRequest` acredita fondos usando `WalletService.addTransaction` y marca la solicitud como completada.
5. Si la solicitud es rechazada, se registra el motivo en `payment_requests.admin_notes` y se notifica al usuario.

### API endpoints
- `GET /api/payment-wallets` → lista métodos activos.
- `GET /api/payment-requests` → historial personal del usuario autenticado.
- `PATCH /api/payment-requests/[id]/proof` → actualiza comprobantes o hashes de transacción.
- `POST /api/admin/payment-wallets/[id]` → activar/desactivar métodos y límites.
- `POST /api/admin/payment-requests/[id]/approve` / `reject` → resolución administrativa.

## Admin adjustments / Ajustes administrativos

Los administradores pueden ajustar el saldo manualmente (bonos, correcciones, deducciones) desde el módulo de usuarios.

### Core building blocks
- `src/modules/multilevel/repositories/wallet-repository.ts` implementa el **Repository Pattern** para `wallets` y `wallet_txns` (creación diferida, inserción de transacciones, consultas de balance).
- `src/modules/multilevel/services/wallet-service.ts` expone `addFunds` y `deductFunds` aplicando validaciones de monto, motivo (`reason`) y auditoría.
- `src/app/api/admin/wallet/add-funds/route.ts` valida con Zod y delega en el servicio.
- `src/app/admin/users/details/[id]/user-details-content.tsx` consume `WalletManager` y refresca el balance vía observer interno.

### UI experience / Experiencia de interfaz
- Botón **Manage Wallet** abre `src/components/admin/wallet-manager.tsx` (dialogo responsive + reglas mobile-first).
- El formulario aplica estados de carga, errores y confirmación accesibles. Todos los inputs siguen la convención touch-friendly ≥44px.
- Tras confirmar, se emite `onBalanceUpdated` para sincronizar tablas y gráficos dependientes.

### Sample request / Ejemplo programático
```ts
await fetch('/api/admin/wallet/add-funds', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'uuid',
    amountCents: 5000,
    reason: 'phase_bonus',
    note: 'Bonificación por desbloquear fase 2',
  }),
});
```

## Security & auditing

- Todas las rutas usan el **Principio de Menor Privilegio**: usuarios autenticados solo ven su información; los endpoints admin verifican rol `admin` antes de ejecutar.
- `wallet_txns` registra `created_by` y metadata JSON para auditar cada movimiento.
- Las operaciones sensibles disparan observadores (`OpportunityProgressNotifier`, `WalletBalanceObserver`) para alimentar logs y métricas.
- Los webhooks validan firmas (`stripe.webhooks.constructEvent`, validación de `paypalTransmissionSig`) antes de acreditar fondos.
- Asegúrate de configurar `SUPABASE_SERVICE_ROLE_KEY`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` en `.env` y entornos remotos.

## References
- `src/components/user/balance-recharge.tsx`
- `src/modules/payments/services/payment-order-service.ts`
- `src/modules/wallet/services/wallet-service.ts`
- `src/modules/multilevel/repositories/wallet-repository.ts`
- `src/app/api/admin/wallet/add-funds/route.ts`
- `src/app/api/payment-requests/route.ts`
- `docs/database/full-schema.sql`
- `docs/database/verification-suite.sql`

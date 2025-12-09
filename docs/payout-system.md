# Sistema de Pagos (Payout System)

## Descripción General

El sistema de pagos de PūrVita Network permite a los usuarios cobrar sus ganancias de comisiones directamente a través de Stripe Connect o PayPal cuando alcanzan un umbral configurable (mínimo $9.00 USD).

## Arquitectura del Sistema

### Componentes Principales

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ADMIN DASHBOARD                              │
│                     /admin/app-settings                              │
├─────────────────────────────────────────────────────────────────────┤
│  • baseCommissionRate: 10%                                          │
│  • referralBonusRate: 5%                                            │
│  • levelEarnings: $15, $10, $7, $5, $3                             │
│  • payoutFrequency: monthly                                         │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      COMMISSION ENGINE                               │
│  1. Identifica la red del comprador                                 │
│  2. Calcula comisiones según app_settings                           │
│  3. Crea registros en network_commissions                           │
└───────────────────────────────┬───────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        USER DASHBOARD                                │
│                  /profile/payout-settings                            │
│  • Ganancias disponibles                                            │
│  • Configuración de Stripe Connect / PayPal                         │
│  • Transferencia a Wallet                                           │
│  • Pago Automático                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Características del Sistema

### 1. Pago Automático

**Requisitos:**
- Cuenta de Stripe Connect o PayPal activa
- Umbral configurable (mínimo $9.00 USD)
- Saldo disponible >= umbral configurado

**Flujo:**
1. Usuario conecta Stripe Connect o PayPal
2. Usuario acumula comisiones en `network_commissions`
3. Usuario configura umbral personalizado (opcional)
4. Cuando alcanza el umbral, hace clic en "Cobrar ahora"
5. Sistema procesa pago a través de Stripe/PayPal
6. Dinero llega en ~2 días hábiles

### 2. Transferencia a Wallet

**Permite:**
- Transferir ganancias de red al wallet personal
- Usar fondos para compras en la plataforma
- Mantener balance disponible para uso interno

### 3. Configuración de Métodos de Pago

**Stripe Connect:**
- Conexión automática con un clic
- Cuenta marcada como `active` automáticamente
- Integración con credenciales del admin

**PayPal:**
- Configuración manual de email
- Validación de cuenta
- Procesamiento de pagos

## Estructura de Base de Datos

### Tabla: network_commissions

```sql
CREATE TABLE network_commissions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,           -- Quien recibe la comisión
  member_id UUID NOT NULL,         -- Quien generó la venta
  amount_cents BIGINT NOT NULL,    -- Total de comisión
  available_cents BIGINT NOT NULL, -- Disponible para transferir
  currency TEXT NOT NULL,
  level INTEGER,                   -- Nivel en la red (1-10)
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  
  CONSTRAINT available_lte_amount 
    CHECK (available_cents <= amount_cents)
);
```

### Tabla: payout_accounts

```sql
CREATE TABLE payout_accounts (
  user_id UUID PRIMARY KEY,
  provider TEXT NOT NULL,          -- 'stripe' o 'paypal'
  account_id TEXT,                 -- ID externo
  status TEXT NOT NULL,            -- 'pending', 'active', etc.
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  
  CONSTRAINT valid_provider 
    CHECK (provider IN ('stripe', 'paypal')),
  CONSTRAINT valid_status 
    CHECK (status IN ('pending', 'active', 'restricted', 'disabled'))
);
```

### Tabla: payout_preferences

```sql
CREATE TABLE payout_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  auto_payout_threshold_cents INTEGER NOT NULL DEFAULT 900,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT valid_threshold
    CHECK (auto_payout_threshold_cents >= 900)
);
```

### Tabla: payout_transactions

```sql
CREATE TABLE payout_transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  provider TEXT NOT NULL,          -- 'stripe' o 'paypal'
  external_id TEXT NOT NULL,       -- ID del payout en Stripe
  status TEXT NOT NULL,            -- 'pending', 'completed', 'failed', 'cancelled'
  estimated_arrival TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
```

## APIs Principales

### GET /api/profile/summary
Obtiene el resumen completo del perfil incluyendo ganancias.

**Response:**
```json
{
  "networkEarnings": {
    "totalAvailableCents": 2500,
    "currency": "USD",
    "members": [
      {
        "memberId": "member-A",
        "memberName": "John Doe",
        "totalCents": 1500
      }
    ]
  },
  "payoutAccount": {
    "provider": "stripe",
    "status": "active",
    "account_id": "acct_123"
  }
}
```

### POST /api/profile/earnings/transfer
Transfiere ganancias de red al wallet personal.

**Request:**
```json
{
  "amountCents": 1000
}
```

### POST /api/profile/earnings/auto-payout
Procesa un pago automático.

**Response (Éxito):**
```json
{
  "processed": true,
  "amountCents": 2500,
  "stripePayoutId": "po_1234567890abcdef",
  "estimatedArrival": "2025-01-08T12:00:00Z",
  "thresholdCents": 2500
}
```

**Response (Saldo Insuficiente):**
```json
{
  "processed": false,
  "reason": "below_threshold",
  "message": "Minimum payout amount is $25.00. Current available: $5.50",
  "availableCents": 550,
  "minimumCents": 900,
  "thresholdCents": 2500
}
```

### GET /api/profile/earnings/auto-payout
Obtiene el estado de configuración de pagos automáticos.

**Response:**
```json
{
  "enabled": true,
  "eligible": false,
  "availableCents": 2500,
  "minimumCents": 900,
  "thresholdCents": 2500,
  "payoutAccount": {
    "provider": "stripe",
    "status": "active",
    "account_id": "acct_1234567890"
  }
}
```

### PATCH /api/profile/earnings/auto-payout
Actualiza el umbral personalizado.

**Request:**
```json
{
  "thresholdCents": 2500
}
```

### POST /api/profile/earnings/stripe-connect
Crea o recupera una cuenta de Stripe Connect.

**Response:**
```json
{
  "account": {
    "provider": "stripe",
    "account_id": "acct_1234567890",
    "status": "active"
  },
  "created": true
}
```

## Interfaz de Usuario

### Sección de Pago Automático

La sección aparece **dentro de la card** de Stripe Connect o PayPal cuando el usuario tiene una cuenta activa:

```
┌──────────────────────────────────────────────────────────┐
│ Stripe Connect                            [Active]       │
│ Tu cuenta está lista para recibir pagos                  │
│                                  [Conectar con Stripe]   │
│                                                           │
│ ──────────────────────────────────────────────────────── │
│                                                           │
│ 💰 Pago Automático                                        │
│ Cobra tus ganancias cuando alcances tu umbral          │
│                                                           │
│ Disponible: $25.00  |  Umbral: $25.00  |  Mínimo: $9.00  │
│                                                           │
│ [ 25.00 ] (umbral editable)            [Guardar umbral] │
│                                                           │
│ [Cobrar ahora] ← Verde para Stripe, Azul para PayPal    │
└──────────────────────────────────────────────────────────┘
```

**Estados de la UI:**

1. **Elegible para Pago:**
   - Saldo >= umbral configurado
   - Botón "Cobrar ahora" habilitado
   - Fondo verde (Stripe) o azul (PayPal)
   - Mensaje: "✓ Tienes saldo suficiente..."

2. **Saldo Insuficiente:**
   - Saldo < umbral configurado
   - Botón "Cobrar ahora" deshabilitado
   - Fondo amarillo/ámbar
   - Mensaje: "Necesitas al menos {{threshold}} disponibles..."

## Seguridad

### Row Level Security (RLS)

```sql
-- Los usuarios solo pueden ver sus propias comisiones
CREATE POLICY "network_commissions_read_self" 
ON network_commissions
FOR SELECT
USING (auth.uid() = user_id);

-- Solo el service_role puede crear/modificar transacciones
CREATE POLICY "payout_transactions_service_role" 
ON payout_transactions
FOR ALL
USING (auth.role() = 'service_role');
```

### Validaciones

- Autenticación requerida en todos los endpoints
- Verificación de cuenta activa
- Validación de umbral mínimo ($9.00)
- Prevención de pagos duplicados
- Verificación de saldo disponible

## Configuración Requerida

### Variables de Entorno

```env
STRIPE_SECRET_KEY=sk_test_xxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
```

### Migraciones de Base de Datos

```bash
# Ejecutar en Supabase SQL Editor
psql -f docs/migrations/20250106-create-payout-transactions.sql
psql -f docs/migrations/20250214_add_payout_preferences_table.sql
```

## Módulos del Código

```
src/
├── modules/
│   ├── multilevel/
│   │   └── repositories/
│   │       ├── network-earnings-repository.ts
│   │       └── payout-account-repository.ts
│   │
│   └── profile/
│       └── services/
│           ├── profile-summary-service.ts
│           └── profile-earnings-service.ts
│
└── app/
    ├── [lang]/
    │   └── profile/
    │       └── payout-settings/
    │           └── page.tsx
    │
    └── api/
        └── profile/
            └── earnings/
                ├── transfer/
                ├── stripe-connect/
                ├── paypal-connect/
                └── auto-payout/
```

## Troubleshooting

### Error: "No payout account configured"
**Causa:** El usuario no ha conectado Stripe Connect o PayPal  
**Solución:** Ir a Payout Settings y conectar un método de pago

### Error: "Minimum payout amount is $X"
**Causa:** El saldo disponible es menor al umbral configurado  
**Solución:** Ajustar el umbral a un monto menor (>= $9.00) o esperar a acumular más comisiones

### Error: "Failed to process Stripe payout"
**Causa:** Error en la API de Stripe  
**Solución:** 
1. Verificar credenciales de Stripe en variables de entorno
2. Revisar logs de Stripe Dashboard
3. Verificar límites de la cuenta de Stripe

## Próximas Mejoras

1. **Webhooks de Stripe**: Actualizar automáticamente el estado de las transacciones
2. **Pagos Programados**: Permitir configurar pagos automáticos semanales/mensuales
3. **Notificaciones**: Enviar emails cuando un pago se complete
4. **Historial de Pagos**: Mostrar historial completo de transacciones en la UI
5. **Soporte para PayPal**: Implementar pagos automáticos también para PayPal

## Referencias

- **Migraciones**: `docs/migrations/`
- **Servicios**: `src/modules/profile/services/profile-earnings-service.ts`
- **UI**: `src/app/[lang]/profile/payout-settings/page.tsx`


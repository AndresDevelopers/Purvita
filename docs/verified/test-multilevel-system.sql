-- Script de prueba para el sistema multinivel dinámico
-- Este script crea una red de prueba y verifica que el sistema funcione correctamente

-- =============================================================
-- PASO 1: Verificar que la función RPC existe
-- =============================================================

SELECT 
  proname as function_name,
  pronargs as num_args,
  prorettype::regtype as return_type
FROM pg_proc 
WHERE proname IN ('fetch_multilevel_tree', 'fetch_two_level_tree')
ORDER BY proname;

-- Debe mostrar ambas funciones

-- =============================================================
-- PASO 2: Verificar configuración de app_settings
-- =============================================================

SELECT
  id,
  max_members_per_level,
  currency
FROM public.app_settings
WHERE id = 'global';

-- Debe mostrar la configuración actual de niveles

-- =============================================================
-- PASO 3: Crear usuarios de prueba (si no existen)
-- =============================================================

-- NOTA: Este paso requiere que tengas usuarios reales en auth.users
-- Aquí solo mostramos cómo verificar la estructura

-- Verificar usuarios existentes con referidos
SELECT 
  p.id,
  p.email,
  p.referred_by,
  p.referral_code,
  s.status as subscription_status,
  s.waitlisted
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.id
WHERE p.referred_by IS NOT NULL
ORDER BY p.created_at DESC
LIMIT 10;

-- =============================================================
-- PASO 4: Probar función fetch_multilevel_tree
-- =============================================================

-- Reemplaza 'USER_UUID_HERE' con un UUID real de un usuario que tenga referidos
-- Ejemplo: SELECT * FROM public.fetch_multilevel_tree('550e8400-e29b-41d4-a716-446655440000', 5);

DO $$
DECLARE
  test_user_id UUID;
BEGIN
  -- Obtener el primer usuario que tenga referidos
  SELECT id INTO test_user_id
  FROM public.profiles
  WHERE id IN (
    SELECT DISTINCT referred_by 
    FROM public.profiles 
    WHERE referred_by IS NOT NULL
  )
  LIMIT 1;

  IF test_user_id IS NOT NULL THEN
    RAISE NOTICE 'Probando con usuario: %', test_user_id;
    
    -- Mostrar el árbol multinivel
    RAISE NOTICE 'Árbol multinivel:';
    PERFORM * FROM public.fetch_multilevel_tree(test_user_id, 5);
  ELSE
    RAISE NOTICE 'No se encontraron usuarios con referidos para probar';
  END IF;
END $$;

-- =============================================================
-- PASO 5: Contar miembros por nivel
-- =============================================================

-- Reemplaza 'USER_UUID_HERE' con un UUID real
-- Ejemplo con un usuario específico:
/*
SELECT 
  level,
  COUNT(*) as total_members,
  COUNT(*) FILTER (WHERE status = 'active' AND waitlisted = false) as active_members,
  COUNT(*) FILTER (WHERE waitlisted = true) as waitlisted_members,
  COUNT(*) FILTER (WHERE status IS NULL OR status != 'active') as inactive_members
FROM public.fetch_multilevel_tree('USER_UUID_HERE', 10)
GROUP BY level
ORDER BY level;
*/

-- =============================================================
-- PASO 6: Verificar comisiones generadas
-- =============================================================

-- Ver comisiones recientes por nivel
SELECT 
  nc.user_id,
  p.email as sponsor_email,
  nc.level,
  nc.amount_cents / 100.0 as amount_usd,
  nc.currency,
  nc.metadata->>'commission_type' as commission_type,
  nc.created_at
FROM public.network_commissions nc
JOIN public.profiles p ON p.id = nc.user_id
ORDER BY nc.created_at DESC
LIMIT 20;

-- Resumen de comisiones por nivel
SELECT 
  level,
  COUNT(*) as total_commissions,
  SUM(amount_cents) / 100.0 as total_amount_usd,
  AVG(amount_cents) / 100.0 as avg_amount_usd,
  currency
FROM public.network_commissions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY level, currency
ORDER BY level;

-- =============================================================
-- PASO 7: Verificar que las comisiones se generan correctamente
-- =============================================================

-- Ver usuarios con suscripciones activas y sus sponsors
SELECT 
  p.id,
  p.email,
  p.referred_by,
  sponsor.email as sponsor_email,
  s.status as subscription_status,
  s.waitlisted,
  (
    SELECT COUNT(*) 
    FROM public.network_commissions nc 
    WHERE nc.member_id = p.id
  ) as commissions_generated
FROM public.profiles p
LEFT JOIN public.profiles sponsor ON sponsor.id = p.referred_by
LEFT JOIN public.subscriptions s ON s.user_id = p.id
WHERE p.referred_by IS NOT NULL
  AND s.status = 'active'
  AND s.waitlisted = false
ORDER BY p.created_at DESC
LIMIT 20;

-- =============================================================
-- PASO 8: Probar compatibilidad con función legacy
-- =============================================================

-- La función legacy debe seguir funcionando
DO $$
DECLARE
  test_user_id UUID;
  level1_count INTEGER;
  level2_count INTEGER;
BEGIN
  -- Obtener el primer usuario que tenga referidos
  SELECT id INTO test_user_id
  FROM public.profiles
  WHERE id IN (
    SELECT DISTINCT referred_by 
    FROM public.profiles 
    WHERE referred_by IS NOT NULL
  )
  LIMIT 1;

  IF test_user_id IS NOT NULL THEN
    -- Contar nivel 1
    SELECT COUNT(*) INTO level1_count
    FROM public.fetch_two_level_tree(test_user_id)
    WHERE level = 1;
    
    -- Contar nivel 2
    SELECT COUNT(*) INTO level2_count
    FROM public.fetch_two_level_tree(test_user_id)
    WHERE level = 2;
    
    RAISE NOTICE 'Usuario: %', test_user_id;
    RAISE NOTICE 'Nivel 1: % miembros', level1_count;
    RAISE NOTICE 'Nivel 2: % miembros', level2_count;
  ELSE
    RAISE NOTICE 'No se encontraron usuarios con referidos para probar';
  END IF;
END $$;

-- =============================================================
-- PASO 9: Verificar integridad de datos
-- =============================================================

-- Verificar que no hay comisiones huérfanas
SELECT 
  'Comisiones sin usuario' as issue,
  COUNT(*) as count
FROM public.network_commissions nc
LEFT JOIN public.profiles p ON p.id = nc.user_id
WHERE p.id IS NULL

UNION ALL

SELECT 
  'Comisiones sin miembro' as issue,
  COUNT(*) as count
FROM public.network_commissions nc
LEFT JOIN public.profiles p ON p.id = nc.member_id
WHERE p.id IS NULL

UNION ALL

SELECT 
  'Comisiones con nivel inválido' as issue,
  COUNT(*) as count
FROM public.network_commissions nc
WHERE nc.level < 1 OR nc.level > 10;

-- =============================================================
-- PASO 10: Estadísticas generales del sistema
-- =============================================================

SELECT 
  'Total de usuarios' as metric,
  COUNT(*)::TEXT as value
FROM public.profiles

UNION ALL

SELECT 
  'Usuarios con suscripción activa' as metric,
  COUNT(*)::TEXT as value
FROM public.profiles p
JOIN public.subscriptions s ON s.user_id = p.id
WHERE s.status = 'active' AND s.waitlisted = false

UNION ALL

SELECT 
  'Usuarios con referidos' as metric,
  COUNT(DISTINCT referred_by)::TEXT as value
FROM public.profiles
WHERE referred_by IS NOT NULL

UNION ALL

SELECT 
  'Total de comisiones generadas' as metric,
  COUNT(*)::TEXT as value
FROM public.network_commissions

UNION ALL

SELECT 
  'Monto total de comisiones (USD)' as metric,
  '$' || ROUND(SUM(amount_cents) / 100.0, 2)::TEXT as value
FROM public.network_commissions
WHERE currency = 'USD'

UNION ALL

SELECT
  'Niveles máximos configurados' as metric,
  '10' as value; -- Fixed depth of 10 levels (level_earnings removed)

-- =============================================================
-- RESULTADOS ESPERADOS
-- =============================================================

/*
PASO 1: Debe mostrar ambas funciones (fetch_multilevel_tree y fetch_two_level_tree)
PASO 2: Debe mostrar la configuración de niveles en formato JSON
PASO 3: Debe mostrar usuarios con sus referidos
PASO 4: Debe ejecutar sin errores y mostrar el árbol
PASO 5: Debe mostrar conteo de miembros por nivel
PASO 6: Debe mostrar comisiones generadas
PASO 7: Debe mostrar usuarios activos y sus comisiones
PASO 8: Debe mostrar conteo de nivel 1 y 2 (compatibilidad)
PASO 9: Debe mostrar 0 en todos los issues
PASO 10: Debe mostrar estadísticas generales del sistema
*/


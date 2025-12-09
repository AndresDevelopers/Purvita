-- Script para verificar políticas RLS
-- Ejecuta esto en Supabase SQL Editor para verificar que las políticas estén correctas

-- 1. Verificar políticas de subscriptions
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'subscriptions'
ORDER BY policyname;

-- Resultado esperado:
-- subscriptions_read_self: USING (auth.uid() = user_id)
-- subscriptions_service_role: USING (auth.role() = 'service_role')

-- 2. Verificar políticas de wallets
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'wallets'
ORDER BY policyname;

-- Resultado esperado:
-- wallets_read_self: USING (auth.uid() = user_id)
-- wallets_service_role: USING (auth.role() = 'service_role')

-- 3. Verificar políticas de wallet_txns
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'wallet_txns'
ORDER BY policyname;

-- 4. Verificar políticas de phases
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'phases'
ORDER BY policyname;

-- 5. Test: Verificar que un usuario puede leer sus propios datos
-- INSTRUCCIONES: 
-- 1. Comenta este bloque completo (líneas 60-85)
-- 2. O reemplaza 'USER_ID_AQUI' con un UUID real de la tabla profiles
-- 3. Ejemplo: '550e8400-e29b-41d4-a716-446655440000'

/*
DO $$
DECLARE
    test_user_id UUID := 'USER_ID_AQUI'; -- ← CAMBIA ESTO POR UN UUID REAL
BEGIN
    -- Simular que somos ese usuario
    PERFORM set_config('request.jwt.claims', json_build_object('sub', test_user_id)::text, true);
    
    -- Intentar leer subscription
    RAISE NOTICE 'Testing subscription read...';
    PERFORM * FROM subscriptions WHERE user_id = test_user_id;
    RAISE NOTICE 'Subscription read: OK';
    
    -- Intentar leer wallet
    RAISE NOTICE 'Testing wallet read...';
    PERFORM * FROM wallets WHERE user_id = test_user_id;
    RAISE NOTICE 'Wallet read: OK';
    
    -- Intentar leer wallet_txns
    RAISE NOTICE 'Testing wallet_txns read...';
    PERFORM * FROM wallet_txns WHERE user_id = test_user_id LIMIT 1;
    RAISE NOTICE 'Wallet_txns read: OK';
    
    RAISE NOTICE 'All RLS tests passed!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'RLS test failed: %', SQLERRM;
END $$;
*/

-- 6. Verificar que las tablas existen
SELECT 
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('subscriptions', 'wallets', 'wallet_txns', 'phases', 'profiles')
ORDER BY table_name;

-- 7. Verificar índices importantes
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('subscriptions', 'wallets')
ORDER BY tablename, indexname;

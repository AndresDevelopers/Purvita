-- ============================================================================
-- SCRIPT DE DIAGNÓSTICO: audit_logs
-- ============================================================================
-- Este script te ayudará a identificar el problema con la tabla audit_logs

-- ============================================================================
-- 1. Verificar si la tabla existe
-- ============================================================================
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'audit_logs'
    ) THEN '✅ La tabla audit_logs EXISTE'
    ELSE '❌ La tabla audit_logs NO EXISTE'
  END as resultado;

-- ============================================================================
-- 2. Ver la estructura actual de la tabla (si existe)
-- ============================================================================
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'audit_logs'
ORDER BY ordinal_position;

-- ============================================================================
-- 3. Ver los índices existentes (si existen)
-- ============================================================================
SELECT 
  indexname,
  indexdef
FROM pg_indexes 
WHERE tablename = 'audit_logs'
ORDER BY indexname;

-- ============================================================================
-- 4. Ver las políticas RLS (si existen)
-- ============================================================================
SELECT 
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'audit_logs';

-- ============================================================================
-- 5. Ver las funciones relacionadas (si existen)
-- ============================================================================
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname LIKE '%audit%'
ORDER BY proname;

-- ============================================================================
-- SOLUCIONES SEGÚN EL PROBLEMA
-- ============================================================================

-- CASO 1: Si la tabla NO existe
-- Ejecuta: docs/database/migrations/002-audit-logs-table-fixed.sql

-- CASO 2: Si la tabla existe pero con estructura diferente
-- Opción A: Eliminar y recrear (PERDERÁS LOS DATOS)
/*
BEGIN;
DROP VIEW IF EXISTS public.failed_login_attempts CASCADE;
DROP VIEW IF EXISTS public.security_events CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_old_audit_logs() CASCADE;
DROP FUNCTION IF EXISTS public.detect_suspicious_activity(UUID, INET, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.create_audit_log(UUID, TEXT, TEXT, TEXT, INET, TEXT, TEXT, TEXT, TEXT, JSONB) CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
COMMIT;

-- Luego ejecuta: docs/database/migrations/002-audit-logs-table-fixed.sql
*/

-- Opción B: Agregar columnas faltantes (CONSERVA LOS DATOS)
/*
BEGIN;

-- Agregar columnas si no existen
ALTER TABLE public.audit_logs 
  ADD COLUMN IF NOT EXISTS ip_address INET;

ALTER TABLE public.audit_logs 
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

ALTER TABLE public.audit_logs 
  ADD COLUMN IF NOT EXISTS request_method TEXT;

ALTER TABLE public.audit_logs 
  ADD COLUMN IF NOT EXISTS request_path TEXT;

ALTER TABLE public.audit_logs 
  ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('success', 'failure', 'pending'));

ALTER TABLE public.audit_logs 
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::JSONB;

-- Crear índices faltantes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON public.audit_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_audit_logs_security ON public.audit_logs(action, status, created_at DESC) WHERE status = 'failure';
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata ON public.audit_logs USING GIN (metadata);

COMMIT;

-- Luego ejecuta las funciones y vistas de: docs/database/migrations/002-audit-logs-table-fixed.sql
-- (desde la línea 120 en adelante)
*/

-- CASO 3: Si hay conflicto con una tabla antigua
-- Renombra la tabla antigua y crea la nueva
/*
BEGIN;
ALTER TABLE public.audit_logs RENAME TO audit_logs_old;
COMMIT;

-- Luego ejecuta: docs/database/migrations/002-audit-logs-table-fixed.sql
-- Después puedes migrar los datos si es necesario:
-- INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, created_at)
-- SELECT user_id, action, entity_type, entity_id, created_at FROM public.audit_logs_old;
*/

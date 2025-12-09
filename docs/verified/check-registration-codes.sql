-- Script para verificar el estado de los códigos de registro
-- Ejecuta esto en el SQL Editor de Supabase

-- Ver todos los códigos con su estado
SELECT 
  id,
  code,
  valid_from AT TIME ZONE 'UTC' as valid_from_utc,
  valid_to AT TIME ZONE 'UTC' as valid_to_utc,
  CASE 
    WHEN valid_from <= NOW() AND valid_to >= NOW() THEN '✅ ACTIVO'
    WHEN valid_from > NOW() THEN '⏳ FUTURO'
    ELSE '❌ EXPIRADO'
  END as status,
  CASE 
    WHEN valid_from <= NOW() AND valid_to >= NOW() THEN 
      EXTRACT(EPOCH FROM (valid_to - NOW())) / 86400 || ' días restantes'
    WHEN valid_from > NOW() THEN 
      'Comienza en ' || EXTRACT(EPOCH FROM (valid_from - NOW())) / 86400 || ' días'
    ELSE 
      'Expiró hace ' || EXTRACT(EPOCH FROM (NOW() - valid_to)) / 86400 || ' días'
  END as tiempo,
  created_at AT TIME ZONE 'UTC' as created_at_utc
FROM public.registration_access_codes
ORDER BY valid_from DESC;

-- Contar códigos por estado
SELECT 
  CASE 
    WHEN valid_from <= NOW() AND valid_to >= NOW() THEN 'ACTIVO'
    WHEN valid_from > NOW() THEN 'FUTURO'
    ELSE 'EXPIRADO'
  END as status,
  COUNT(*) as cantidad
FROM public.registration_access_codes
GROUP BY status
ORDER BY status;

-- Ver solo el código activo actual
SELECT 
  code,
  valid_from,
  valid_to,
  '✅ Este es el código que debes usar para registrarte' as nota
FROM public.registration_access_codes
WHERE valid_from <= NOW() 
  AND valid_to >= NOW()
ORDER BY valid_from DESC
LIMIT 1;

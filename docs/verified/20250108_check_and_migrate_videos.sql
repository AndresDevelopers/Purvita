-- ============================================================================
-- Script para verificar y migrar videos existentes
-- ============================================================================

-- 1. Verificar si existen videos
DO $$
DECLARE
  video_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO video_count FROM public.class_videos;
  RAISE NOTICE 'Total de videos encontrados: %', video_count;
END $$;

-- 2. Mostrar videos existentes
SELECT 
  id,
  COALESCE(title, 'Sin título') as title,
  COALESCE(description, '') as description,
  youtube_id,
  is_published,
  created_at
FROM public.class_videos
ORDER BY order_index, created_at;

-- 3. Verificar si la tabla de traducciones existe
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'class_video_translations'
  ) THEN
    RAISE NOTICE 'Tabla class_video_translations existe';
    
    -- Mostrar traducciones existentes
    RAISE NOTICE 'Traducciones existentes:';
    PERFORM id, video_id, locale, title 
    FROM public.class_video_translations;
  ELSE
    RAISE NOTICE 'Tabla class_video_translations NO existe - ejecutar migración primero';
  END IF;
END $$;

-- 4. Si la tabla de traducciones existe, migrar datos que no tengan traducción
DO $$
DECLARE
  video_record RECORD;
  translation_count INTEGER;
BEGIN
  -- Verificar si la tabla existe
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'class_video_translations'
  ) THEN
    
    -- Migrar cada video que tenga title pero no tenga traducción en inglés
    FOR video_record IN 
      SELECT id, title, description 
      FROM public.class_videos 
      WHERE title IS NOT NULL AND title != ''
    LOOP
      -- Verificar si ya existe traducción en inglés
      SELECT COUNT(*) INTO translation_count
      FROM public.class_video_translations
      WHERE video_id = video_record.id AND locale = 'en';
      
      -- Si no existe, crear traducción
      IF translation_count = 0 THEN
        INSERT INTO public.class_video_translations (video_id, locale, title, description)
        VALUES (
          video_record.id,
          'en',
          video_record.title,
          COALESCE(video_record.description, '')
        );
        RAISE NOTICE 'Migrado video % a inglés', video_record.id;
      END IF;
    END LOOP;
    
    RAISE NOTICE 'Migración completada';
  ELSE
    RAISE NOTICE 'Tabla de traducciones no existe - ejecutar 20250108_add_video_translations.sql primero';
  END IF;
END $$;

-- 5. Verificar resultado final
DO $$
DECLARE
  video_count INTEGER;
  translation_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO video_count FROM public.class_videos;
  
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'class_video_translations'
  ) THEN
    SELECT COUNT(*) INTO translation_count FROM public.class_video_translations;
    RAISE NOTICE 'Videos: %, Traducciones: %', video_count, translation_count;
  ELSE
    RAISE NOTICE 'Videos: %, Traducciones: tabla no existe', video_count;
  END IF;
END $$;

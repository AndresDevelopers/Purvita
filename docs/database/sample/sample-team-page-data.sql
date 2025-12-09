-- ============================================================
-- Team Page Content - Sample Data
-- ============================================================
-- This script inserts sample team members for the team page
-- Execute this after the team_page_content table has been created
-- ============================================================

-- Insert sample team page content for English locale
INSERT INTO public.team_page_content (locale, title, subtitle, members, featured_member_ids, updated_at)
VALUES (
  'en',
  'Meet Our Team',
  'The people behind our success',
  '[
    {
      "id": "member-001",
      "name": "Sarah Johnson",
      "role": "Chief Executive Officer",
      "description": "With over 15 years of experience in network marketing and business development, Sarah leads our vision to empower entrepreneurs worldwide.",
      "imageUrl": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop",
      "order": 0
    },
    {
      "id": "member-002",
      "name": "Michael Chen",
      "role": "Chief Technology Officer",
      "description": "Michael brings cutting-edge technology solutions to our platform, ensuring seamless experiences for all our members.",
      "imageUrl": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop",
      "order": 1
    },
    {
      "id": "member-003",
      "name": "Elena Rodriguez",
      "role": "Director of Marketing",
      "description": "Elena crafts compelling strategies that connect our products with customers around the globe.",
      "imageUrl": "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop",
      "order": 2
    },
    {
      "id": "member-004",
      "name": "David Thompson",
      "role": "Head of Customer Success",
      "description": "David ensures every member receives exceptional support and achieves their business goals.",
      "imageUrl": "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop",
      "order": 3
    },
    {
      "id": "member-005",
      "name": "Aisha Patel",
      "role": "Product Development Manager",
      "description": "Aisha leads our product innovation team, bringing the highest quality offerings to our network.",
      "imageUrl": "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&h=400&fit=crop",
      "order": 4
    },
    {
      "id": "member-006",
      "name": "James Wilson",
      "role": "Training & Education Director",
      "description": "James develops comprehensive training programs that empower our members to succeed.",
      "imageUrl": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
      "order": 5
    }
  ]'::jsonb,
  '["member-001", "member-002", "member-003"]'::jsonb,
  NOW()
)
ON CONFLICT (locale) 
DO UPDATE SET
  members = EXCLUDED.members,
  featured_member_ids = EXCLUDED.featured_member_ids,
  updated_at = NOW();

-- Insert sample team page content for Spanish locale
INSERT INTO public.team_page_content (locale, title, subtitle, members, featured_member_ids, updated_at)
VALUES (
  'es',
  'Conoce Nuestro Equipo',
  'Las personas detrás de nuestro éxito',
  '[
    {
      "id": "member-001",
      "name": "Sarah Johnson",
      "role": "Directora Ejecutiva",
      "description": "Con más de 15 años de experiencia en mercadeo en red y desarrollo empresarial, Sarah lidera nuestra visión de empoderar a emprendedores en todo el mundo.",
      "imageUrl": "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop",
      "order": 0
    },
    {
      "id": "member-002",
      "name": "Michael Chen",
      "role": "Director de Tecnología",
      "description": "Michael aporta soluciones tecnológicas de vanguardia a nuestra plataforma, garantizando experiencias fluidas para todos nuestros miembros.",
      "imageUrl": "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop",
      "order": 1
    },
    {
      "id": "member-003",
      "name": "Elena Rodriguez",
      "role": "Directora de Marketing",
      "description": "Elena crea estrategias convincentes que conectan nuestros productos con clientes de todo el mundo.",
      "imageUrl": "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop",
      "order": 2
    },
    {
      "id": "member-004",
      "name": "David Thompson",
      "role": "Jefe de Éxito del Cliente",
      "description": "David garantiza que cada miembro reciba un soporte excepcional y alcance sus objetivos empresariales.",
      "imageUrl": "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=400&h=400&fit=crop",
      "order": 3
    },
    {
      "id": "member-005",
      "name": "Aisha Patel",
      "role": "Gerente de Desarrollo de Productos",
      "description": "Aisha lidera nuestro equipo de innovación de productos, trayendo las ofertas de más alta calidad a nuestra red.",
      "imageUrl": "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=400&h=400&fit=crop",
      "order": 4
    },
    {
      "id": "member-006",
      "name": "James Wilson",
      "role": "Director de Capacitación y Educación",
      "description": "James desarrolla programas de capacitación integrales que empoderan a nuestros miembros para tener éxito.",
      "imageUrl": "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
      "order": 5
    }
  ]'::jsonb,
  '["member-001", "member-002", "member-003"]'::jsonb,
  NOW()
)
ON CONFLICT (locale) 
DO UPDATE SET
  members = EXCLUDED.members,
  featured_member_ids = EXCLUDED.featured_member_ids,
  updated_at = NOW();

-- Verify the data was inserted
SELECT 
  locale,
  title,
  subtitle,
  jsonb_array_length(members) as member_count,
  jsonb_array_length(featured_member_ids) as featured_count
FROM public.team_page_content
ORDER BY locale;

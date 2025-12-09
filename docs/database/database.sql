-- =============================================================
-- PūrVita Network - Unified Database Schema
-- Execute this script to provision the full database state
-- Consolidated from legacy incremental scripts 01-10
-- =============================================================
BEGIN;
-- -------------------------------------------------------------
-- SECTION: Core schema and RLS (legacy 01-database-schema.sql)
-- -------------------------------------------------------------
-- =============================================================
-- PūrVita Network - Complete Database Schema
-- Execute this file first to set up the core database structure
-- =============================================================
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- ===========================================
-- 0. ROLES TABLE (Role-Based Access Control)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  is_system_role BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Add comments to roles table
COMMENT ON TABLE public.roles IS 'Stores custom roles with specific permissions for role-based access control';
COMMENT ON COLUMN public.roles.name IS 'Unique name of the role';
COMMENT ON COLUMN public.roles.description IS 'Optional description of what this role can do';
COMMENT ON COLUMN public.roles.permissions IS 'Array of permission strings (e.g., view_dashboard, manage_users)';
COMMENT ON COLUMN public.roles.is_system_role IS 'If true, this role cannot be modified or deleted';

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_roles_name ON public.roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_is_system_role ON public.roles(is_system_role);

-- Enable RLS on roles table
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roles table
-- Allow all authenticated users to READ roles (needed to check permissions)
DROP POLICY IF EXISTS "roles_read_authenticated" ON public.roles;
CREATE POLICY "roles_read_authenticated" ON public.roles
  FOR SELECT
  TO authenticated
  USING (true);

-- Only Super Admins can INSERT, UPDATE, DELETE roles
DROP POLICY IF EXISTS "roles_admin_all" ON public.roles;
CREATE POLICY "roles_admin_all" ON public.roles
  FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- Grant permissions
GRANT SELECT ON public.roles TO authenticated;
GRANT ALL ON public.roles TO service_role;

-- Insert default system roles (Super Admin and Member only)
INSERT INTO public.roles (name, description, permissions, is_system_role)
VALUES
  (
    'Super Admin',
    'Full system access with all permissions',
    ARRAY[
      'view_dashboard',
      'manage_users',
      'manage_products',
      'manage_orders',
      'manage_payments',
      'manage_plans',
      'manage_content',
      'manage_settings',
      'view_reports',
      'manage_security',
      'manage_roles'
    ],
    true
  ),
  (
    'Member',
    'Default role for regular users with basic access',
    ARRAY['view_dashboard'],
    true
  )
ON CONFLICT (name) DO NOTHING;

-- Helper function to check if a user is a Super Admin
-- This replaces the old `profiles.role = 'admin'` checks in RLS policies
CREATE OR REPLACE FUNCTION public.is_super_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    INNER JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = user_id
      AND r.name = 'Super Admin'
      AND r.is_system_role = true
  );
$$;

COMMENT ON FUNCTION public.is_super_admin IS 'Returns true if the user has the Super Admin role';

-- Helper function to check if a user has access_admin_panel permission
-- This is used for RLS policies to verify admin access based on permissions
CREATE OR REPLACE FUNCTION public.has_admin_access(user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    INNER JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = user_id
      AND 'access_admin_panel' = ANY(r.permissions)
  );
$$;

COMMENT ON FUNCTION public.has_admin_access IS 'Returns true if the user has access_admin_panel permission in their role';

-- Helper function to check if a user has a specific permission
-- This is a generic function that can check any permission
CREATE OR REPLACE FUNCTION public.has_permission(user_id UUID, permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    INNER JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = user_id
      AND permission_name = ANY(r.permissions)
  );
$$;

COMMENT ON FUNCTION public.has_permission IS 'Returns true if the user has the specified permission in their role';

-- ===========================================
-- 1. PROFILES TABLE (Core user management)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.profiles(
  id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL, -- New RBAC system
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  referral_code text UNIQUE,
  referred_by uuid REFERENCES public.profiles(id),
  team_count integer NOT NULL DEFAULT 0,
  phone text,
  address text,
  city text,
  state text,
  postal_code text,
  country text,
  fulfillment_company text,
  avatar_url text,
  stripe_customer_id text,
  default_payment_provider text CHECK (default_payment_provider IN ('paypal', 'stripe', 'wallet')),
  commission_rate numeric(5, 2) DEFAULT 0.10,
  total_earnings numeric(10, 2) DEFAULT 0.00,
  pay boolean NOT NULL DEFAULT FALSE, -- For paid classes access
  affiliate_store_slug text UNIQUE, -- Public slug for affiliate store URL (/[lang]/affiliate/{slug})
  affiliate_store_title text, -- Custom title for affiliate store page
  affiliate_store_banner_url text, -- Banner image URL for affiliate store page
  affiliate_store_logo_url text, -- Logo image URL for affiliate store header
  affiliate_seo_keywords text, -- Custom SEO keywords for affiliate store page (comma-separated)
  -- Privacy settings
  show_reviews boolean DEFAULT true,
  allow_personalized_recommendations boolean DEFAULT true,
  allow_team_messages boolean DEFAULT true,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- Add comments to columns
COMMENT ON COLUMN public.profiles.role_id IS 'Reference to custom role for RBAC (replaces legacy role column)';
COMMENT ON COLUMN public.profiles.affiliate_seo_keywords IS 'Custom SEO keywords for affiliate store page (comma-separated)';
COMMENT ON COLUMN public.profiles.show_reviews IS 'Show product reviews and ratings publicly';
COMMENT ON COLUMN public.profiles.allow_personalized_recommendations IS 'Enable personalized product recommendations based on activity';
COMMENT ON COLUMN public.profiles.allow_team_messages IS 'Allow team members to send messages (shows message button in team tree)';

-- Create index for role_id
CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON public.profiles(role_id);
-- Create index for affiliate_store_slug for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_affiliate_store_slug ON public.profiles(affiliate_store_slug) WHERE affiliate_store_slug IS NOT NULL;
-- Enable RLS and create policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_read_authenticated" ON public.profiles;
CREATE POLICY "profiles_read_authenticated" ON public.profiles
  FOR SELECT
    USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE
    USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
CREATE POLICY "profiles_insert_self" ON public.profiles
  FOR INSERT
    WITH CHECK (auth.uid() = id);
-- Index for team count queries
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by)
WHERE
  referred_by IS NOT NULL;
-- Function to recalculate team count for a specific user
-- Only counts users with active subscriptions
CREATE OR REPLACE FUNCTION public.recalculate_team_count(sponsor_id uuid)
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
DECLARE
  new_count integer;
BEGIN
  SELECT
    COUNT(*) INTO new_count
  FROM
    public.profiles p
  INNER JOIN
    public.subscriptions s ON s.user_id = p.id
  WHERE
    p.referred_by = sponsor_id
    AND s.status = 'active';
  UPDATE
    public.profiles
  SET
    team_count = new_count,
    updated_at = NOW()
  WHERE
    id = sponsor_id;
  RETURN new_count;
END;
$$;
-- Function to update team counts when referred_by changes
-- Note: INSERT no longer updates team_count automatically
-- Team count is now updated only when subscription status changes
CREATE OR REPLACE FUNCTION public.update_team_counts()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
BEGIN
  -- Handle UPDATE of referred_by field
  IF(TG_OP = 'UPDATE'
      AND(OLD.referred_by IS DISTINCT FROM NEW.referred_by)) THEN
    -- Recalculate for old sponsor if exists
    IF OLD.referred_by IS NOT NULL THEN
      PERFORM public.recalculate_team_count(OLD.referred_by);
    END IF;
    -- Recalculate for new sponsor if exists
    IF NEW.referred_by IS NOT NULL THEN
      PERFORM public.recalculate_team_count(NEW.referred_by);
    END IF;
  -- Handle DELETE
  ELSIF(TG_OP = 'DELETE'
      AND OLD.referred_by IS NOT NULL) THEN
    PERFORM public.recalculate_team_count(OLD.referred_by);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;
-- Trigger for automatic team count updates
DROP TRIGGER IF EXISTS trigger_update_team_counts ON public.profiles;
CREATE TRIGGER trigger_update_team_counts
  AFTER INSERT OR UPDATE OF referred_by OR DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_team_counts();
-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.recalculate_team_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_team_count(UUID) TO service_role;
-- ===========================================
-- UTILITY FUNCTIONS
-- ===========================================
-- Generic function to handle updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
  RETURNS TRIGGER
  AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$
LANGUAGE plpgsql;

-- Alias for compatibility with different naming conventions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
  RETURNS TRIGGER
  AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$
LANGUAGE plpgsql;
-- ===========================================
-- 2. PRODUCTS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.products(
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  price numeric(10, 2) NOT NULL,
  discount_type text CHECK (discount_type IN ('amount', 'percentage')),
  discount_value numeric(10, 2),
  discount_label text,
  discount_visibility text[] NOT NULL DEFAULT ARRAY['main_store', 'affiliate_store', 'mlm_store']::text[],
  images jsonb NOT NULL DEFAULT '[]' ::jsonb,
  is_featured boolean DEFAULT FALSE,
  cart_visibility_countries text[] NOT NULL DEFAULT '{}' ::text[],
  related_product_ids text[] NOT NULL DEFAULT '{}' ::text[],
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);
-- Enable RLS and create policies
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
-- Public read access for landing page
DROP POLICY IF EXISTS "products_read_public" ON public.products;
CREATE POLICY "products_read_public" ON public.products
  FOR SELECT
    USING (TRUE);
-- Admin management policies
DROP POLICY IF EXISTS "products_insert_authenticated" ON public.products;
CREATE POLICY "products_insert_authenticated" ON public.products
  FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "products_update_admin" ON public.products;
CREATE POLICY "products_update_admin" ON public.products
  FOR UPDATE
    USING (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "products_delete_admin" ON public.products;
CREATE POLICY "products_delete_admin" ON public.products
  FOR DELETE
    USING (public.is_super_admin(auth.uid()));
-- ===========================================
-- 3. PLANS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.plans(
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  name_en text,
  name_es text,
  description text NOT NULL,
);
-- Enable RLS and create policies
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
-- Public read access
DROP POLICY IF EXISTS "plans_read_public" ON public.plans;
CREATE POLICY "plans_read_public" ON public.plans
  FOR SELECT
    USING (TRUE);
-- Admin management policies
DROP POLICY IF EXISTS "plans_insert_authenticated" ON public.plans;
CREATE POLICY "plans_insert_authenticated" ON public.plans
  FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "plans_update_admin" ON public.plans;
CREATE POLICY "plans_update_admin" ON public.plans
  FOR UPDATE
    USING (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "plans_delete_admin" ON public.plans;
CREATE POLICY "plans_delete_admin" ON public.plans
  FOR DELETE
    USING (public.is_super_admin(auth.uid()));
-- Indexes for plans
CREATE INDEX IF NOT EXISTS idx_plans_display_order ON public.plans(display_order);
CREATE INDEX IF NOT EXISTS idx_plans_is_default ON public.plans(is_default) WHERE is_default = TRUE;
-- Unique constraint to ensure only one default plan
CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_single_default ON public.plans(is_default) WHERE is_default = TRUE;
-- ===========================================
-- 4. CLASS VIDEOS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.class_videos(
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  youtube_id text NOT NULL,
  category text,
  visibility text DEFAULT 'all' CHECK (visibility IN ('subscription', 'product', 'all')),
  allowed_levels integer[] DEFAULT NULL,
  is_published boolean NOT NULL DEFAULT TRUE,
  is_featured boolean DEFAULT FALSE,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Enable RLS and create policies
ALTER TABLE public.class_videos ENABLE ROW LEVEL SECURITY;
-- Only authenticated users can view published class videos
DROP POLICY IF EXISTS "class_videos_authenticated" ON public.class_videos;
CREATE POLICY "class_videos_authenticated" ON public.class_videos
  FOR SELECT
    USING (auth.role() = 'authenticated'
      AND is_published = TRUE);
-- Service role can manage all videos
DROP POLICY IF EXISTS "class_videos_service_role" ON public.class_videos;
CREATE POLICY "class_videos_service_role" ON public.class_videos
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
-- ===========================================
-- 4a. CLASS VIDEO TRANSLATIONS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.class_video_translations(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES public.class_videos(id) ON DELETE CASCADE,
  locale varchar(10) NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  UNIQUE (video_id, locale)
);
-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_video_translations_video_id ON public.class_video_translations(video_id);
CREATE INDEX IF NOT EXISTS idx_video_translations_locale ON public.class_video_translations(locale);
-- Enable RLS
ALTER TABLE public.class_video_translations ENABLE ROW LEVEL SECURITY;
-- Policy: Anyone can read published video translations
DROP POLICY IF EXISTS "video_translations_read_public" ON public.class_video_translations;
CREATE POLICY "video_translations_read_public" ON public.class_video_translations
  FOR SELECT
    USING (TRUE);
-- Policy: Only admins can insert translations
DROP POLICY IF EXISTS "video_translations_admin_insert" ON public.class_video_translations;
CREATE POLICY "video_translations_admin_insert" ON public.class_video_translations
  FOR INSERT
    WITH CHECK (public.is_super_admin(auth.uid()));
-- Policy: Only admins can update translations
DROP POLICY IF EXISTS "video_translations_admin_update" ON public.class_video_translations;
CREATE POLICY "video_translations_admin_update" ON public.class_video_translations
  FOR UPDATE
    USING (public.is_super_admin(auth.uid()));
-- Policy: Only admins can delete translations
DROP POLICY IF EXISTS "video_translations_admin_delete" ON public.class_video_translations;
CREATE POLICY "video_translations_admin_delete" ON public.class_video_translations
  FOR DELETE
    USING (public.is_super_admin(auth.uid()));
-- Service role can manage all translations
DROP POLICY IF EXISTS "video_translations_service_role" ON public.class_video_translations;
CREATE POLICY "video_translations_service_role" ON public.class_video_translations
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
-- Migrate existing data from class_videos to translations
-- This will create translations for existing videos using 'en' as default locale
INSERT INTO public.class_video_translations(video_id, locale, title, description, created_at, updated_at)
SELECT
  id AS video_id,
  'en' AS locale,
  title,
  COALESCE(description, '') AS description,
  created_at,
  updated_at
FROM
  public.class_videos
ON CONFLICT (video_id,
  locale)
  DO NOTHING;
-- Function to update video translation updated_at timestamp
CREATE OR REPLACE FUNCTION update_video_translation_updated_at()
  RETURNS TRIGGER
  AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$
LANGUAGE plpgsql;
-- Trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS update_video_translation_timestamp ON public.class_video_translations;
CREATE TRIGGER update_video_translation_timestamp
  BEFORE UPDATE ON public.class_video_translations
  FOR EACH ROW
  EXECUTE FUNCTION update_video_translation_updated_at();
-- ===========================================
-- 5. PRODUCT REVIEWS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.product_reviews(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL CHECK (char_length(btrim(comment)) > 0),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
CREATE UNIQUE INDEX IF NOT EXISTS product_reviews_product_user_unique_idx ON public.product_reviews(product_id, user_id);
CREATE INDEX IF NOT EXISTS product_reviews_product_created_at_idx ON public.product_reviews(product_id, created_at DESC);
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_reviews_public_read" ON public.product_reviews;
CREATE POLICY "product_reviews_public_read" ON public.product_reviews
  FOR SELECT
    USING (TRUE);
DROP POLICY IF EXISTS "product_reviews_authenticated_insert" ON public.product_reviews;
CREATE POLICY "product_reviews_authenticated_insert" ON public.product_reviews
  FOR INSERT
    WITH CHECK (auth.role() = 'authenticated'
    AND auth.uid() = user_id);
DROP POLICY IF EXISTS "product_reviews_authenticated_modify" ON public.product_reviews;
CREATE POLICY "product_reviews_authenticated_modify" ON public.product_reviews
  FOR UPDATE
    USING (auth.role() = 'authenticated'
      AND auth.uid() = user_id)
      WITH CHECK (auth.role() = 'authenticated'
      AND auth.uid() = user_id);
DROP POLICY IF EXISTS "product_reviews_authenticated_delete" ON public.product_reviews;
CREATE POLICY "product_reviews_authenticated_delete" ON public.product_reviews
  FOR DELETE
    USING (auth.role() = 'authenticated'
      AND auth.uid() = user_id);
DROP POLICY IF EXISTS "product_reviews_service_role" ON public.product_reviews;
CREATE POLICY "product_reviews_service_role" ON public.product_reviews
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
GRANT SELECT ON public.product_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_reviews TO authenticated;
GRANT ALL ON public.product_reviews TO service_role;
-- ===========================================
-- 6. WALLET, SUBSCRIPTION & ORDER TABLES
-- ===========================================
-- Wallet ledger balances per user ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallets(
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance_cents bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wallets_read_self" ON public.wallets;
CREATE POLICY "wallets_read_self" ON public.wallets
  FOR SELECT
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "wallets_insert_self" ON public.wallets;
CREATE POLICY "wallets_insert_self" ON public.wallets
  FOR INSERT
    WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "wallets_update_self" ON public.wallets;
CREATE POLICY "wallets_update_self" ON public.wallets
  FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "wallets_service_role" ON public.wallets;
CREATE POLICY "wallets_service_role" ON public.wallets
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
-- Wallet transactions history ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wallet_txns(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  delta_cents bigint NOT NULL,
  reason text NOT NULL CHECK (reason IN ('phase_bonus', 'withdrawal', 'sale_commission', 'purchase', 'recharge', 'admin_adjustment')),
  meta jsonb NOT NULL DEFAULT '{}' ::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
ALTER TABLE public.wallet_txns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wallet_txns_read_self" ON public.wallet_txns;
CREATE POLICY "wallet_txns_read_self" ON public.wallet_txns
  FOR SELECT
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "wallet_txns_service_role" ON public.wallet_txns;
CREATE POLICY "wallet_txns_service_role" ON public.wallet_txns
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
-- Network commission ledger ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.network_commissions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  available_cents bigint NOT NULL DEFAULT 0 CHECK (available_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  level INTEGER CHECK (level >= 1 AND level <= 10),
  metadata jsonb DEFAULT '{}' ::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CHECK (available_cents <= amount_cents)
);
COMMENT ON TABLE public.network_commissions IS 'Stores MLM network commissions earned from team member purchases';
COMMENT ON COLUMN public.network_commissions.user_id IS 'The user who earned the commission (sponsor/upline)';
COMMENT ON COLUMN public.network_commissions.member_id IS 'The team member who made the purchase';
COMMENT ON COLUMN public.network_commissions.level IS 'MLM level (1=direct, 2=second level, etc.)';
COMMENT ON COLUMN public.network_commissions.metadata IS 'Additional data like order_id, product info, etc.';
ALTER TABLE public.network_commissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "network_commissions_read_self" ON public.network_commissions;
CREATE POLICY "network_commissions_read_self" ON public.network_commissions
  FOR SELECT
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "network_commissions_service_role" ON public.network_commissions;
CREATE POLICY "network_commissions_service_role" ON public.network_commissions
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
-- External payout accounts -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payout_accounts(
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  account_id text,
  status text NOT NULL CHECK (status IN ('pending', 'active', 'restricted', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
ALTER TABLE public.payout_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payout_accounts_read_self" ON public.payout_accounts;
CREATE POLICY "payout_accounts_read_self" ON public.payout_accounts
  FOR SELECT
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "payout_accounts_service_role" ON public.payout_accounts;
CREATE POLICY "payout_accounts_service_role" ON public.payout_accounts
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
-- User payout preferences -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payout_preferences(
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  auto_payout_threshold_cents integer NOT NULL DEFAULT 900 CHECK (auto_payout_threshold_cents >= 900),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
ALTER TABLE public.payout_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payout_preferences_read_self" ON public.payout_preferences;
CREATE POLICY "payout_preferences_read_self" ON public.payout_preferences
  FOR SELECT
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "payout_preferences_service_role" ON public.payout_preferences;
CREATE POLICY "payout_preferences_service_role" ON public.payout_preferences
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
-- Audit trail of processed payouts (Stripe, PayPal, etc.)
CREATE TABLE IF NOT EXISTS public.payout_transactions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'USD',
  provider text NOT NULL CHECK (provider IN ('stripe', 'paypal', 'manual')),
  external_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'canceled')),
  estimated_arrival timestamptz,
  completed_at timestamptz,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}' ::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.payout_transactions IS 'Tracks outgoing payouts to external providers with status transitions.';
ALTER TABLE public.payout_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payout_transactions_read_self" ON public.payout_transactions;
CREATE POLICY "payout_transactions_read_self" ON public.payout_transactions
  FOR SELECT
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "payout_transactions_service_role" ON public.payout_transactions;
CREATE POLICY "payout_transactions_service_role" ON public.payout_transactions
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
-- Webhook deduplication registry for external providers
CREATE TABLE IF NOT EXISTS public.webhook_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('stripe', 'paypal')),
  event_id text NOT NULL,
  event_type text,
  payload jsonb,
  processed_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.webhook_events IS 'Keeps track of processed webhook event identifiers to guarantee idempotency.';
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "webhook_events_service_role" ON public.webhook_events;
CREATE POLICY "webhook_events_service_role" ON public.webhook_events
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
-- Function to sync payout preferences with payment schedule
CREATE OR REPLACE FUNCTION public.sync_payout_preferences_with_schedule()
  RETURNS TRIGGER
  AS $$
BEGIN
  -- When default_amount_cents is updated, ensure all user preferences
  -- meet the new minimum threshold
  IF NEW.default_amount_cents IS DISTINCT FROM OLD.default_amount_cents THEN
    UPDATE
      public.payout_preferences
    SET
      auto_payout_threshold_cents = GREATEST(auto_payout_threshold_cents, NEW.default_amount_cents),
      updated_at = timezone('utc', now())
    WHERE
      auto_payout_threshold_cents < NEW.default_amount_cents;
  END IF;
  RETURN NEW;
END;
$$
LANGUAGE plpgsql
SECURITY DEFINER;
-- Create a function to validate payout preferences against schedule
CREATE OR REPLACE FUNCTION public.validate_payout_preference_minimum()
  RETURNS TRIGGER
  AS $$
DECLARE
  min_amount integer;
BEGIN
  -- Get the minimum amount from payment schedule
  SELECT
    default_amount_cents INTO min_amount
  FROM
    public.payment_schedule_settings
  LIMIT 1;
  -- Ensure the new threshold meets the minimum
  IF min_amount IS NOT NULL AND NEW.auto_payout_threshold_cents < min_amount THEN
    NEW.auto_payout_threshold_cents := min_amount;
  END IF;
  RETURN NEW;
END;
$$
LANGUAGE plpgsql
SECURITY DEFINER;
-- Create trigger to validate preferences on insert/update
DROP TRIGGER IF EXISTS validate_payout_preference_on_change ON public.payout_preferences;
CREATE TRIGGER validate_payout_preference_on_change
  BEFORE INSERT OR UPDATE ON public.payout_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_payout_preference_minimum();
-- Subscription status snapshot ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  subscription_type text NOT NULL DEFAULT 'mlm' CHECK (subscription_type IN ('mlm', 'affiliate')),
  status text NOT NULL CHECK (status IN ('active', 'past_due', 'canceled', 'unpaid')),
  current_period_end timestamptz,
  gateway text NOT NULL CHECK (gateway IN ('stripe', 'paypal', 'wallet')),
  cancel_at_period_end boolean NOT NULL DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
-- Only one subscription per user (MLM and Affiliate are mutually exclusive)
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_unique_idx ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_type ON public.subscriptions(subscription_type);
COMMENT ON COLUMN public.subscriptions.subscription_type IS 'Type: mlm or affiliate. Mutually exclusive - user can only have one active subscription. Both give access to personalized store.';
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscriptions_read_self" ON public.subscriptions;
CREATE POLICY "subscriptions_read_self" ON public.subscriptions
  FOR SELECT
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "subscriptions_service_role" ON public.subscriptions;
CREATE POLICY "subscriptions_service_role" ON public.subscriptions
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
-- Payment ledger ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL CHECK (status IN ('paid', 'failed', 'refunded')),
  kind text NOT NULL CHECK (kind IN ('subscription', 'order')),
  gateway text NOT NULL CHECK (gateway IN ('stripe', 'paypal', 'wallet')),
  gateway_ref text NOT NULL,
  period_end timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}' ::jsonb,
  archived boolean NOT NULL DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
CREATE UNIQUE INDEX IF NOT EXISTS payments_gateway_ref_unique_idx ON public.payments(gateway_ref);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payments_read_self" ON public.payments;
CREATE POLICY "payments_read_self" ON public.payments
  FOR SELECT
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "payments_service_role" ON public.payments;
CREATE POLICY "payments_service_role" ON public.payments
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
-- Stored payment methods saved after checkout or billing flows
CREATE TABLE IF NOT EXISTS public.payment_methods(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_payment_method_id text NOT NULL,
  type text NOT NULL CHECK (type IN ('card', 'bank_account')),
  card_brand text,
  card_last4 text,
  card_exp_month smallint,
  card_exp_year smallint,
  card_funding text,
  bank_name text,
  bank_last4 text,
  billing_name text,
  billing_email text,
  billing_address jsonb NOT NULL DEFAULT '{}' ::jsonb,
  is_default boolean NOT NULL DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT payment_methods_card_exp_valid CHECK (
    (card_exp_month IS NULL AND card_exp_year IS NULL)
    OR (card_exp_month BETWEEN 1 AND 12 AND card_exp_year >= 2000)
  )
);
COMMENT ON TABLE public.payment_methods IS 'Reusable customer payment methods synchronized from Stripe billing flows.';
COMMENT ON COLUMN public.payment_methods.billing_address IS 'Normalized billing address payload captured during payment method creation.';
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_methods_read_self" ON public.payment_methods;
CREATE POLICY "payment_methods_read_self" ON public.payment_methods
  FOR SELECT
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "payment_methods_insert_self" ON public.payment_methods;
CREATE POLICY "payment_methods_insert_self" ON public.payment_methods
  FOR INSERT
    WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "payment_methods_update_self" ON public.payment_methods;
CREATE POLICY "payment_methods_update_self" ON public.payment_methods
  FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "payment_methods_delete_self" ON public.payment_methods;
CREATE POLICY "payment_methods_delete_self" ON public.payment_methods
  FOR DELETE
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "payment_methods_service_role" ON public.payment_methods;
CREATE POLICY "payment_methods_service_role" ON public.payment_methods
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
-- Payment history management --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_history_entries(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name_snapshot text,
  user_email_snapshot text,
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL CHECK (status IN ('paid', 'pending', 'overdue', 'upcoming')),
  due_date timestamptz NOT NULL,
  paid_at timestamptz,
  next_due_date timestamptz,
  method text NOT NULL CHECK (method IN ('card', 'bank_transfer', 'cash', 'wallet')),
  manual boolean NOT NULL DEFAULT FALSE,
  notes text,
  recorded_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
ALTER TABLE public.payment_history_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_history_admin_select" ON public.payment_history_entries;
CREATE POLICY "payment_history_admin_select" ON public.payment_history_entries
  FOR SELECT
    USING (auth.role() = 'service_role' OR public.has_admin_access(auth.uid()));
DROP POLICY IF EXISTS "payment_history_admin_mutate" ON public.payment_history_entries;
CREATE POLICY "payment_history_admin_mutate" ON public.payment_history_entries
  FOR INSERT
    WITH CHECK (public.has_admin_access(auth.uid()));
DROP POLICY IF EXISTS "payment_history_admin_update" ON public.payment_history_entries;
CREATE POLICY "payment_history_admin_update" ON public.payment_history_entries
  FOR UPDATE
    USING (auth.role() = 'service_role' OR public.has_admin_access(auth.uid()))
    WITH CHECK (auth.role() = 'service_role' OR public.has_admin_access(auth.uid()));
DROP POLICY IF EXISTS "payment_history_service_role" ON public.payment_history_entries;
CREATE POLICY "payment_history_service_role" ON public.payment_history_entries
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
CREATE INDEX IF NOT EXISTS idx_payment_history_user ON public.payment_history_entries(user_id, due_date DESC);
CREATE INDEX IF NOT EXISTS idx_payment_history_status ON public.payment_history_entries(status);
CREATE INDEX IF NOT EXISTS idx_payment_history_due_date ON public.payment_history_entries(due_date DESC);
-- Function to validate payment reminder days
CREATE OR REPLACE FUNCTION public.validate_payment_reminder_days(reminders smallint[])
  RETURNS boolean
  LANGUAGE plpgsql
  IMMUTABLE
  AS $$
DECLARE
  reminder smallint;
BEGIN
  IF reminders IS NULL THEN
    RETURN TRUE;
  END IF;
  IF cardinality(reminders) > 3 THEN
    RETURN FALSE;
  END IF;
  FOREACH reminder IN ARRAY reminders LOOP
    IF reminder < 0 OR reminder > 30 THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  RETURN TRUE;
END;
$$;
-- Recurring payment cadence ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_schedule_settings(
  id boolean PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
  day_of_month smallint CHECK (day_of_month BETWEEN 1 AND 28),
  weekday smallint CHECK (weekday BETWEEN 0 AND 6),
  reminder_days_before smallint[] NOT NULL DEFAULT ARRAY[3, 1] ::smallint[],
  default_amount_cents bigint NOT NULL CHECK (default_amount_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  payment_mode text NOT NULL DEFAULT 'automatic' CHECK (payment_mode IN ('manual', 'automatic')),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_by uuid REFERENCES public.profiles(id),
  CONSTRAINT payment_schedule_reminders_length CHECK (cardinality(reminder_days_before) <= 3),
  CONSTRAINT payment_schedule_reminders_bounds CHECK (public.validate_payment_reminder_days(reminder_days_before))
);
ALTER TABLE public.payment_schedule_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_schedule_admin_select" ON public.payment_schedule_settings;
CREATE POLICY "payment_schedule_admin_select" ON public.payment_schedule_settings
  FOR SELECT
    USING (auth.role() = 'service_role' OR public.has_admin_access(auth.uid()));
DROP POLICY IF EXISTS "payment_schedule_admin_insert" ON public.payment_schedule_settings;
CREATE POLICY "payment_schedule_admin_insert" ON public.payment_schedule_settings
  FOR INSERT
    WITH CHECK (auth.role() = 'service_role' OR public.has_admin_access(auth.uid()));
DROP POLICY IF EXISTS "payment_schedule_admin_update" ON public.payment_schedule_settings;
CREATE POLICY "payment_schedule_admin_update" ON public.payment_schedule_settings
  FOR UPDATE
    USING (auth.role() = 'service_role' OR public.has_admin_access(auth.uid()))
    WITH CHECK (auth.role() = 'service_role' OR public.has_admin_access(auth.uid()));
DROP POLICY IF EXISTS "payment_schedule_service_role" ON public.payment_schedule_settings;
CREATE POLICY "payment_schedule_service_role" ON public.payment_schedule_settings
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
INSERT INTO public.payment_schedule_settings(id, frequency, day_of_month, weekday, reminder_days_before, default_amount_cents, currency)
  VALUES (TRUE, 'monthly', 10, NULL, ARRAY[3, 1]::smallint[], 3499, 'USD')
ON CONFLICT (id)
  DO NOTHING;
-- Create trigger to sync preferences when schedule is updated
DROP TRIGGER IF EXISTS sync_payout_preferences_on_schedule_update ON public.payment_schedule_settings;
CREATE TRIGGER sync_payout_preferences_on_schedule_update
  AFTER UPDATE ON public.payment_schedule_settings
  FOR EACH ROW
  WHEN(NEW.default_amount_cents IS DISTINCT FROM OLD.default_amount_cents)
  EXECUTE FUNCTION public.sync_payout_preferences_with_schedule();
-- Orders capture customer purchases and payment metadata
CREATE TABLE IF NOT EXISTS public.orders(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'paid', 'fulfilled', 'canceled', 'refunded', 'failed')),
  total_cents bigint NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  tax_cents bigint NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  shipping_cents bigint NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
  discount_cents bigint NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  gateway text CHECK (gateway IN ('stripe', 'paypal', 'wallet')),
  gateway_transaction_id text,
  purchase_source text NOT NULL DEFAULT 'main_store' CHECK (purchase_source IN ('main_store', 'affiliate_store')),
  metadata jsonb NOT NULL DEFAULT '{}' ::jsonb,
  archived boolean NOT NULL DEFAULT FALSE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.orders IS 'Customer orders with totals, gateway metadata and archival support.';
COMMENT ON COLUMN public.orders.metadata IS 'Serialized snapshot containing cart items, checkout context and auxiliary notes.';
COMMENT ON COLUMN public.orders.purchase_source IS 'Source of the purchase: main_store (direct from main products page) or affiliate_store (from affiliate page).';
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orders_read_self" ON public.orders;
CREATE POLICY "orders_read_self" ON public.orders
  FOR SELECT
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "orders_update_self" ON public.orders;
CREATE POLICY "orders_update_self" ON public.orders
  FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "orders_service_role" ON public.orders;
CREATE POLICY "orders_service_role" ON public.orders
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
-- Prevent non-service users from editing sensitive order fields
CREATE OR REPLACE FUNCTION public.enforce_order_user_updates()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    IF NEW.user_id <> OLD.user_id
      OR NEW.total_cents <> OLD.total_cents
      OR NEW.tax_cents <> OLD.tax_cents
      OR NEW.shipping_cents <> OLD.shipping_cents
      OR NEW.discount_cents <> OLD.discount_cents
      OR COALESCE(NEW.gateway, '') <> COALESCE(OLD.gateway, '')
      OR COALESCE(NEW.gateway_transaction_id, '') <> COALESCE(OLD.gateway_transaction_id, '')
      OR NEW.status <> OLD.status
      OR NEW.currency <> OLD.currency
      OR NEW.metadata IS DISTINCT FROM OLD.metadata THEN
      RAISE EXCEPTION 'Only archival updates are allowed for standard users';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_order_user_updates ON public.orders;
CREATE TRIGGER enforce_order_user_updates
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_order_user_updates();
-- Individual order line items --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  qty integer NOT NULL DEFAULT 1 CHECK (qty > 0),
  price_cents bigint NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  metadata jsonb NOT NULL DEFAULT '{}' ::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order_items_read_self" ON public.order_items;
CREATE POLICY "order_items_read_self" ON public.order_items
  FOR SELECT
    USING (EXISTS (
      SELECT
        1
      FROM
        public.orders
      WHERE
        public.orders.id = order_id AND public.orders.user_id = auth.uid()));
DROP POLICY IF EXISTS "order_items_service_role" ON public.order_items;
CREATE POLICY "order_items_service_role" ON public.order_items
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
-- Order fulfillment view for warehouse operations
DROP VIEW IF EXISTS public.order_fulfillment_view;
CREATE VIEW public.order_fulfillment_view AS
SELECT
  o.id AS order_id,
  o.created_at AS order_created_at,
  o.status AS order_status,
  o.total_cents AS order_total_cents,
  COALESCE(o.tax_cents, 0) AS order_tax_cents,
  COALESCE(o.shipping_cents, 0) AS order_shipping_cents,
  COALESCE(o.discount_cents, 0) AS order_discount_cents,
  o.currency,
  o.purchase_source,
  o.user_id AS customer_id,
  p.name AS customer_name,
  p.email AS customer_email,
  p.phone AS customer_phone,
  p.address AS address_line,
  p.city,
  p.state,
  p.postal_code,
  p.country,
  oi.id AS order_item_id,
  oi.product_id,
  pr.name AS product_name,
  COALESCE(oi.qty, 0) AS quantity,
  COALESCE(oi.price_cents, 0) AS unit_price_cents,
  COALESCE(oi.qty, 0) * COALESCE(oi.price_cents, 0) AS line_total_cents
FROM
  public.orders o
  JOIN public.profiles p ON p.id = o.user_id
  LEFT JOIN public.order_items oi ON oi.order_id = o.id
  LEFT JOIN public.products pr ON pr.id = oi.product_id;
COMMENT ON VIEW public.order_fulfillment_view IS 'Denormalised orders with customer and line item details for fulfillment dashboards.';
-- Multilevel phase tracking ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.phases(
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  phase integer NOT NULL DEFAULT 0 CHECK (phase BETWEEN 0 AND 3),
  ecommerce_commission numeric(5, 4) NOT NULL DEFAULT 0.08,
  phase1_granted boolean NOT NULL DEFAULT FALSE,
  phase2_granted boolean NOT NULL DEFAULT FALSE,
  phase3_granted boolean NOT NULL DEFAULT FALSE,
  phase2_achieved_at timestamptz,
  manual_phase_override boolean NOT NULL DEFAULT FALSE,
  highest_phase_achieved integer NOT NULL DEFAULT 0 CHECK (highest_phase_achieved BETWEEN 0 AND 3),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON COLUMN public.phases.manual_phase_override IS 'Indicates if the phase was manually set by an admin. When true, automatic phase recalculation will not downgrade the user.';
COMMENT ON COLUMN public.phases.highest_phase_achieved IS 'Tracks the highest phase level this user has ever achieved. Used to prevent phase downgrades on subscription reactivation.';
ALTER TABLE public.phases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "phases_read_self" ON public.phases;
CREATE POLICY "phases_read_self" ON public.phases
  FOR SELECT
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "phases_service_role" ON public.phases;
CREATE POLICY "phases_service_role" ON public.phases
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
-- ===========================================
-- USER DETAILS VIEW
-- ===========================================
CREATE OR REPLACE VIEW public.user_details_view AS
WITH latest_subscriptions AS (
  SELECT DISTINCT ON (user_id) *
  FROM public.subscriptions
  ORDER BY user_id, created_at DESC
)
SELECT
  p.*,
  r.name AS role_name,
  r.permissions AS role_permissions,
  ph.phase,
  s.id AS subscription_id,
  s.plan_id,
  s.subscription_type,
  s.status AS subscription_status,
  s.current_period_end,
  s.gateway,
  s.cancel_at_period_end
FROM public.profiles p
LEFT JOIN public.roles r ON p.role_id = r.id
LEFT JOIN public.phases ph ON p.id = ph.user_id
LEFT JOIN latest_subscriptions s ON p.id = s.user_id;

COMMENT ON VIEW public.user_details_view IS 'Consolidated view of user profiles with their current phase and subscription status. Subscription can be either MLM or Affiliate type (mutually exclusive).';

GRANT SELECT ON public.user_details_view TO authenticated;
GRANT SELECT ON public.user_details_view TO service_role;

-- Phase levels configuration table --------------------------------------------
CREATE TABLE IF NOT EXISTS public.phase_levels(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level INTEGER NOT NULL UNIQUE CHECK (level BETWEEN 0 AND 10),
  name text NOT NULL,
  name_en text,
  name_es text,
  commission_rate numeric(6, 4) NOT NULL DEFAULT 0,
  subscription_discount_rate numeric(6, 4) NOT NULL DEFAULT 0,
  credit_cents bigint NOT NULL DEFAULT 0 CHECK (credit_cents >= 0),
  free_product_value_cents bigint NOT NULL DEFAULT 0 CHECK (free_product_value_cents >= 0),
  is_active boolean NOT NULL DEFAULT TRUE,
  display_order integer NOT NULL DEFAULT 0,
  -- Landing page content fields (multilingual)
  descriptor_en text,
  descriptor_es text,
  requirement_en text,
  requirement_es text,
  rewards_en text[],
  rewards_es text[],
  visibility_tag_en text,
  visibility_tag_es text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.phase_levels IS 'Configurable phase metadata including commission, credit, and free product values per level.';
COMMENT ON COLUMN public.phase_levels.level IS 'Phase level identifier (0-10) used across MLM and rewards services.';
COMMENT ON COLUMN public.phase_levels.credit_cents IS 'Monthly credit amount (in cents) granted to members at this phase.';
COMMENT ON COLUMN public.phase_levels.free_product_value_cents IS 'Monetary value (in cents) of the free product reward for this phase.';
COMMENT ON COLUMN public.phase_levels.subscription_discount_rate IS 'Personal e-commerce discount applied when the member maintains an active subscription.';
COMMENT ON COLUMN public.phase_levels.descriptor_en IS 'English description of the phase shown on landing page';
COMMENT ON COLUMN public.phase_levels.descriptor_es IS 'Spanish description of the phase shown on landing page';
COMMENT ON COLUMN public.phase_levels.requirement_en IS 'English requirement text to achieve this phase';
COMMENT ON COLUMN public.phase_levels.requirement_es IS 'Spanish requirement text to achieve this phase';
COMMENT ON COLUMN public.phase_levels.rewards_en IS 'Array of English reward descriptions for landing page';
COMMENT ON COLUMN public.phase_levels.rewards_es IS 'Array of Spanish reward descriptions for landing page';
COMMENT ON COLUMN public.phase_levels.visibility_tag_en IS 'English visibility badge text (e.g., "VISIBLE", "NEW")';
COMMENT ON COLUMN public.phase_levels.visibility_tag_es IS 'Spanish visibility badge text (e.g., "VISIBLE", "NUEVO")';
ALTER TABLE public.phase_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "phase_levels_service_role" ON public.phase_levels;
CREATE POLICY "phase_levels_service_role" ON public.phase_levels
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
CREATE UNIQUE INDEX IF NOT EXISTS phase_levels_level_key ON public.phase_levels(level);
CREATE INDEX IF NOT EXISTS phase_levels_display_order_idx ON public.phase_levels(display_order);
INSERT INTO public.phase_levels(
  level, name, name_en, name_es, commission_rate, subscription_discount_rate,
  credit_cents, free_product_value_cents, is_active, display_order,
  descriptor_en, descriptor_es, requirement_en, requirement_es,
  rewards_en, rewards_es, visibility_tag_en, visibility_tag_es
)
VALUES
  (
    0, 'Registration', 'Registration', 'Registro', 0.08, 0.00, 0, 6500, TRUE, 0,
    'Access the business toolkit as soon as you complete your registration.',
    'Accede al kit de herramientas de negocio tan pronto como completes tu registro.',
    'Activate your account with the monthly subscription fee.',
    'Activa tu cuenta con la cuota de suscripción mensual.',
    ARRAY['Business opportunity orientation', 'Personal affiliate link', 'Educational recruitment video library', 'E-commerce access to start selling'],
    ARRAY['Orientación sobre la oportunidad de negocio', 'Enlace de afiliado personal', 'Biblioteca de videos educativos de reclutamiento', 'Acceso al comercio electrónico para comenzar a vender'],
    'VISIBLE', 'VISIBLE'
  ),
  (
    1, 'First Partners', 'First Partners', 'Primeros Socios', 0.15, 0.00, 0, 6500, TRUE, 1,
    'Recruit two members who each pay their monthly subscription.',
    'Recluta dos miembros que paguen su suscripción mensual.',
    'Onboard two paying partners.',
    'Incorpora dos socios que paguen.',
    ARRAY['Choose one free product (valued at ${{freeProductValue}})', 'Receive a ${{walletCredit}} wallet balance credit'],
    ARRAY['Elige un producto gratis (valorado en ${{freeProductValue}})', 'Recibe un crédito de ${{walletCredit}} en tu billetera'],
    'VISIBLE', 'VISIBLE'
  ),
  (
    2, 'Duplicate Team', 'Duplicate Team', 'Equipo Duplicado', 0.30, 0.00, 12500, 0, TRUE, 2,
    'Maintain an active team across your first and second levels for one full billing cycle.',
    'Mantén un equipo activo en tus primeros y segundos niveles durante un ciclo de facturación completo.',
    'Maintain 2 active levels for one billing cycle.',
    'Mantén 2 niveles activos durante un ciclo de facturación.',
    ARRAY['Receive a ${{walletCredit}} wallet balance credit', 'Unlock advanced team management tools'],
    ARRAY['Recibe un crédito de ${{walletCredit}} en tu billetera', 'Desbloquea herramientas avanzadas de gestión de equipo'],
    'VISIBLE', 'VISIBLE'
  ),
  (
    3, 'Network Momentum', 'Network Momentum', 'Impulso de Red', 0.40, 0.00, 24000, 0, TRUE, 3,
    'Maintain network momentum with active subscriptions across your first and second levels for an entire billing cycle.',
    'Mantén el impulso de la red con suscripciones activas en tus primeros y segundos niveles durante un ciclo de facturación completo.',
    'Sustain network activity across 2 levels for one full cycle.',
    'Sostén la actividad de la red en 2 niveles durante un ciclo completo.',
    ARRAY['Choose free products (valued at ${{freeProductValue}})', 'Receive a ${{walletCredit}} wallet balance credit'],
    ARRAY['Elige productos gratis (valorados en ${{freeProductValue}})', 'Recibe un crédito de ${{walletCredit}} en tu billetera'],
    'VISIBLE', 'VISIBLE'
  )
ON CONFLICT (level)
  DO NOTHING;
-- Membership snapshots keep sponsor hierarchy metadata ------------------------
CREATE TABLE IF NOT EXISTS public.memberships(
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  sponsor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  phase_id uuid REFERENCES public.phase_levels(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'canceled')),
  join_date timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.memberships IS 'Tracks sponsor relationships and phase assignments per user.';
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT
      1
    FROM
      pg_constraint
    WHERE
      conname = 'memberships_user_phase_fk'
      AND conrelid = 'public.memberships'::regclass
  ) THEN
    ALTER TABLE public.memberships
      ADD CONSTRAINT memberships_user_phase_fk FOREIGN KEY (user_id) REFERENCES public.phases(user_id) ON DELETE CASCADE;
  END IF;
END;
$$;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "memberships_read_self" ON public.memberships;
CREATE POLICY "memberships_read_self" ON public.memberships
  FOR SELECT
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "memberships_service_role" ON public.memberships;
CREATE POLICY "memberships_service_role" ON public.memberships
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
-- Configurable manual recharge wallets -----------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_wallets(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL UNIQUE CHECK (provider IN ('usdt_trc20', 'usdt_erc20', 'bitcoin', 'ethereum', 'paypal', 'stripe', 'bank_transfer', 'zelle', 'cash_app', 'venmo', 'western_union', 'moneygram')),
  wallet_address text,
  wallet_name text,
  is_active boolean NOT NULL DEFAULT FALSE,
  min_amount_cents bigint NOT NULL DEFAULT 1000,
  max_amount_cents bigint NOT NULL DEFAULT 1000000,
  instructions jsonb NOT NULL DEFAULT '{}' ::jsonb,
  -- Metadata puede incluir campos específicos para cada tipo:
  -- Para bank_transfer: { "bank_name": "...", "account_number": "...", "routing_number": "...", "account_holder": "...", "swift": "...", "iban": "..." }
  -- Para crypto: { "network": "TRC20", "qr_code_url": "..." }
  -- Para otros: { "phone": "...", "email": "...", "username": "..." }
  metadata jsonb NOT NULL DEFAULT '{}' ::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
ALTER TABLE public.payment_wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_wallets_read_active" ON public.payment_wallets;
CREATE POLICY "payment_wallets_read_active" ON public.payment_wallets
  FOR SELECT
    USING (auth.role() = 'authenticated'
      AND is_active = TRUE);
DROP POLICY IF EXISTS "payment_wallets_service_role" ON public.payment_wallets;
CREATE POLICY "payment_wallets_service_role" ON public.payment_wallets
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
-- Manual recharge requests ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_requests(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES public.payment_wallets(id) ON DELETE CASCADE,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'expired')),
  payment_proof_url text,
  transaction_hash text,
  admin_notes text,
  processed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  processed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payment_requests_read_self" ON public.payment_requests;
CREATE POLICY "payment_requests_read_self" ON public.payment_requests
  FOR SELECT
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "payment_requests_insert_self" ON public.payment_requests;
CREATE POLICY "payment_requests_insert_self" ON public.payment_requests
  FOR INSERT
    WITH CHECK (auth.uid() = user_id
    AND status = 'pending');
DROP POLICY IF EXISTS "payment_requests_update_self" ON public.payment_requests;
CREATE POLICY "payment_requests_update_self" ON public.payment_requests
  FOR UPDATE
    USING (auth.uid() = user_id
      AND status IN ('pending', 'processing'))
      WITH CHECK (auth.uid() = user_id
      AND status IN ('pending', 'processing'));
DROP POLICY IF EXISTS "payment_requests_service_role" ON public.payment_requests;
CREATE POLICY "payment_requests_service_role" ON public.payment_requests
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
-- Warehouse tracking for admin logistics --------------------------------------
DROP FUNCTION IF EXISTS public.generate_warehouse_tracking_code();
CREATE FUNCTION public.generate_warehouse_tracking_code()
  RETURNS text
  LANGUAGE sql
  AS $$
  SELECT
    concat('TRK-', to_char(timezone('utc', now()), 'YYMMDD'), '-', upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)));
$$;
COMMENT ON FUNCTION public.generate_warehouse_tracking_code() IS 'Generates a unique tracking code for warehouse updates.';
CREATE TABLE IF NOT EXISTS public.warehouse_tracking_entries(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'packed', 'in_transit', 'delivered', 'delayed', 'canceled')),
  responsible_company text,
  tracking_code text DEFAULT public.generate_warehouse_tracking_code(),
  location text,
  note text,
  estimated_delivery date,
  event_time timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_warehouse_tracking_entries_order_event_time ON public.warehouse_tracking_entries(order_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_warehouse_tracking_entries_status ON public.warehouse_tracking_entries(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_warehouse_tracking_entries_tracking_code ON public.warehouse_tracking_entries(tracking_code)
WHERE
  tracking_code IS NOT NULL;
DROP VIEW IF EXISTS public.warehouse_tracking_admin_view;
CREATE VIEW public.warehouse_tracking_admin_view AS
SELECT
  entry.id,
  entry.order_id,
  order_snapshot.order_code,
  entry.status,
  entry.responsible_company,
  entry.tracking_code,
  entry.location,
  entry.note,
  entry.estimated_delivery,
  entry.event_time,
  entry.created_at,
  entry.created_by,
  order_snapshot.status AS order_status,
  order_snapshot.user_id,
  profiles.name AS customer_name,
  profiles.email AS customer_email,
  profiles.fulfillment_company
FROM
  public.warehouse_tracking_entries entry
  JOIN (
    SELECT
      id,
      status,
      user_id,
      COALESCE(NULLIF(TRIM(metadata ->> 'order_code'), ''), id::text) AS order_code
    FROM
      public.orders) AS order_snapshot ON order_snapshot.id = entry.order_id
  LEFT JOIN public.profiles profiles ON profiles.id = order_snapshot.user_id;
COMMENT ON VIEW public.warehouse_tracking_admin_view IS 'Aggregated warehouse tracking entries including customer context for admin tooling.';
-- ===========================================
-- 7. PAYMENT GATEWAYS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.payment_gateways(
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  provider text UNIQUE NOT NULL CHECK (provider IN ('paypal', 'stripe', 'wallet', 'manual', 'authorize_net', 'payoneer')),
  is_active boolean DEFAULT FALSE,
  -- Functionality: 'payment' (recibir pagos de clientes) o 'payout' (realizar cobros/pagos a usuarios)
  functionality text DEFAULT 'payment' CHECK (functionality IN ('payment', 'payout', 'both')),
  -- Mode: 'production' o 'test' - determina qué variables de entorno usar
  mode text DEFAULT 'production' CHECK (mode IN ('production', 'test')),
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);
-- Enable RLS and create policies
ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;
-- Public can read active gateways
DROP POLICY IF EXISTS "payment_gateways_public_read" ON public.payment_gateways;
CREATE POLICY "payment_gateways_public_read" ON public.payment_gateways
  FOR SELECT
    USING (is_active = TRUE);
-- Service role can manage all
DROP POLICY IF EXISTS "payment_gateways_service_role" ON public.payment_gateways;
CREATE POLICY "payment_gateways_service_role" ON public.payment_gateways
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
-- Sanitized view for exposing payment gateway status to admin clients
CREATE OR REPLACE VIEW public.payment_gateway_settings AS
SELECT
  provider,
  CASE WHEN is_active THEN 'active' ELSE 'inactive' END AS status,
  functionality,
  mode,
  updated_at
FROM
  public.payment_gateways;
GRANT SELECT ON public.payment_gateway_settings TO authenticated;
GRANT SELECT ON public.payment_gateway_settings TO service_role;
-- ===========================================
-- 8. AUDIT LOGS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.audit_logs(
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  user_id uuid REFERENCES auth.users(id),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT NOW()
);
-- Enable RLS and create policies
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
-- Only admins can read logs
DROP POLICY IF EXISTS "audit_logs_read_admin" ON public.audit_logs;
CREATE POLICY "audit_logs_read_admin" ON public.audit_logs
  FOR SELECT
    USING (public.is_super_admin(auth.uid()));
-- Authenticated users can insert logs
DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_authenticated" ON public.audit_logs
  FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');
-- ===========================================
-- 9. SITE BRANDING SETTINGS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.site_branding_settings(
  id text PRIMARY KEY,
  app_name text NOT NULL,
  logo_url text,
  favicon_url text,
  description text,
  show_logo boolean DEFAULT TRUE,
  logo_position text DEFAULT 'beside',
  show_app_name boolean DEFAULT TRUE,
  updated_at timestamptz DEFAULT NOW()
);
ALTER TABLE public.site_branding_settings
  ADD COLUMN IF NOT EXISTS favicon_url TEXT,
  ADD COLUMN IF NOT EXISTS show_logo BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS logo_position TEXT DEFAULT 'beside',
  ADD COLUMN IF NOT EXISTS show_app_name BOOLEAN DEFAULT TRUE;
ALTER TABLE public.site_branding_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "site_branding_settings_public_read" ON public.site_branding_settings;
CREATE POLICY "site_branding_settings_public_read" ON public.site_branding_settings
  FOR SELECT
    USING (TRUE);
DROP POLICY IF EXISTS "site_branding_settings_service_role" ON public.site_branding_settings;
CREATE POLICY "site_branding_settings_service_role" ON public.site_branding_settings
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
-- ===========================================
-- 10. LANDING PAGE CONTENT TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.landing_page_content(
  locale text PRIMARY KEY,
  hero jsonb,
  about jsonb,
  how_it_works jsonb,
  opportunity jsonb,
  testimonials jsonb,
  featured_products jsonb,
  contact jsonb,
  team jsonb DEFAULT '{"title": "Meet Our Team", "subtitle": "The people behind our success", "featuredMemberIds": []}'::jsonb,
  header jsonb,
  footer jsonb,
  faqs jsonb,
  updated_at timestamptz DEFAULT NOW()
);
ALTER TABLE public.landing_page_content
  ADD COLUMN IF NOT EXISTS opportunity JSONB,
  ADD COLUMN IF NOT EXISTS testimonials JSONB,
  ADD COLUMN IF NOT EXISTS featured_products JSONB,
  ADD COLUMN IF NOT EXISTS contact JSONB,
  ADD COLUMN IF NOT EXISTS team JSONB,
  ADD COLUMN IF NOT EXISTS header JSONB,
  ADD COLUMN IF NOT EXISTS footer JSONB;

-- Add comments to document the landing page content fields
COMMENT ON COLUMN public.landing_page_content.hero IS 'Hero section content with title, subtitle, backgroundImageUrl, backgroundColor, and style (default|modern|minimal)';
COMMENT ON COLUMN public.landing_page_content.header IS 'Header navigation config with landingLinks, authenticatedLinks (each with visibility rules), primaryAction, secondaryAction, showCart';
COMMENT ON COLUMN public.landing_page_content.footer IS 'Footer config with tagline, navigationLinks, legalLinks, socialLinks, branding options';

-- Link visibility rules structure:
-- visibility: {
--   showToGuests: boolean,           -- Show to non-authenticated users
--   showToAuthenticated: boolean,    -- Show to authenticated users
--   showToActiveSubscription: boolean,   -- Show to users with active subscription
--   showToInactiveSubscription: boolean, -- Show to users without active subscription
--   showToMlm: boolean,              -- Show to MLM subscription users
--   showToAffiliate: boolean,        -- Show to Affiliate subscription users
--   showToAdmin: boolean             -- Show to admin users
-- }

ALTER TABLE public.landing_page_content ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "landing_page_content_public_read" ON public.landing_page_content;
CREATE POLICY "landing_page_content_public_read" ON public.landing_page_content
  FOR SELECT
    USING (TRUE);
DROP POLICY IF EXISTS "landing_page_content_service_role" ON public.landing_page_content;
CREATE POLICY "landing_page_content_service_role" ON public.landing_page_content
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
-- Provide baseline content rows so the admin UI has editable records
INSERT INTO public.site_branding_settings(id, app_name, logo_url, favicon_url, description, show_logo, logo_position, show_app_name)
  VALUES ('global', 'PūrVita', NULL, NULL, NULL, TRUE, 'beside', TRUE)
ON CONFLICT (id)
  DO NOTHING;

-- Default visibility rules for links (all visible by default)
-- visibility: { showToGuests, showToAuthenticated, showToActiveSubscription, showToInactiveSubscription, showToMlm, showToAffiliate, showToAdmin }

-- English landing page content with proper header/footer navigation
INSERT INTO public.landing_page_content(locale, hero, about, how_it_works, opportunity, testimonials, featured_products, contact, team, header, footer, faqs, updated_at)
VALUES (
  'en',
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  '{"title": "Meet Our Team", "subtitle": "The people behind our success", "featuredMemberIds": []}'::jsonb,
  -- Header with navigation links and visibility rules
  '{
    "landingLinks": [
      {"id": "about", "label": "About Us", "href": "#about", "requiresAuth": false, "order": 0, "openInNewTab": false, "visibility": {"showToGuests": true, "showToAuthenticated": true, "showToActiveSubscription": true, "showToInactiveSubscription": true, "showToMlm": true, "showToAffiliate": true, "showToAdmin": true}},
      {"id": "how-it-works", "label": "How It Works", "href": "#how-it-works", "requiresAuth": false, "order": 1, "openInNewTab": false, "visibility": {"showToGuests": true, "showToAuthenticated": true, "showToActiveSubscription": true, "showToInactiveSubscription": true, "showToMlm": true, "showToAffiliate": true, "showToAdmin": true}},
      {"id": "income-calculator", "label": "Income Calculator", "href": "income-calculator", "requiresAuth": false, "order": 2, "openInNewTab": false, "visibility": {"showToGuests": true, "showToAuthenticated": true, "showToActiveSubscription": true, "showToInactiveSubscription": true, "showToMlm": true, "showToAffiliate": true, "showToAdmin": true}},
      {"id": "testimonials", "label": "Testimonials", "href": "#testimonials", "requiresAuth": false, "order": 3, "openInNewTab": false, "visibility": {"showToGuests": true, "showToAuthenticated": true, "showToActiveSubscription": true, "showToInactiveSubscription": true, "showToMlm": true, "showToAffiliate": true, "showToAdmin": true}},
      {"id": "contact", "label": "Contact", "href": "#contact", "requiresAuth": false, "order": 4, "openInNewTab": false, "visibility": {"showToGuests": true, "showToAuthenticated": true, "showToActiveSubscription": true, "showToInactiveSubscription": true, "showToMlm": true, "showToAffiliate": true, "showToAdmin": true}}
    ],
    "authenticatedLinks": [
      {"id": "dashboard", "label": "Dashboard", "href": "/dashboard", "requiresAuth": true, "order": 0, "openInNewTab": false, "visibility": {"showToGuests": true, "showToAuthenticated": true, "showToActiveSubscription": true, "showToInactiveSubscription": true, "showToMlm": true, "showToAffiliate": true, "showToAdmin": true}},
      {"id": "products", "label": "Products", "href": "/products", "requiresAuth": true, "order": 1, "openInNewTab": false, "visibility": {"showToGuests": true, "showToAuthenticated": true, "showToActiveSubscription": true, "showToInactiveSubscription": true, "showToMlm": true, "showToAffiliate": true, "showToAdmin": true}},
      {"id": "team", "label": "Team", "href": "/team", "requiresAuth": true, "order": 2, "openInNewTab": false, "visibility": {"showToGuests": false, "showToAuthenticated": true, "showToActiveSubscription": true, "showToInactiveSubscription": true, "showToMlm": true, "showToAffiliate": false, "showToAdmin": true}},
      {"id": "classes", "label": "Classes", "href": "/classes", "requiresAuth": true, "order": 3, "openInNewTab": false, "visibility": {"showToGuests": true, "showToAuthenticated": true, "showToActiveSubscription": true, "showToInactiveSubscription": true, "showToMlm": true, "showToAffiliate": true, "showToAdmin": true}},
      {"id": "subscription", "label": "Subscription", "href": "/subscription", "requiresAuth": true, "order": 4, "openInNewTab": false, "visibility": {"showToGuests": true, "showToAuthenticated": true, "showToActiveSubscription": true, "showToInactiveSubscription": true, "showToMlm": true, "showToAffiliate": true, "showToAdmin": true}}
    ],
    "primaryAction": {"label": "Sign Up", "href": "/auth/register"},
    "secondaryAction": {"label": "Log In", "href": "/auth/login"},
    "showCart": true
  }'::jsonb,
  -- Footer with navigation and legal links
  '{
    "tagline": "Empowering health, enriching lives together.",
    "navigationLinks": [
      {"id": "products", "label": "Products", "href": "/products", "order": 0, "openInNewTab": false},
      {"id": "contact", "label": "Contact", "href": "/contact", "order": 1, "openInNewTab": false}
    ],
    "legalLinks": [
      {"id": "privacy", "label": "Privacy Policy", "href": "/privacy", "order": 0, "openInNewTab": false},
      {"id": "terms", "label": "Terms of Service", "href": "/terms", "order": 1, "openInNewTab": false}
    ],
    "socialLinks": [
      {"id": "facebook", "platform": "facebook", "label": "Facebook", "href": "#", "order": 0},
      {"id": "twitter", "platform": "twitter", "label": "Twitter", "href": "#", "order": 1},
      {"id": "instagram", "platform": "instagram", "label": "Instagram", "href": "#", "order": 2},
      {"id": "linkedin", "platform": "linkedin", "label": "LinkedIn", "href": "#", "order": 3}
    ],
    "showBrandingLogo": false,
    "showBrandingAppName": true,
    "showBrandingDescription": true,
    "brandingOrientation": "beside",
    "showLanguageSwitcher": true,
    "showThemeSwitcher": true
  }'::jsonb,
  '[]'::jsonb,
  timezone('utc', now())
),
-- Spanish landing page content
(
  'es',
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  '{"title": "Conoce Nuestro Equipo", "subtitle": "Las personas detrás de nuestro éxito", "featuredMemberIds": []}'::jsonb,
  -- Header with navigation links and visibility rules (Spanish)
  '{
    "landingLinks": [
      {"id": "about", "label": "Nosotros", "href": "#about", "requiresAuth": false, "order": 0, "openInNewTab": false, "visibility": {"showToGuests": true, "showToAuthenticated": true, "showToActiveSubscription": true, "showToInactiveSubscription": true, "showToMlm": true, "showToAffiliate": true, "showToAdmin": true}},
      {"id": "how-it-works", "label": "Cómo Funciona", "href": "#how-it-works", "requiresAuth": false, "order": 1, "openInNewTab": false, "visibility": {"showToGuests": true, "showToAuthenticated": true, "showToActiveSubscription": true, "showToInactiveSubscription": true, "showToMlm": true, "showToAffiliate": true, "showToAdmin": true}},
      {"id": "income-calculator", "label": "Calculadora de Ingresos", "href": "income-calculator", "requiresAuth": false, "order": 2, "openInNewTab": false, "visibility": {"showToGuests": true, "showToAuthenticated": true, "showToActiveSubscription": true, "showToInactiveSubscription": true, "showToMlm": true, "showToAffiliate": true, "showToAdmin": true}},
      {"id": "testimonials", "label": "Testimonios", "href": "#testimonials", "requiresAuth": false, "order": 3, "openInNewTab": false, "visibility": {"showToGuests": true, "showToAuthenticated": true, "showToActiveSubscription": true, "showToInactiveSubscription": true, "showToMlm": true, "showToAffiliate": true, "showToAdmin": true}},
      {"id": "contact", "label": "Contacto", "href": "#contact", "requiresAuth": false, "order": 4, "openInNewTab": false, "visibility": {"showToGuests": true, "showToAuthenticated": true, "showToActiveSubscription": true, "showToInactiveSubscription": true, "showToMlm": true, "showToAffiliate": true, "showToAdmin": true}}
    ],
    "authenticatedLinks": [
      {"id": "dashboard", "label": "Panel", "href": "/dashboard", "requiresAuth": true, "order": 0, "openInNewTab": false, "visibility": {"showToGuests": true, "showToAuthenticated": true, "showToActiveSubscription": true, "showToInactiveSubscription": true, "showToMlm": true, "showToAffiliate": true, "showToAdmin": true}},
      {"id": "products", "label": "Productos", "href": "/products", "requiresAuth": true, "order": 1, "openInNewTab": false, "visibility": {"showToGuests": true, "showToAuthenticated": true, "showToActiveSubscription": true, "showToInactiveSubscription": true, "showToMlm": true, "showToAffiliate": true, "showToAdmin": true}},
      {"id": "team", "label": "Equipo", "href": "/team", "requiresAuth": true, "order": 2, "openInNewTab": false, "visibility": {"showToGuests": false, "showToAuthenticated": true, "showToActiveSubscription": true, "showToInactiveSubscription": true, "showToMlm": true, "showToAffiliate": false, "showToAdmin": true}},
      {"id": "classes", "label": "Clases", "href": "/classes", "requiresAuth": true, "order": 3, "openInNewTab": false, "visibility": {"showToGuests": true, "showToAuthenticated": true, "showToActiveSubscription": true, "showToInactiveSubscription": true, "showToMlm": true, "showToAffiliate": true, "showToAdmin": true}},
      {"id": "subscription", "label": "Suscripción", "href": "/subscription", "requiresAuth": true, "order": 4, "openInNewTab": false, "visibility": {"showToGuests": true, "showToAuthenticated": true, "showToActiveSubscription": true, "showToInactiveSubscription": true, "showToMlm": true, "showToAffiliate": true, "showToAdmin": true}}
    ],
    "primaryAction": {"label": "Registrarse", "href": "/auth/register"},
    "secondaryAction": {"label": "Iniciar Sesión", "href": "/auth/login"},
    "showCart": true
  }'::jsonb,
  -- Footer with navigation and legal links (Spanish)
  '{
    "tagline": "Empoderando la salud, enriqueciendo vidas juntos.",
    "navigationLinks": [
      {"id": "products", "label": "Productos", "href": "/products", "order": 0, "openInNewTab": false},
      {"id": "contact", "label": "Contacto", "href": "/contact", "order": 1, "openInNewTab": false}
    ],
    "legalLinks": [
      {"id": "privacy", "label": "Política de Privacidad", "href": "/privacy", "order": 0, "openInNewTab": false},
      {"id": "terms", "label": "Términos de Servicio", "href": "/terms", "order": 1, "openInNewTab": false}
    ],
    "socialLinks": [
      {"id": "facebook", "platform": "facebook", "label": "Facebook", "href": "#", "order": 0},
      {"id": "twitter", "platform": "twitter", "label": "Twitter", "href": "#", "order": 1},
      {"id": "instagram", "platform": "instagram", "label": "Instagram", "href": "#", "order": 2},
      {"id": "linkedin", "platform": "linkedin", "label": "LinkedIn", "href": "#", "order": 3}
    ],
    "showBrandingLogo": false,
    "showBrandingAppName": true,
    "showBrandingDescription": true,
    "brandingOrientation": "beside",
    "showLanguageSwitcher": true,
    "showThemeSwitcher": true
  }'::jsonb,
  '[]'::jsonb,
  timezone('utc', now())
)
ON CONFLICT (locale)
  DO NOTHING;
-- ===========================================
-- 10B. TEAM PAGE CONTENT TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.team_page_content(
  locale text PRIMARY KEY,
  title text NOT NULL DEFAULT 'Our Team',
  subtitle text NOT NULL DEFAULT 'Meet the people behind our success',
  members jsonb NOT NULL DEFAULT '[]'::jsonb,
  featured_member_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT NOW()
);

COMMENT ON TABLE public.team_page_content IS 'Stores team page content including all team members and featured member selections for landing page.';
COMMENT ON COLUMN public.team_page_content.locale IS 'Language locale (en, es, etc.)';
COMMENT ON COLUMN public.team_page_content.title IS 'Main title for the team page';
COMMENT ON COLUMN public.team_page_content.subtitle IS 'Subtitle/description for the team page';
COMMENT ON COLUMN public.team_page_content.members IS 'Array of team member objects with id, name, role, description, imageUrl, order';
COMMENT ON COLUMN public.team_page_content.featured_member_ids IS 'Array of member IDs (max 4) to display on landing page';

ALTER TABLE public.team_page_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_page_content_public_read" ON public.team_page_content;
CREATE POLICY "team_page_content_public_read" ON public.team_page_content
  FOR SELECT
    USING (TRUE);

DROP POLICY IF EXISTS "team_page_content_service_role" ON public.team_page_content;
CREATE POLICY "team_page_content_service_role" ON public.team_page_content
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Allow admins to insert team page content
DROP POLICY IF EXISTS "team_page_content_admin_insert" ON public.team_page_content;
CREATE POLICY "team_page_content_admin_insert" ON public.team_page_content
  FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' AND public.has_admin_access(auth.uid()));

-- Allow admins to update team page content
DROP POLICY IF EXISTS "team_page_content_admin_update" ON public.team_page_content;
CREATE POLICY "team_page_content_admin_update" ON public.team_page_content
  FOR UPDATE
    USING (auth.role() = 'authenticated' AND public.has_admin_access(auth.uid()))
    WITH CHECK (auth.role() = 'authenticated' AND public.has_admin_access(auth.uid()));

-- Allow admins to delete team page content
DROP POLICY IF EXISTS "team_page_content_admin_delete" ON public.team_page_content;
CREATE POLICY "team_page_content_admin_delete" ON public.team_page_content
  FOR DELETE
    USING (auth.role() = 'authenticated' AND public.has_admin_access(auth.uid()));

-- Insert baseline rows for each locale
INSERT INTO public.team_page_content(locale, title, subtitle, members, featured_member_ids, updated_at)
  VALUES
    ('en', 'Our Team', 'Meet the people behind our success', '[]'::jsonb, '[]'::jsonb, timezone('utc', now())),
    ('es', 'Nuestro Equipo', 'Conoce a las personas detrás de nuestro éxito', '[]'::jsonb, '[]'::jsonb, timezone('utc', now()))
ON CONFLICT (locale)
  DO NOTHING;

-- ===========================================
-- 11. MARKETING CATEGORIES TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.marketing_categories(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name_en text NOT NULL,
  name_es text NOT NULL,
  is_active boolean NOT NULL DEFAULT TRUE,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.marketing_categories IS 'Categories for marketing assets with multi-language support.';
COMMENT ON COLUMN public.marketing_categories.slug IS 'Unique identifier for the category (e.g., "social-media", "general").';
COMMENT ON COLUMN public.marketing_categories.name_en IS 'Category name in English.';
COMMENT ON COLUMN public.marketing_categories.name_es IS 'Category name in Spanish.';
ALTER TABLE public.marketing_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "marketing_categories_read" ON public.marketing_categories;
CREATE POLICY "marketing_categories_read" ON public.marketing_categories
  FOR SELECT
    USING (is_active = TRUE);
DROP POLICY IF EXISTS "marketing_categories_admin_manage" ON public.marketing_categories;
CREATE POLICY "marketing_categories_admin_manage" ON public.marketing_categories
  FOR ALL
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_marketing_categories_active ON public.marketing_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_marketing_categories_slug ON public.marketing_categories(slug);
DROP TRIGGER IF EXISTS on_marketing_categories_updated ON public.marketing_categories;
CREATE TRIGGER on_marketing_categories_updated
  BEFORE UPDATE ON public.marketing_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
-- Insert default categories
INSERT INTO public.marketing_categories(slug, name_en, name_es, display_order)
  VALUES ('general', 'General', 'General', 0),
('social-media', 'Social Media', 'Redes Sociales', 1),
('email', 'Email', 'Correo Electrónico', 2),
('banners', 'Banners', 'Banners', 3),
('videos', 'Videos', 'Videos', 4)
ON CONFLICT (slug)
  DO NOTHING;
-- ===========================================
-- 12. MARKETING ASSETS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.marketing_assets(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  title_en text,
  title_es text,
  description text,
  description_en text,
  description_es text,
  file_url text,
  file_type text CHECK (file_type IS NULL OR file_type IN ('gif', 'png', 'jpg', 'jpeg', 'video')),
  media_type text NOT NULL DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  video_url text,
  category_id uuid REFERENCES public.marketing_categories(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'general',
  storage_path text,
  is_active boolean NOT NULL DEFAULT TRUE,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT marketing_assets_media_urls_check CHECK ((media_type = 'image' AND file_url IS NOT NULL AND video_url IS NULL) OR (media_type = 'video' AND video_url IS NOT NULL))
);
COMMENT ON TABLE public.marketing_assets IS 'Marketing assets (images and videos) available to active subscribers.';
COMMENT ON COLUMN public.marketing_assets.file_url IS 'URL to the stored asset when media_type = image.';
COMMENT ON COLUMN public.marketing_assets.video_url IS 'External video URL when media_type = video (e.g. YouTube embed).';
COMMENT ON COLUMN public.marketing_assets.category IS 'Legacy category label (deprecated, use category_id instead).';
COMMENT ON COLUMN public.marketing_assets.category_id IS 'Reference to marketing_categories table for multi-language support.';
ALTER TABLE public.marketing_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "marketing_assets_subscribers_read" ON public.marketing_assets;
CREATE POLICY "marketing_assets_subscribers_read" ON public.marketing_assets
  FOR SELECT
    USING (is_active = TRUE
      AND EXISTS (
        SELECT
          1
        FROM
          public.subscriptions s
        WHERE
          s.user_id = auth.uid() AND s.status = 'active'));
DROP POLICY IF EXISTS "marketing_assets_admin_manage" ON public.marketing_assets;
CREATE POLICY "marketing_assets_admin_manage" ON public.marketing_assets
  FOR ALL
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_marketing_assets_active ON public.marketing_assets(is_active);
CREATE INDEX IF NOT EXISTS idx_marketing_assets_order ON public.marketing_assets(display_order);
CREATE INDEX IF NOT EXISTS idx_marketing_assets_category ON public.marketing_assets(category);
CREATE INDEX IF NOT EXISTS idx_marketing_assets_category_id ON public.marketing_assets(category_id);
CREATE INDEX IF NOT EXISTS idx_marketing_assets_media_type ON public.marketing_assets(media_type);
DROP TRIGGER IF EXISTS on_marketing_assets_updated ON public.marketing_assets;
CREATE TRIGGER on_marketing_assets_updated
  BEFORE UPDATE ON public.marketing_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
-- ===========================================
-- FUNCTION: Get marketing categories with localized names
-- ===========================================
CREATE OR REPLACE FUNCTION public.get_marketing_categories(locale_param text DEFAULT 'es')
  RETURNS TABLE(
    id uuid,
    slug text,
    name text,
    display_order integer
  )
  LANGUAGE plpgsql
  STABLE
  AS $$
BEGIN
  RETURN QUERY
  SELECT
    mc.id,
    mc.slug,
    CASE WHEN locale_param = 'en' THEN
      mc.name_en
    ELSE
      mc.name_es
    END AS name,
    mc.display_order
  FROM
    public.marketing_categories mc
  WHERE
    mc.is_active = TRUE
  ORDER BY
    mc.display_order ASC,
    mc.slug ASC;
END;
$$;
-- ===========================================
-- STORAGE BUCKETS AND POLICIES
-- ===========================================
-- Create storage buckets (all public for easy access)
INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('avatars', 'avatars', TRUE, NULL, NULL),
('products', 'products', TRUE, NULL, NULL),
('page', 'page', TRUE, NULL, NULL),
('marketing-assets', 'marketing-assets', TRUE, NULL, NULL),
('public-assets', 'public-assets', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id)
  DO NOTHING;
-- ===========================================
-- AVATARS BUCKET POLICIES
-- ===========================================
-- Allow public read access to avatars
DROP POLICY IF EXISTS "storage_avatars_select" ON storage.objects;
CREATE POLICY "storage_avatars_select" ON storage.objects
  FOR SELECT
    USING (bucket_id = 'avatars');
-- Allow authenticated users to upload avatars to their own folder
DROP POLICY IF EXISTS "storage_avatars_insert" ON storage.objects;
CREATE POLICY "storage_avatars_insert" ON storage.objects
  FOR INSERT
    WITH CHECK (bucket_id = 'avatars'
    AND auth.role() = 'authenticated' AND name LIKE (auth.uid()::text || '/%'));
-- Allow authenticated users to update their own avatars
DROP POLICY IF EXISTS "storage_avatars_update" ON storage.objects;
CREATE POLICY "storage_avatars_update" ON storage.objects
  FOR UPDATE
    USING (bucket_id = 'avatars'
      AND auth.role() = 'authenticated' AND name LIKE (auth.uid()::text || '/%'));
-- Allow authenticated users to delete their own avatars
DROP POLICY IF EXISTS "storage_avatars_delete" ON storage.objects;
CREATE POLICY "storage_avatars_delete" ON storage.objects
  FOR DELETE
    USING (bucket_id = 'avatars'
      AND auth.role() = 'authenticated' AND name LIKE (auth.uid()::text || '/%'));
-- ===========================================
-- PRODUCTS BUCKET POLICIES
-- ===========================================
-- Allow public read access to product images
DROP POLICY IF EXISTS "storage_products_select" ON storage.objects;
CREATE POLICY "storage_products_select" ON storage.objects
  FOR SELECT
    USING (bucket_id = 'products');
-- Allow admins to upload product images
DROP POLICY IF EXISTS "storage_products_insert" ON storage.objects;
CREATE POLICY "storage_products_insert" ON storage.objects
  FOR INSERT
    WITH CHECK (bucket_id = 'products' AND auth.role() = 'authenticated' AND public.is_super_admin(auth.uid()));
-- Allow admins to update product images
DROP POLICY IF EXISTS "storage_products_update" ON storage.objects;
CREATE POLICY "storage_products_update" ON storage.objects
  FOR UPDATE
    USING (bucket_id = 'products' AND auth.role() = 'authenticated' AND public.is_super_admin(auth.uid()));
-- Allow admins to delete product images
DROP POLICY IF EXISTS "storage_products_delete" ON storage.objects;
CREATE POLICY "storage_products_delete" ON storage.objects
  FOR DELETE
    USING (bucket_id = 'products' AND auth.role() = 'authenticated' AND public.is_super_admin(auth.uid()));
-- ===========================================
-- PAGE BUCKET POLICIES (Site Branding Assets)
-- ===========================================
-- Allow public read access to page assets
DROP POLICY IF EXISTS "storage_page_public_read" ON storage.objects;
CREATE POLICY "storage_page_public_read" ON storage.objects
  FOR SELECT
    USING (bucket_id = 'page');
-- Allow admins to upload page assets
DROP POLICY IF EXISTS "storage_page_admin_insert" ON storage.objects;
CREATE POLICY "storage_page_admin_insert" ON storage.objects
  FOR INSERT
    WITH CHECK (bucket_id = 'page' AND auth.role() = 'authenticated' AND public.has_admin_access(auth.uid()));
-- Allow admins to update page assets
DROP POLICY IF EXISTS "storage_page_admin_update" ON storage.objects;
CREATE POLICY "storage_page_admin_update" ON storage.objects
  FOR UPDATE
    USING (bucket_id = 'page' AND auth.role() = 'authenticated' AND public.has_admin_access(auth.uid()));
-- Allow admins to delete page assets
DROP POLICY IF EXISTS "storage_page_admin_delete" ON storage.objects;
CREATE POLICY "storage_page_admin_delete" ON storage.objects
  FOR DELETE
    USING (bucket_id = 'page' AND auth.role() = 'authenticated' AND public.has_admin_access(auth.uid()));
-- ===========================================
-- MARKETING ASSETS BUCKET POLICIES
-- ===========================================
DROP POLICY IF EXISTS "storage_marketing_assets_select" ON storage.objects;
CREATE POLICY "storage_marketing_assets_select" ON storage.objects
  FOR SELECT
    USING (bucket_id = 'marketing-assets');
DROP POLICY IF EXISTS "storage_marketing_assets_insert" ON storage.objects;
CREATE POLICY "storage_marketing_assets_insert" ON storage.objects
  FOR INSERT
    WITH CHECK (bucket_id = 'marketing-assets' AND auth.role() = 'authenticated' AND public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "storage_marketing_assets_update" ON storage.objects;
CREATE POLICY "storage_marketing_assets_update" ON storage.objects
  FOR UPDATE
    USING (bucket_id = 'marketing-assets' AND auth.role() = 'authenticated' AND public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "storage_marketing_assets_delete" ON storage.objects;
CREATE POLICY "storage_marketing_assets_delete" ON storage.objects
  FOR DELETE
    USING (bucket_id = 'marketing-assets' AND auth.role() = 'authenticated' AND public.is_super_admin(auth.uid()));
-- ===========================================
-- PUBLIC ASSETS BUCKET POLICIES
-- ===========================================
-- Allow public read access to public assets
DROP POLICY IF EXISTS "storage_public_assets_select" ON storage.objects;
CREATE POLICY "storage_public_assets_select" ON storage.objects
  FOR SELECT
    USING (bucket_id = 'public-assets');
-- Allow authenticated users to upload to public-assets (for affiliate store banners)
DROP POLICY IF EXISTS "storage_public_assets_insert" ON storage.objects;
CREATE POLICY "storage_public_assets_insert" ON storage.objects
  FOR INSERT
    WITH CHECK (bucket_id = 'public-assets'
    AND auth.role() = 'authenticated');
-- Allow authenticated users to update their own uploads
DROP POLICY IF EXISTS "storage_public_assets_update" ON storage.objects;
CREATE POLICY "storage_public_assets_update" ON storage.objects
  FOR UPDATE
    USING (bucket_id = 'public-assets'
      AND auth.role() = 'authenticated');
-- Allow authenticated users to delete their own uploads
DROP POLICY IF EXISTS "storage_public_assets_delete" ON storage.objects;
CREATE POLICY "storage_public_assets_delete" ON storage.objects
  FOR DELETE
    USING (bucket_id = 'public-assets'
      AND auth.role() = 'authenticated');
-- ===========================================
-- 12. ADMIN BROADCAST TABLES
-- ===========================================
CREATE TABLE IF NOT EXISTS public.admin_broadcasts(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audience_type text NOT NULL CHECK (audience_type IN ('all_users', 'active_subscribers', 'lapsed_subscribers', 'product_purchasers', 'specific_user')),
  audience_filter jsonb NOT NULL DEFAULT '{}' ::jsonb,
  subject text NOT NULL,
  body text NOT NULL,
  sender_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_email text,
  intended_count integer NOT NULL DEFAULT 0,
  delivered_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  failure_recipients jsonb NOT NULL DEFAULT '[]' ::jsonb,
  delivered_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.admin_broadcasts IS 'Stores metadata for admin-initiated email broadcasts to community segments.';
ALTER TABLE public.admin_broadcasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_broadcasts_service_role" ON public.admin_broadcasts;
CREATE POLICY "admin_broadcasts_service_role" ON public.admin_broadcasts
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
CREATE TABLE IF NOT EXISTS public.admin_broadcast_recipients(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id uuid NOT NULL REFERENCES public.admin_broadcasts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  email text NOT NULL,
  name text,
  status text NOT NULL DEFAULT 'delivered' CHECK (status IN ('delivered', 'failed')),
  error_message text,
  delivered_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.admin_broadcast_recipients IS 'Recipient delivery log for admin broadcasts including status and error context.';
ALTER TABLE public.admin_broadcast_recipients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_broadcast_recipients_service_role" ON public.admin_broadcast_recipients;
CREATE POLICY "admin_broadcast_recipients_service_role" ON public.admin_broadcast_recipients
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
CREATE INDEX IF NOT EXISTS idx_admin_broadcasts_delivered_at ON public.admin_broadcasts(delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_broadcast_recipients_broadcast ON public.admin_broadcast_recipients(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_admin_broadcast_recipients_user ON public.admin_broadcast_recipients(user_id)
WHERE
  user_id IS NOT NULL;
-- ===========================================
-- 13. TEAM MESSAGES TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.team_messages(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  parent_message_id uuid NULL REFERENCES public.team_messages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  read_at timestamptz NULL
);
COMMENT ON TABLE public.team_messages IS 'Direct messages exchanged between multilevel team members.';
COMMENT ON COLUMN public.team_messages.sender_id IS 'Profile ID of the sender.';
COMMENT ON COLUMN public.team_messages.recipient_id IS 'Profile ID of the teammate receiving the message.';
COMMENT ON COLUMN public.team_messages.body IS 'Plain text body limited to 2000 characters.';
COMMENT ON COLUMN public.team_messages.parent_message_id IS 'Root message identifier used to group conversation threads.';
COMMENT ON COLUMN public.team_messages.read_at IS 'Timestamp set when the recipient reads the message.';
ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team_messages_select_participant" ON public.team_messages;
CREATE POLICY "team_messages_select_participant" ON public.team_messages
  FOR SELECT
    USING (auth.uid() = sender_id
      OR auth.uid() = recipient_id);
DROP POLICY IF EXISTS "team_messages_insert_self" ON public.team_messages;
CREATE POLICY "team_messages_insert_self" ON public.team_messages
  FOR INSERT
    WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS "team_messages_update_recipient" ON public.team_messages;
CREATE POLICY "team_messages_update_recipient" ON public.team_messages
  FOR UPDATE
    USING (auth.uid() = recipient_id)
    WITH CHECK (auth.uid() = recipient_id);
DROP POLICY IF EXISTS "team_messages_delete_denied" ON public.team_messages;
CREATE POLICY "team_messages_delete_denied" ON public.team_messages
  FOR DELETE
    USING (FALSE);
CREATE INDEX IF NOT EXISTS idx_team_messages_recipient_created ON public.team_messages(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_messages_sender_created ON public.team_messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_messages_parent ON public.team_messages(parent_message_id);
-- ===========================================
-- 14. TUTORIALS SYSTEM
-- ===========================================
CREATE TABLE IF NOT EXISTS public.tutorials(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  title_es text,
  title_en text,
  description text,
  description_es text,
  description_en text,
  content jsonb NOT NULL DEFAULT '[]' ::jsonb,
  is_active boolean NOT NULL DEFAULT TRUE,
  show_on_all_pages boolean NOT NULL DEFAULT FALSE,
  target_pages text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.tutorials IS 'Onboarding tutorials shown to new users after registration with multilingual support and page targeting';
COMMENT ON COLUMN public.tutorials.title IS 'Tutorial title (legacy, for backward compatibility)';
COMMENT ON COLUMN public.tutorials.title_es IS 'Tutorial title in Spanish';
COMMENT ON COLUMN public.tutorials.title_en IS 'Tutorial title in English';
COMMENT ON COLUMN public.tutorials.description IS 'Tutorial description (legacy, for backward compatibility)';
COMMENT ON COLUMN public.tutorials.description_es IS 'Tutorial description in Spanish';
COMMENT ON COLUMN public.tutorials.description_en IS 'Tutorial description in English';
COMMENT ON COLUMN public.tutorials.content IS 'JSON array of tutorial steps with multilingual support: title_es, title_en, description_es, description_en, image_url, action_type';
COMMENT ON COLUMN public.tutorials.show_on_all_pages IS 'If true, tutorial appears on all pages. If false, only on pages listed in target_pages';
COMMENT ON COLUMN public.tutorials.target_pages IS 'Array of page paths where this tutorial should appear (e.g., [''/dashboard'', ''/products'']). Empty if show_on_all_pages is true. Supports wildcards (e.g., ''/dashboard/*'')';
CREATE TABLE IF NOT EXISTS public.user_tutorial_progress(
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tutorial_id uuid NOT NULL REFERENCES public.tutorials(id) ON DELETE CASCADE,
  current_step integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT FALSE,
  skipped boolean NOT NULL DEFAULT FALSE,
  completed_at timestamptz,
  skipped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (user_id, tutorial_id),
  CONSTRAINT user_tutorial_progress_completion_check CHECK (NOT (completed = TRUE AND skipped = TRUE)),
  CONSTRAINT user_tutorial_progress_timestamps_check CHECK ((completed = TRUE AND completed_at IS NOT NULL) OR completed = FALSE),
  CONSTRAINT user_tutorial_progress_skip_timestamps_check CHECK ((skipped = TRUE AND skipped_at IS NOT NULL) OR skipped = FALSE)
);
COMMENT ON TABLE public.user_tutorial_progress IS 'Tracks user progress through onboarding tutorials';
COMMENT ON COLUMN public.user_tutorial_progress.current_step IS 'Current step index (0-based) the user is on';
COMMENT ON COLUMN public.user_tutorial_progress.completed IS 'Whether the user has completed the entire tutorial';
COMMENT ON COLUMN public.user_tutorial_progress.skipped IS 'Whether the user has skipped the tutorial';
ALTER TABLE public.tutorials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tutorial_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tutorials_public_read" ON public.tutorials;
CREATE POLICY "tutorials_public_read" ON public.tutorials
  FOR SELECT
    USING (is_active = TRUE);
DROP POLICY IF EXISTS "tutorials_admin_manage" ON public.tutorials;
CREATE POLICY "tutorials_admin_manage" ON public.tutorials
  FOR ALL
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "user_tutorial_progress_read_self" ON public.user_tutorial_progress;
CREATE POLICY "user_tutorial_progress_read_self" ON public.user_tutorial_progress
  FOR SELECT
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_tutorial_progress_update_self" ON public.user_tutorial_progress;
CREATE POLICY "user_tutorial_progress_update_self" ON public.user_tutorial_progress
  FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_tutorial_progress_insert_self" ON public.user_tutorial_progress;
CREATE POLICY "user_tutorial_progress_insert_self" ON public.user_tutorial_progress
  FOR INSERT
    WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "user_tutorial_progress_service_role" ON public.user_tutorial_progress;
CREATE POLICY "user_tutorial_progress_service_role" ON public.user_tutorial_progress
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
CREATE INDEX IF NOT EXISTS idx_user_tutorial_progress_user ON public.user_tutorial_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tutorial_progress_tutorial ON public.user_tutorial_progress(tutorial_id);
CREATE INDEX IF NOT EXISTS idx_user_tutorial_progress_completed ON public.user_tutorial_progress(completed);
CREATE INDEX IF NOT EXISTS idx_user_tutorial_progress_skipped ON public.user_tutorial_progress(skipped);
CREATE OR REPLACE FUNCTION public.get_user_tutorial_status(p_user_id uuid)
  RETURNS TABLE(
    tutorial_id uuid,
    title text,
    description text,
    current_step integer,
    total_steps integer,
    completed boolean,
    skipped boolean,
    show_tutorial boolean)
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id AS tutorial_id,
    t.title,
    t.description,
    COALESCE(utp.current_step, 0) AS current_step,
    jsonb_array_length(t.content) AS total_steps,
    COALESCE(utp.completed, FALSE) AS completed,
    COALESCE(utp.skipped, FALSE) AS skipped,
    CASE WHEN COALESCE(utp.completed, FALSE) = TRUE THEN
      FALSE
    WHEN COALESCE(utp.skipped, FALSE) = TRUE THEN
      FALSE
    ELSE
      TRUE
    END AS show_tutorial
  FROM
    public.tutorials t
  LEFT JOIN public.user_tutorial_progress utp ON utp.tutorial_id = t.id
    AND utp.user_id = p_user_id
WHERE
  v_total_steps integer;
  v_final_completed boolean;
BEGIN
  SELECT
    jsonb_array_length(content) INTO v_total_steps
  FROM
    public.tutorials
  WHERE
    id = p_tutorial_id
    AND is_active = TRUE;
  IF v_total_steps IS NULL THEN
    RETURN FALSE;
  END IF;
  v_final_completed := p_completed
    OR (p_current_step >= v_total_steps - 1);
  INSERT INTO public.user_tutorial_progress(user_id, tutorial_id, current_step, completed, skipped, completed_at, skipped_at, updated_at)
    VALUES (p_user_id, p_tutorial_id, GREATEST(0, LEAST(p_current_step, v_total_steps - 1)), v_final_completed, CASE WHEN p_skipped THEN
        TRUE
      ELSE
        FALSE
      END, CASE WHEN v_final_completed THEN
        timezone('utc', now())
      ELSE
        NULL
      END, CASE WHEN p_skipped THEN
        timezone('utc', now())
      ELSE
        NULL
      END, timezone('utc', now()))
  ON CONFLICT (user_id, tutorial_id)
    DO UPDATE SET
      current_step = EXCLUDED.current_step, completed = EXCLUDED.completed, skipped = EXCLUDED.skipped, completed_at = EXCLUDED.completed_at, skipped_at = EXCLUDED.skipped_at, updated_at = EXCLUDED.updated_at;
  RETURN TRUE;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_user_tutorial_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_tutorial_progress(UUID, UUID, INTEGER, BOOLEAN, BOOLEAN) TO authenticated;
DROP TRIGGER IF EXISTS on_tutorials_updated ON public.tutorials;
CREATE TRIGGER on_tutorials_updated
  BEFORE UPDATE ON public.tutorials
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS on_user_tutorial_progress_updated ON public.user_tutorial_progress;
CREATE TRIGGER on_user_tutorial_progress_updated
  BEFORE UPDATE ON public.user_tutorial_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
-- -------------------------------------------------------------
-- SECTION: Automation triggers & functions (legacy 02)
-- -------------------------------------------------------------
-- =============================================================
-- PūrVita Network - Database Triggers and Functions
-- Execute this file after the schema to set up automated behaviors
-- =============================================================
-- ===========================================
-- 1. UPDATED_AT TRIGGER FUNCTION
-- ===========================================
-- Apply to all tables that need updated_at
DROP TRIGGER IF EXISTS on_profiles_updated ON public.profiles;
CREATE TRIGGER on_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS on_products_updated ON public.products;
CREATE TRIGGER on_products_updated
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS on_plans_updated ON public.plans;
CREATE TRIGGER on_plans_updated
  BEFORE UPDATE ON public.plans
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS on_payment_gateways_updated ON public.payment_gateways;
CREATE TRIGGER on_payment_gateways_updated
  BEFORE UPDATE ON public.payment_gateways
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS on_wallets_updated ON public.wallets;
CREATE TRIGGER on_wallets_updated
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS on_subscriptions_updated ON public.subscriptions;
CREATE TRIGGER on_subscriptions_updated
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS on_orders_updated ON public.orders;
CREATE TRIGGER on_orders_updated
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS on_phases_updated ON public.phases;
CREATE TRIGGER on_phases_updated
  BEFORE UPDATE ON public.phases
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS on_memberships_updated ON public.memberships;
CREATE TRIGGER on_memberships_updated
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS on_payment_wallets_updated ON public.payment_wallets;
CREATE TRIGGER on_payment_wallets_updated
  BEFORE UPDATE ON public.payment_wallets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS on_payment_requests_updated ON public.payment_requests;
CREATE TRIGGER on_payment_requests_updated
  BEFORE UPDATE ON public.payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS on_payment_methods_updated ON public.payment_methods;
CREATE TRIGGER on_payment_methods_updated
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS on_payout_transactions_updated ON public.payout_transactions;
CREATE TRIGGER on_payout_transactions_updated
  BEFORE UPDATE ON public.payout_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS on_payment_history_entries_updated ON public.payment_history_entries;
CREATE TRIGGER on_payment_history_entries_updated
  BEFORE UPDATE ON public.payment_history_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS on_payment_schedule_settings_updated ON public.payment_schedule_settings;
CREATE TRIGGER on_payment_schedule_settings_updated
  BEFORE UPDATE ON public.payment_schedule_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS on_product_reviews_updated ON public.product_reviews;
CREATE TRIGGER on_product_reviews_updated
  BEFORE UPDATE ON public.product_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS on_site_branding_settings_updated ON public.site_branding_settings;
CREATE TRIGGER on_site_branding_settings_updated
  BEFORE UPDATE ON public.site_branding_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS on_landing_page_content_updated ON public.landing_page_content;
CREATE TRIGGER on_landing_page_content_updated
  BEFORE UPDATE ON public.landing_page_content
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
DROP TRIGGER IF EXISTS on_team_page_content_updated ON public.team_page_content;
CREATE TRIGGER on_team_page_content_updated
  BEFORE UPDATE ON public.team_page_content
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
-- ===========================================
-- 2. CLASS VIDEOS UPDATED_AT TRIGGER
-- ===========================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS TRIGGER
  AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$
LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_class_videos_updated_at ON public.class_videos;
CREATE TRIGGER trg_class_videos_updated_at
  BEFORE UPDATE ON public.class_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
-- ===========================================
-- 3. AUTO-CREATE PROFILE FROM AUTH.USERS
-- ===========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  AS $$
DECLARE
  referrer_id uuid;
  user_referral_code text;
  member_role_id uuid;
BEGIN
  user_referral_code := COALESCE(NEW.raw_user_meta_data ->> 'referral_code', '');

  IF NEW.raw_user_meta_data ->> 'referred_by_code' IS NOT NULL THEN
    SELECT
      id INTO referrer_id
    FROM
      public.profiles
    WHERE
      referral_code = NEW.raw_user_meta_data ->> 'referred_by_code'
    LIMIT 1;
  END IF;

  -- Get the Member role ID (default role for new users)
  SELECT id INTO member_role_id
  FROM public.roles
  WHERE name = 'Member' AND is_system_role = true
  LIMIT 1;

  -- Insert profile with role_id assigned to Member role by default
  INSERT INTO public.profiles(id, name, email, referral_code, referred_by, role_id)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
      NEW.email,
      user_referral_code,
      referrer_id,
      member_role_id -- Default RBAC role (Member)
    )
  ON CONFLICT (id)
    DO NOTHING;
  RETURN NEW;
END;
$$
LANGUAGE plpgsql
SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
-- Function to recalculate sponsor phases in cascade
CREATE OR REPLACE FUNCTION public.recalculate_sponsor_phases_cascade(p_user uuid)
  RETURNS VOID
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
DECLARE
  current_sponsor uuid;
  max_iterations integer := 10;
  -- Prevent infinite loops (max 10 levels up)
  iteration_count integer := 0;
BEGIN
  PERFORM
    set_config('search_path', 'public', TRUE);
  IF p_user IS NULL THEN
    RETURN;
  END IF;
  -- Start with the direct sponsor of the user who just paid
  SELECT
    referred_by INTO current_sponsor
  FROM
    public.profiles
  WHERE
    id = p_user;
  -- Loop through the sponsor chain, recalculating each sponsor's phase
  WHILE current_sponsor IS NOT NULL
    AND iteration_count < max_iterations LOOP
      -- Recalculate the current sponsor's phase
      PERFORM
        public.recalculate_phase(current_sponsor);
      -- Move up to the next sponsor in the chain
      SELECT
        referred_by INTO current_sponsor
      FROM
        public.profiles
      WHERE
        id = current_sponsor;
      iteration_count := iteration_count + 1;
    END LOOP;
  -- Log if we hit the max iterations (potential issue)
  IF iteration_count >= max_iterations THEN
    RAISE WARNING 'recalculate_sponsor_phases_cascade: Hit max iterations (%) for user %', max_iterations, p_user;
  END IF;
END;
$$;
COMMENT ON FUNCTION public.recalculate_sponsor_phases_cascade(UUID) IS 'Recalculates phases for all sponsors in the upline chain when a user subscription becomes active.
This ensures that when a user pays their subscription, all their sponsors are checked for phase promotions.
Maximum 10 levels up to prevent infinite loops.';
-- Function to handle subscription activation
CREATE OR REPLACE FUNCTION public.handle_subscription_activation()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
DECLARE
  sponsor_id uuid;
BEGIN
  PERFORM
    set_config('search_path', 'public', TRUE);

  -- Get the sponsor ID for this user
  SELECT referred_by INTO sponsor_id
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Only trigger when subscription becomes active (wasn't active before)
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    -- Recalculate the user's own phase first
    PERFORM
      public.recalculate_phase(NEW.user_id);
    -- Then recalculate all sponsors in the upline
    PERFORM
      public.recalculate_sponsor_phases_cascade(NEW.user_id);
    -- Update sponsor's team_count if sponsor exists
    IF sponsor_id IS NOT NULL THEN
      PERFORM public.recalculate_team_count(sponsor_id);
    END IF;
  -- Handle when subscription becomes inactive (was active before)
  ELSIF OLD.status = 'active' AND NEW.status != 'active' THEN
    -- Update sponsor's team_count if sponsor exists
    IF sponsor_id IS NOT NULL THEN
      PERFORM public.recalculate_team_count(sponsor_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
COMMENT ON FUNCTION public.handle_subscription_activation() IS 'Trigger function that recalculates phases when a subscription becomes active.
Recalculates both the user phase and all sponsor phases in cascade.';
-- Trigger for automatic phase recalculation on subscription activation
DROP TRIGGER IF EXISTS trigger_recalculate_phases_on_subscription_active ON public.subscriptions;
CREATE TRIGGER trigger_recalculate_phases_on_subscription_active
  AFTER INSERT OR UPDATE OF status ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_subscription_activation();
COMMENT ON TRIGGER trigger_recalculate_phases_on_subscription_active ON public.subscriptions IS 'Automatically recalculates user and sponsor phases when a subscription becomes active.
This ensures the MLM phase system updates automatically when users pay their subscriptions.';
-- ===========================================
-- 4. MULTILEVEL SUPPORT FUNCTIONS
-- ===========================================
CREATE OR REPLACE FUNCTION public.active_users_count()
  RETURNS bigint
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
DECLARE
  result bigint := 0;
BEGIN
  PERFORM
    set_config('search_path', 'public', TRUE);
  SELECT
    COUNT(*) INTO result
  FROM
    public.subscriptions s
  WHERE
    s.status = 'active';
  RETURN COALESCE(result, 0);
END;
$$;
CREATE OR REPLACE FUNCTION public.count_active_level(p_user uuid, p_level integer)
  RETURNS bigint
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
DECLARE
  direct_count bigint := 0;
  second_level_total bigint := 0;
BEGIN
  PERFORM
    set_config('search_path', 'public', TRUE);
  IF p_user IS NULL THEN
    RETURN 0;
  END IF;
  IF p_level = 1 THEN
    SELECT
      COUNT(*) INTO direct_count
    FROM
      public.profiles child
      JOIN public.subscriptions sub ON sub.user_id = child.id
    WHERE
      child.referred_by = p_user
      AND sub.status = 'active';
    RETURN COALESCE(direct_count, 0);
  ELSIF p_level = 2 THEN
    SELECT
      COUNT(*) INTO second_level_total
    FROM
      public.profiles parent
      JOIN public.subscriptions parent_sub ON parent_sub.user_id = parent.id
      JOIN public.profiles grandchild ON grandchild.referred_by = parent.id
      JOIN public.subscriptions grandchild_sub ON grandchild_sub.user_id = grandchild.id
    WHERE
      parent.referred_by = p_user
      AND parent_sub.status = 'active'
      AND grandchild_sub.status = 'active';
    RETURN COALESCE(second_level_total, 0);
  ELSE
    RETURN 0;
  END IF;
END;
$$;
-- Legacy function for backward compatibility (calls the new multilevel function)
CREATE OR REPLACE FUNCTION public.fetch_two_level_tree(p_user uuid)
  RETURNS TABLE(
    descendant uuid,
    email text,
    status text,
    level INTEGER,
    phase integer)
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
BEGIN
  PERFORM
    set_config('search_path', 'public', TRUE);
  -- Call the new multilevel function with max 2 levels for backward compatibility
  RETURN QUERY
  SELECT
    *
  FROM
    public.fetch_multilevel_tree(p_user, 2);
END;
$$;
-- New dynamic multilevel tree function
CREATE OR REPLACE FUNCTION public.fetch_multilevel_tree(p_user uuid, p_max_levels integer DEFAULT 10)
  RETURNS TABLE(
    descendant uuid,
    email text,
    name text,
    status text,
    level INTEGER,
    phase integer,
    allow_team_messages boolean)
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
DECLARE
  current_level integer := 1;
  level_users uuid[];
  next_level_users uuid[];
BEGIN
  PERFORM
    set_config('search_path', 'public', TRUE);
  -- Validate inputs
  IF p_user IS NULL THEN
    RETURN;
  END IF;
  IF p_max_levels < 1 OR p_max_levels > 10 THEN
    p_max_levels := 10;
  END IF;
  -- Initialize with the root user's direct referrals (Level 1)
  level_users := ARRAY (
    SELECT
      id
    FROM
      public.profiles
    WHERE
      referred_by = p_user);
  -- Return Level 1 members
  RETURN QUERY
  SELECT
    child.id AS descendant,
    child.email,
    child.name,
    sub.status,
    1 AS level,
    ph.phase,
    COALESCE(child.allow_team_messages, true) AS allow_team_messages
  FROM
    public.profiles child
  LEFT JOIN public.subscriptions sub ON sub.user_id = child.id
  LEFT JOIN public.phases ph ON ph.user_id = child.id
WHERE
  child.referred_by = p_user;
  -- Loop through remaining levels (2 to p_max_levels)
  FOR current_level IN 2..p_max_levels LOOP
    -- If no users at previous level, stop
    IF array_length(level_users, 1) IS NULL OR array_length(level_users, 1) = 0 THEN
      EXIT;
    END IF;
    -- Get next level users (children of current level users)
    next_level_users := ARRAY (
      SELECT
        id
      FROM
        public.profiles
      WHERE
        referred_by = ANY (level_users));
    -- If no users at this level, stop
    IF array_length(next_level_users, 1) IS NULL OR array_length(next_level_users, 1) = 0 THEN
      EXIT;
    END IF;
    -- Return this level's members
    RETURN QUERY
    SELECT
      child.id AS descendant,
      child.email,
      child.name,
      sub.status,
      current_level AS level,
      ph.phase,
      COALESCE(child.allow_team_messages, true) AS allow_team_messages
    FROM
      public.profiles child
    LEFT JOIN public.subscriptions sub ON sub.user_id = child.id
    LEFT JOIN public.phases ph ON ph.user_id = child.id
  WHERE
    child.referred_by = ANY (level_users);
    -- Move to next level
    level_users := next_level_users;
  END LOOP;
  RETURN;
END;
$$;
GRANT EXECUTE ON FUNCTION public.fetch_multilevel_tree(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_multilevel_tree(UUID, INTEGER) TO service_role;
-- Grant permissions for cascade phase recalculation functions
GRANT EXECUTE ON FUNCTION public.recalculate_sponsor_phases_cascade(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_sponsor_phases_cascade(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_subscription_activation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.handle_subscription_activation() TO service_role;
COMMENT ON FUNCTION public.fetch_multilevel_tree(UUID, INTEGER) IS 'Fetches the multilevel network tree for a user up to p_max_levels deep. Returns all descendants with their subscription status, level, and phase information.';
CREATE OR REPLACE FUNCTION public.recalculate_phase(p_user uuid)
  RETURNS VOID
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
DECLARE
  subscription_active boolean := FALSE;
  had_previous_subscription boolean := FALSE;
  direct_active_count bigint := 0;
  second_level_total bigint := 0;
  min_second_level bigint := 0;
  new_phase integer := 0;
  current_phase integer := 0;
  highest_achieved integer := 0;
  is_manual_override boolean := FALSE;
  phase1 boolean := FALSE;
  phase2 boolean := FALSE;
  phase3 boolean := FALSE;
  commission numeric(5, 4) := 0.08;
  custom_commission numeric(5, 4) := NULL;
  existing_phase2 timestamptz := NULL;
BEGIN
  PERFORM
    set_config('search_path', 'public', TRUE);
  IF p_user IS NULL THEN
    RETURN;
  END IF;

  -- Load any custom commission override configured for the profile
  SELECT
    commission_rate INTO custom_commission
  FROM
    public.profiles
  WHERE
    id = p_user;

  -- Check current subscription status
  SELECT
    (sub.status = 'active') INTO subscription_active
  FROM
    public.subscriptions sub
  WHERE
    sub.user_id = p_user
  ORDER BY
    sub.updated_at DESC NULLS LAST,
    sub.created_at DESC
  LIMIT 1;

  -- Check if user had a previous active subscription (by checking payments history)
  SELECT EXISTS (
    SELECT 1 
    FROM public.payments 
    WHERE user_id = p_user 
      AND kind = 'subscription' 
      AND status = 'paid'
    LIMIT 1
  ) INTO had_previous_subscription;

  -- Get current phase info
  SELECT 
    phase, 
    highest_phase_achieved, 
    manual_phase_override,
    phase2_achieved_at
  INTO 
    current_phase, 
    highest_achieved, 
    is_manual_override,
    existing_phase2
  FROM public.phases
  WHERE user_id = p_user;

  -- If phase was manually set by admin, don't recalculate
  IF is_manual_override THEN
    RETURN;
  END IF;

  -- Count direct active referrals
  SELECT
    COUNT(*) INTO direct_active_count
  FROM
    public.profiles child
    JOIN public.subscriptions sub ON sub.user_id = child.id
  WHERE
    child.referred_by = p_user
    AND sub.status = 'active';

  -- Count second level active referrals
  WITH second_counts AS (
    SELECT
      parent.id AS parent_id,
      COUNT(*) AS active_children
    FROM
      public.profiles parent
      JOIN public.subscriptions parent_sub ON parent_sub.user_id = parent.id
      JOIN public.profiles grandchild ON grandchild.referred_by = parent.id
      JOIN public.subscriptions grandchild_sub ON grandchild_sub.user_id = grandchild.id
    WHERE
      parent.referred_by = p_user
      AND parent_sub.status = 'active'
      AND grandchild_sub.status = 'active'
    GROUP BY
      parent.id
  )
  SELECT
    COALESCE(SUM(active_children), 0),
    COALESCE(MIN(active_children), 0) INTO second_level_total,
    min_second_level
  FROM
    second_counts;

  -- Calculate phase eligibility
  phase1 := subscription_active
    AND direct_active_count >= 2;
  phase2 := phase1
    AND second_level_total >= 4
    AND min_second_level >= 2;
  phase3 := phase2
    AND direct_active_count >= 2
    AND min_second_level >= 2;

  -- Determine calculated phase
  IF phase3 THEN
    new_phase := 3;
  ELSIF phase2 THEN
    new_phase := 2;
  ELSIF phase1 THEN
    new_phase := 1;
  ELSIF subscription_active THEN
    new_phase := 0;
  ELSE
    new_phase := 0;
  END IF;

  -- IMPORTANT: If user is reactivating and had a previous subscription,
  -- preserve their highest achieved phase (don't downgrade)
  IF subscription_active AND had_previous_subscription AND highest_achieved > new_phase THEN
    new_phase := highest_achieved;
    RAISE NOTICE 'Preserving phase % for user % on reactivation (calculated: %)', 
      highest_achieved, p_user, new_phase;
  END IF;

  -- Update highest_phase_achieved if new phase is higher
  IF new_phase > highest_achieved THEN
    highest_achieved := new_phase;
  END IF;

  -- Respect custom commission overrides, otherwise fall back to defaults
  IF custom_commission IS NOT NULL THEN
    commission := custom_commission;
  ELSE
    IF new_phase = 3 THEN
      commission := 0.15;
    ELSIF new_phase = 2 THEN
      commission := 0.12;
    ELSIF new_phase = 1 THEN
      commission := 0.10;
    ELSIF subscription_active THEN
      commission := 0.08;
    ELSE
      commission := 0.08;
    END IF;
  END IF;

  -- Update phase record
  INSERT INTO public.phases(
    user_id, 
    phase, 
    ecommerce_commission, 
    phase1_granted, 
    phase2_granted, 
    phase3_granted, 
    phase2_achieved_at,
    highest_phase_achieved,
    manual_phase_override
  )
  VALUES (
    p_user, 
    new_phase, 
    commission, 
    phase1, 
    phase2, 
    phase3, 
    CASE 
      WHEN phase2 AND (existing_phase2 IS NULL) THEN timezone('utc', now())
      ELSE existing_phase2
    END,
    highest_achieved,
    FALSE
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    phase = EXCLUDED.phase,
    ecommerce_commission = EXCLUDED.ecommerce_commission,
    phase1_granted = EXCLUDED.phase1_granted,
    phase2_granted = EXCLUDED.phase2_granted,
    phase3_granted = EXCLUDED.phase3_granted,
    highest_phase_achieved = EXCLUDED.highest_phase_achieved,
    phase2_achieved_at = CASE 
      WHEN EXCLUDED.phase2_granted AND public.phases.phase2_achieved_at IS NULL THEN
        EXCLUDED.phase2_achieved_at
      WHEN NOT EXCLUDED.phase2_granted THEN
        NULL
      ELSE
        public.phases.phase2_achieved_at
    END,
    updated_at = timezone('utc', now())
  WHERE 
    -- Only update if not manually overridden
    public.phases.manual_phase_override = FALSE;

  RETURN;
END;
$$;
COMMENT ON FUNCTION public.recalculate_phase(UUID) IS 'Recalculates user phase based on network activity. Preserves highest achieved phase when users reactivate their subscription. Respects manual_phase_override flag set by admins. Respects custom profiles.commission_rate overrides when present.';

-- Function for admins to manually set user phase
CREATE OR REPLACE FUNCTION public.admin_set_user_phase(
  p_user_id uuid,
  p_new_phase integer,
  p_admin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin boolean;
  v_commission numeric(5, 4);
  v_result jsonb;
BEGIN
  -- Verify admin permissions
  SELECT (role = 'admin') INTO v_is_admin
  FROM public.profiles
  WHERE id = p_admin_id;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Only admins can manually set user phases'
    );
  END IF;

  -- Validate phase range
  IF p_new_phase < 0 OR p_new_phase > 3 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid phase: must be between 0 and 3'
    );
  END IF;

  -- Determine commission based on phase
  CASE p_new_phase
    WHEN 3 THEN v_commission := 0.15;
    WHEN 2 THEN v_commission := 0.12;
    WHEN 1 THEN v_commission := 0.10;
    ELSE v_commission := 0.08;
  END CASE;

  -- Update or insert phase with manual override flag
  INSERT INTO public.phases(
    user_id,
    phase,
    ecommerce_commission,
    highest_phase_achieved,
    manual_phase_override,
    phase1_granted,
    phase2_granted,
    phase3_granted
  )
  VALUES (
    p_user_id,
    p_new_phase,
    v_commission,
    GREATEST(p_new_phase, 0),
    TRUE,
    p_new_phase >= 1,
    p_new_phase >= 2,
    p_new_phase >= 3
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    phase = EXCLUDED.phase,
    ecommerce_commission = EXCLUDED.ecommerce_commission,
    highest_phase_achieved = GREATEST(public.phases.highest_phase_achieved, EXCLUDED.phase),
    manual_phase_override = TRUE,
    phase1_granted = EXCLUDED.phase1_granted,
    phase2_granted = EXCLUDED.phase2_granted,
    phase3_granted = EXCLUDED.phase3_granted,
    updated_at = timezone('utc', now());

  -- Log the admin action
  INSERT INTO public.audit_logs(
    user_id,
    action,
    entity_type,
    entity_id,
    details
  )
  VALUES (
    p_admin_id,
    'update',
    'phase',
    p_user_id::text,
    jsonb_build_object(
      'new_phase', p_new_phase,
      'manual_override', true,
      'admin_id', p_admin_id
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'phase', p_new_phase,
    'message', 'Phase updated successfully with manual override'
  );
END;
$$;

COMMENT ON FUNCTION public.admin_set_user_phase(uuid, integer, uuid) IS 'Allows admins to manually set a user phase. Sets manual_phase_override flag to prevent automatic recalculation.';

GRANT EXECUTE ON FUNCTION public.admin_set_user_phase(uuid, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_phase(uuid, integer, uuid) TO service_role;

-- ===========================================
-- Cascade Phase Recalculation for Sponsors
-- ===========================================
CREATE OR REPLACE FUNCTION public.admin_dashboard_metrics()
  RETURNS TABLE(
    total_users bigint,
    active_subscriptions bigint,
    waitlisted_subscriptions bigint,
    total_subscription_revenue bigint,
    total_order_revenue bigint,
    total_wallet_balance bigint)
  LANGUAGE plpgsql
  SECURITY DEFINER STABLE
  AS $$
BEGIN
  PERFORM
    set_config('search_path', 'public', TRUE);
  RETURN QUERY
  SELECT
(
      SELECT
        COUNT(*)
      FROM
        public.profiles),
(
      SELECT
        COUNT(*)
      FROM
        public.subscriptions
      WHERE
        status = 'active'),
(
      SELECT
        0::bigint), COALESCE((
      SELECT
        SUM(amount_cents)
      FROM public.payments
    WHERE
      status = 'paid'
      AND kind = 'subscription'), 0),
    COALESCE((
      SELECT
        SUM(total_cents)
      FROM public.orders
    WHERE
      status = 'paid'), 0), COALESCE((
      SELECT
        SUM(balance_cents)
      FROM public.wallets), 0);
END;
$$;

-- ===========================================
-- Optimized Admin Dashboard Metrics (Extended)
-- Resolves N+1 query problem by returning all dashboard data in a single query
-- Created: 2025-01-29
-- Updated: 2025-05-27 - Subscription revenue now calculated for current month only
-- ===========================================
CREATE OR REPLACE FUNCTION public.admin_dashboard_metrics_extended(recent_limit integer DEFAULT 5)
  RETURNS TABLE(
    total_users bigint,
    total_products bigint,
    active_subscriptions bigint,
    waitlisted_subscriptions bigint,
    total_subscription_revenue bigint,
    total_order_revenue bigint,
    total_wallet_balance bigint,
    total_stock bigint,
    recent_users jsonb,
    recent_products jsonb,
    product_stock jsonb,
    recent_audit_logs jsonb
  )
  LANGUAGE plpgsql
  SECURITY DEFINER STABLE
  AS $$
DECLARE
  v_total_users bigint;
  v_total_products bigint;
  v_active_subscriptions bigint;
  v_waitlisted_subscriptions bigint;
  v_total_subscription_revenue bigint;
  v_total_order_revenue bigint;
  v_total_wallet_balance bigint;
  v_total_stock bigint;
  v_recent_users jsonb;
  v_recent_products jsonb;
  v_product_stock jsonb;
  v_recent_audit_logs jsonb;
  v_month_start timestamptz;
BEGIN
  PERFORM set_config('search_path', 'public', TRUE);

  -- Calculate the start of the current month (UTC)
  v_month_start := date_trunc('month', timezone('utc', now()));

  -- Get total users count
  SELECT COUNT(*) INTO v_total_users FROM public.profiles;

  -- Get total products count
  SELECT COUNT(*) INTO v_total_products FROM public.products;

  -- Get active subscriptions count
  SELECT COUNT(*) INTO v_active_subscriptions
  FROM public.subscriptions
  WHERE status = 'active';

  -- Get waitlisted subscriptions (placeholder - always 0 for now)
  v_waitlisted_subscriptions := 0;

  -- Get total subscription revenue for the CURRENT MONTH only
  -- Only counts payments from users who have active subscriptions
  SELECT COALESCE(SUM(p.amount_cents), 0) INTO v_total_subscription_revenue
  FROM public.payments p
  INNER JOIN public.subscriptions s ON s.user_id = p.user_id AND s.status = 'active'
  WHERE p.status = 'paid' 
    AND p.kind = 'subscription'
    AND p.created_at >= v_month_start;

  -- Get total order revenue
  SELECT COALESCE(SUM(total_cents), 0) INTO v_total_order_revenue
  FROM public.orders
  WHERE status = 'paid';

  -- Get total wallet balance
  SELECT COALESCE(SUM(balance_cents), 0) INTO v_total_wallet_balance
  FROM public.wallets;

  -- Get total stock across all products
  SELECT COALESCE(SUM(stock_quantity), 0) INTO v_total_stock
  FROM public.products;

  -- Fetch recent users (with role from RBAC system)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'email', p.email,
      'role', COALESCE(r.name, 'member'),
      'status', p.status,
      'created_at', p.created_at,
      'referral_code', p.referral_code,
      'referred_by', p.referred_by
    )
    ORDER BY p.created_at DESC
  ), '[]'::jsonb)
  INTO v_recent_users
  FROM (
    SELECT id, name, email, role_id, status, created_at, referral_code, referred_by
    FROM public.profiles
    ORDER BY created_at DESC
    LIMIT recent_limit
  ) p
  LEFT JOIN public.roles r ON r.id = p.role_id;

  -- Fetch recent products
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', pr.id,
      'name', pr.name,
      'slug', pr.slug,
      'price_cents', COALESCE((pr.price * 100)::bigint, 0),
      'stock_quantity', pr.stock_quantity,
      'created_at', pr.created_at
    )
    ORDER BY pr.created_at DESC
  ), '[]'::jsonb)
  INTO v_recent_products
  FROM (
    SELECT id, name, slug, price, stock_quantity, created_at
    FROM public.products
    ORDER BY created_at DESC
    LIMIT recent_limit
  ) pr;

  -- Fetch product stock summary
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', pr.id,
      'name', pr.name,
      'stockQuantity', pr.stock_quantity
    )
    ORDER BY pr.stock_quantity ASC
  ), '[]'::jsonb)
  INTO v_product_stock
  FROM public.products pr
  WHERE pr.stock_quantity IS NOT NULL;

  -- Fetch recent audit logs (limit * 3 per entity type, then sort and limit)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', al.id,
      'entity_type', al.entity_type,
      'entity_id', al.entity_id,
      'action', al.action,
      'actor_id', al.user_id,
      'changes', al.metadata,
      'created_at', al.created_at,
      'actor_name', p.name,
      'actor_email', p.email
    )
    ORDER BY al.created_at DESC
  ), '[]'::jsonb)
  INTO v_recent_audit_logs
  FROM (
    SELECT al.id, al.entity_type, al.entity_id, al.action, al.user_id, al.metadata, al.created_at
    FROM public.audit_logs al
    WHERE al.entity_type IN ('product', 'user', 'subscription', 'wallet', 'order')
    ORDER BY al.created_at DESC
    LIMIT (recent_limit * 3)
  ) al
  LEFT JOIN public.profiles p ON p.id = al.user_id;

  -- Return all data in a single row
  RETURN QUERY SELECT
    v_total_users,
    v_total_products,
    v_active_subscriptions,
    v_waitlisted_subscriptions,
    v_total_subscription_revenue,
    v_total_order_revenue,
    v_total_wallet_balance,
    v_total_stock,
    v_recent_users,
    v_recent_products,
    v_product_stock,
    v_recent_audit_logs;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_dashboard_metrics_extended(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_metrics_extended(integer) TO service_role;

-- -------------------------------------------------------------
-- SECTION: Indexes and seed data (legacy 03)
-- -------------------------------------------------------------
-- =============================================================
-- PūrVita Network - Database Indexes and Seed Data
-- Execute this file last to optimize performance and add initial data
-- =============================================================
-- ===========================================
-- 1. PERFORMANCE INDEXES
-- ===========================================
-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON public.profiles(referred_by);
-- Note: idx_profiles_role removed - replaced by idx_profiles_role_id (created earlier)
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON public.profiles(stripe_customer_id)
WHERE
  stripe_customer_id IS NOT NULL;
-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_featured ON public.products(is_featured);
-- Plans indexes
CREATE INDEX IF NOT EXISTS idx_plans_slug ON public.plans(slug);
CREATE INDEX IF NOT EXISTS idx_plans_active ON public.plans(is_active);
-- Class videos indexes
CREATE INDEX IF NOT EXISTS idx_class_videos_order ON public.class_videos(is_published, order_index, created_at);
CREATE INDEX IF NOT EXISTS idx_class_videos_is_featured ON public.class_videos(is_featured)
WHERE
  is_featured = TRUE;
-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON public.audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
-- Wallet & subscription indexes
CREATE INDEX IF NOT EXISTS idx_wallets_user ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_txns_user_created_at ON public.wallet_txns(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_network_commissions_user ON public.network_commissions(user_id);
CREATE INDEX IF NOT EXISTS idx_network_commissions_member ON public.network_commissions(member_id);
CREATE INDEX IF NOT EXISTS idx_network_commissions_available ON public.network_commissions(user_id, available_cents)
WHERE
  available_cents > 0;
CREATE INDEX IF NOT EXISTS idx_payout_accounts_status ON public.payout_accounts(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payments_user_created_at ON public.payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_kind_status ON public.payments(kind, status);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_created_at ON public.orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_phases_phase ON public.phases(phase);
CREATE INDEX IF NOT EXISTS idx_memberships_sponsor ON public.memberships(sponsor_id);
CREATE INDEX IF NOT EXISTS idx_memberships_phase_id ON public.memberships(phase_id);
CREATE INDEX IF NOT EXISTS idx_payment_wallets_provider ON public.payment_wallets(provider);
CREATE INDEX IF NOT EXISTS idx_payment_wallets_active ON public.payment_wallets(is_active);
CREATE INDEX IF NOT EXISTS idx_payment_requests_user ON public.payment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON public.payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_wallet ON public.payment_requests(wallet_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON public.payment_methods(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_stripe_id ON public.payment_methods(stripe_payment_method_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_user_default ON public.payment_methods(user_id)
WHERE
  is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_payout_transactions_user ON public.payout_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_transactions_status ON public.payout_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payout_transactions_created_at ON public.payout_transactions(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_provider_event ON public.webhook_events(provider, event_id);
-- ===========================================
-- 2. SEED DATA - PAYMENT GATEWAYS
-- ===========================================
-- PayPal: Desactivado por defecto, modo producción, solo pagos
INSERT INTO public.payment_gateways(provider, is_active, functionality, mode)
  VALUES ('paypal', FALSE, 'payment', 'production')
ON CONFLICT (provider)
  DO NOTHING;

-- Stripe: Desactivado por defecto, modo producción, solo pagos
INSERT INTO public.payment_gateways(provider, is_active, functionality, mode)
  VALUES ('stripe', FALSE, 'payment', 'production')
ON CONFLICT (provider)
  DO NOTHING;

-- Wallet: Activo por defecto, siempre en producción, solo pagos
INSERT INTO public.payment_gateways(provider, is_active, functionality, mode)
  VALUES ('wallet', TRUE, 'payment', 'production')
ON CONFLICT (provider)
  DO NOTHING;

-- Manual: Desactivado por defecto, siempre en producción, solo pagos
INSERT INTO public.payment_gateways(provider, is_active, functionality, mode)
  VALUES ('manual', FALSE, 'payment', 'production')
ON CONFLICT (provider)
  DO NOTHING;

-- Authorize.net: Desactivado por defecto, modo producción, solo pagos
INSERT INTO public.payment_gateways(provider, is_active, functionality, mode)
  VALUES ('authorize_net', FALSE, 'payment', 'production')
ON CONFLICT (provider)
  DO NOTHING;

-- Payoneer: Desactivado por defecto, modo producción, solo cobros (payouts)
INSERT INTO public.payment_gateways(provider, is_active, functionality, mode)
  VALUES ('payoneer', FALSE, 'payout', 'production')
ON CONFLICT (provider)
  DO NOTHING;

INSERT INTO public.payment_gateways(provider, is_active, credentials)
  VALUES ('wallet', TRUE, '{"walletBalanceCents": 0}'::jsonb)
ON CONFLICT (provider)
  DO NOTHING;
-- ===========================================
-- 3. SEED DATA - SUBSCRIPTION PLANS
-- ===========================================
INSERT INTO public.plans(slug, name, description, price, features, is_active)
  VALUES ('basic', 'Plan Básico', 'Plan ideal para comenzar tu viaje de bienestar', 9.99, '["Acceso a clases básicas", "Recursos de nutrición", "Soporte por email"]'::jsonb, TRUE),
('pro', 'Plan Pro', 'Para quienes buscan resultados avanzados', 29.99, '["Todo del plan básico", "Clases premium", "Consultas personalizadas", "Acceso 24/7", "Recursos exclusivos"]'::jsonb, TRUE),
('diamond', 'Plan Diamond', 'La experiencia completa de transformación', 99.99, '["Todo del plan pro", "Sesiones 1:1 con coaches", "Planes nutricionales personalizados", "Acceso VIP", "Eventos exclusivos"]'::jsonb, TRUE)
ON CONFLICT (slug)
  DO NOTHING;
-- ===========================================
-- 4. SEED DATA - SAMPLE CLASS VIDEOS
-- ===========================================
INSERT INTO public.class_videos(title, description, youtube_id, is_featured, order_index)
  VALUES ('Bienvenida al programa', 'Conoce la vision y estructura basica del plan de clases.', 'dQw4w9WgXcQ', TRUE, 1),
('Primeros pasos con la plataforma', 'Tutorial rapido para navegar el panel y aprovechar los recursos.', '3fumBcKC6RE', FALSE, 2)
ON CONFLICT (id)
  DO NOTHING;
-- ===========================================
-- 5. SEED DATA - PRODUCTS FROM CATALOG
-- ===========================================
INSERT INTO public.products(slug, name, description, price, images, is_featured)
  VALUES ('phytotherapi-sleep', 'Phytotherapi Sleep', 'RESTAURA TU SALUD DEL SUEÑO Phytotherapi SLEEP (SUEÑO) Consigue un sueño reparador y profundo. INDICACIONES Actúa sobre la glándula pineal, normaliza las frecuencias de sueño, activa el sueño profundo para que tenga energía al despertar, ayuda a restaurar el ritmo circadiano. Recomendado en caso de: desorden del sueño y desequilibrios del ritmo circadiano. DOSIS Coloque 1 a 2 gotas de Phytotherapi Sleep en la palma de la mano, con el dedo índice aplíquelo en la frente, las sienes, detrás de las orejas, la nuca y en las plantas de los pies; frote sus manos suavemente e inhale profundamente 3 veces. "inhalar y exhalar" enfocando su mente en la respiración. Aplicar en la noche, al ir a dormir. Además, coloque 1 gota de Phytotherapi Sleep en su almohada y en el pijama. INGREDIENTES Cananga Odorata, Anthemis Nobilis, Lavandula, Vetiveria Zizanioides y Citrus Sinensis. RECOMENDADO EN EMBARAZADAS.', 65.00, '[]'::jsonb, FALSE),
('phytotherapi-stress', 'Phytotherapi Stress', 'VIVE LIBRE DE ESTRÉS Phytotherapi STRESS (ESTRÉS) Equilibra tu nivel de estrés y favorece una mejor calidad de vida INDICACIONES Equilibra el sistemas simpático y parasimpático, actúa directamente en hipocampo, amígdala cerebral, suprarrenales, área neocórtex y zona límbica, tiene la capacidad de penetrar la barrera hematoencefálico, equilibrar la bioquímica del mismo relajando las neuronas que están en estado de alerta constante, da balance al sistema nervioso, reduciendo los niveles del cortisol y otras hormonas del estrés, lo cual favorece un estado mental de calma. Recomendado en caso de: Alto nivel de estrés, ansiedad, depresión, alteración del sistema nervioso central y periférico. DOSIS Aplicar 1 a 2 gotas en la palma de la mano. Use el dedo índice para aplicar Phyto Stress en la frente, las sienes, la parte posterior de las orejas y la nuca. Inmediatamente después, frote sus manos suavemente e inhale profundamente 3 veces. "Inhalar y exhalar", enfocando su mente en la respiración. Aplicar 3 veces al día. De preferencia después del desayuno, comida y cena. En caso de estrés en exceso, aplicar 1 gota de Phyto estrés en la punta de la lengua, mantener durante un minuto y después pasarlo. En caso de fiebre, aplicar sobre columna vertebral cada 2 horas, hasta remitir la fiebre. INGREDIENTES Boswellia Frereana, Lavandula, Pelargonium Graveolens, Cananga Odorata, Citrus Bergamia, Pogostemon Cablin y Citrus Lemon. MUJERES EMBARAZADAS APLICAR SOLO EN LA PLANTA DE LOS PIES.', 65.00, '[]'::jsonb, FALSE),
('essential-therapi', 'Essential Therapi', 'REGRESA TUS CÉLULAS A SU ESENCIA Essential Therapi Una mezcla de minerales que actúan como un regenerador de células que ayuda a combatir el envejecimiento y mejora la absorción de vitaminas. INDICACIONES Recomendado en caso de: diabetes tipo 1 y tipo 2, síndromes metabólicos y problemas neurológicos. DOSIS Tomar 12 gotas de Essential therapi mezcladas en un licuado, sopa, agua u otro líquido permitido, una vez al día después de la comida o con la comida. INGREDIENTES Magnesio, cloruro, sodio, potasio, sulfato, boro. RECOMENDADO EN EMBARAZADAS.', 65.00, '[]'::jsonb, FALSE),
('phytotherapi-inflammation', 'Phytotherapi Inflammation', 'ALIVIA LA INFLAMACIÓN Phytotherapi INFLAMMATION Reduce el estrés en los tejidos mediante la regulación del sistema inmunológico en los procesos de desinflamación. INDICACIONES Recomendado en caso de: inflamación en tejidos musculares, distrofia muscular. DOSIS En un vaso de cristal mezcle 1 cucharada cafetera de aceite de coco con 2 gotas de Phytotherapi Inflammation. Aplicar en el área inflamada después desayunar, comer y cenar. * Grado de inflamación: Dosifique desde una gota al día, hasta 1 gota cada 2 horas. NOTA: Para continuar con el protocolo, usar una porción de media cucharada cafetera de aceite de coco más 1 gota de Phyto inflamation y aplicar en plantas de los pies INGREDIENTES Boswellia Frereana, Origanum Majorana, E. Radiata y M. Alternifolia LAS MUJERES EMBARAZADAS DEBEN APLICARLO SÓLO EN LAS PLANTAS DE LOS PIES.', 65.00, '[]'::jsonb, FALSE),
('phyto-vitamix', 'Phyto Vitamix', 'QUE NO TE FALTEN VITAMINAS Phyto Vitamix Complemento nutricional que aporta los elementos como vitaminas y minerales que requieren tus células para realizar cualquier reparación a los daños ocasionados a nivel celular, regulando el metabolismo energético y aumentando la vitalidad. INDICACIONES Recomendado en caso de: enfermedades crónicas (obesidad, diabetes, hipertensión arterial sistémica, depresión, ansiedad, artritis, insomnio, entre otras), desnutrición, deficiencias específicas de vitaminas y minerales. DOSIS Tomar 1 a 2 cucharadas soperas juntas al día, con agua o en batido permitido. *Si hay condiciones crónicas tomar 2 cucharadas soperas al día. Agitar muy bien antes de tomar. INGREDIENTES Vitamina A (como: carotenos y palmitato), Vitamina C (como: ácido ascórbico), D3 (como: colecalciferol), vitamina E (como: acetatode D-alfa tocoferol), Vitamina K (fitonadiona), tiamina (tiamina HCL), Vitamina B1 (rivoflavina), vitamina B2 (niacina como niacinamida), vitamina B3, Vitamina B6 (piridoxina HCL), vitamina B12 (cianocobalamina), ácido pantoténico (D-pantoteno de calcio), colina (bitartrano), calcio (fosfato tricalcico, citrato de calcio), hierro (Itm), fósforo (fosfato tricálcico), yodo (yoduro de potasio), magnesio (citrato e magnesio, gluconato, Itm), Zinc (citrato e zinc), Selenio (selenometionina), cobre (gluconado de cobre), magnaneso (gluconado de manganeso), cromo (amino de cromo Quelato ácido), Molibdeno (molibdeno de sodio), cloruro (Itm), Sodio (molibdato de sodio, Itm), Potasio yoduro de potasio, Itm), Minerales traza iónicos de espectro completo, Inositol, Bioflavonoides cítricos, sulfato (Itm), extracto de hoja de aloe vera (Aloe Barbadensis), Boro (Glicinato de boro, Itm). Otros ingredientes: Agua purificada, Glicerina vegetal natural, xilitol, Sabores naturales de Frambruesa y Sabores naturales de Fresa, Ácido cítrico. RECOMENDADO EN EMBARAZADAS.', 65.00, '[]'::jsonb, FALSE),
('prompt-anti-inflammatory', 'Prompt Anti-Inflammatory', 'RECUPERA TU BIENESTAR Prompt ANTI-INFLAMATORY Reduce la inflamación de manera local o generalizada. La mayoría de los procesos de enfermedad crónica inducen estados inflamatorios en nuestros órganos. INDICACIONES Recomendado en caso de: inflamación, falta de energía, alteraciones del estado del ánimo, descontrol de peso, padecimientos como: diabetes, hipertensión arterial, obesidad, insomnio, estrés, ansiedad, depresión, artritis, colitis, desnutrición, deficiencias del desarrollo y crecimiento, entre otros. DOSIS Tomar de 1 a 2 cucharadas soperas de Prompt anti-inflamatory juntas al día, de acuerdo al grado de afectación, directamente o diluidas en 250 ml de agua después del desayuno, o en batidos permitidos Agitar muy bien antes de tomar. Una vez abierto el frasco, mantener en refrigeración. INGREDIENTES Shiitaky, extractos de Berry, saúco – zinc, vitamina C - vitamina D, minerales traza iónicos. RECOMENDADO EN EMBARAZADAS.', 65.00, '[]'::jsonb, FALSE),
('phytotherapi-circulacion', 'Phytotherapi Circulación', 'BUENA SALUD CARDIOVASCULAR Phytotherapi CIRCULACIÓN El sistema circulatorio proporciona alimentación y oxigenación a las células, así como recoger los desechos metabólicos y eliminarlos de nuestro cuerpo, son parte de su función principal. INDICACIONES Recomendado en caso de: arritmia, aterosclerosis, para mejorar la circulación, cardiotónico, circulación, colesterol alto, problemas cardíacos, flebitis, hipertensión, palpitaciones, prolapso de la válvula mitral, taquicardia, venas varicosas, entre otros. DOSIS En un vaso de cristal mezcle 1 cucharadas cafetera de aceite de coco con 2 gotas de Phytotherapi Circulación. Seguidamente aplique en el área de corazón, pecho y pulmón, después de desayunar, comer y cenar. Grado de afectación: Dosifique desde 1 gota por día, hasta 1 a 2 gotas cada 4 horas. Aplicación en varices: En un vaso de cristal mezcle 2 cucharadas soperas de aceite de coco con 4 gotas de Phytotherapi Circulación. Seguidamente aplicar sobre el área de las venas a trabajar. Cubra el área con un paño húmedo y caliente, que sea confortable su sensación. Nota: Para continuar con el protocolo, usar una porción de 1/2 cucharada cafetera de aceite de coco más 1 gota de phyto circulación y aplicar en plantas de pies. INGREDIENTES Cupressus Sempervirens, Zingiber officinale, Thymus Vulgare, Origanum Majorana, Pelargonium Graveolens y Lavandula. LAS MUJERES EMBARAZADAS DEBEN APLICARSE SÓLO A LAS PLANTAS DE LOS PIES.', 65.00, '[]'::jsonb, FALSE),
('phytotherapi-pain', 'Phytotherapi Pain', 'ALIVIA EL DOLOR Phytotherapi PAIN (DOLOR) Alivia el dolor de inmediato. INDICACIONES Recomendado en caso de: dolor muscular, osteoartritis, calambres musculares, estrés muscular, lesiones, trauma y tensión. DOSIS En un vaso de cristal mezcle 1 cucharada cafetera de aceite de coco con 2 gotas de Phytotherapi Pain. Seguidamente ponga en donde existe dolor. Aplique cada vez que tenga dolor. *Grado de afectación: Aplicar desde1 gota al día, hasta 1 gota cada 60 minutos. NOTA: Para continuar con el protocolo, usar una porción de media cucharada cafetera de aceite de coco más 1 gota de Phyto Pain y aplicar en plantas de los pies. INGREDIENTES Lavandula Angustifolia, Eucalyptus Radiata, Gaultheria Procumbens, Boswellia Frereana. NO RECOMENDADO PARA MUJERES EMBARAZADAS.', 65.00, '[]'::jsonb, FALSE),
('phytotherapi-migraine', 'Phytotherapi Migraine', 'ELIMINA EL DOLOR Phytotherapi MIGRAINE INDICACIONES Ayuda a eliminar dolores de cabeza y migrañas. Phyto Migraine también oxigena el cerebro y reduce la inflamación de los vasos sanguíneos. DOSIS Coloque 1 gota de Phyto migraña en la palma de la mano. Con el dedo índice, aplique sobre la frente, la nuca y la parte posterior de la cabeza donde se encuentra la base del cerebro. Luego, junte las manos llevando hacia la nariz, para inhalar, realizando respiraciones profundas del aceite Phyto Migraine. Aplicar 1-2 veces por día. Niños menores de 8 años y embarazadas aplicar solo en planta de pies. INGREDIENTES Mezcla para dolor especializado, Mentha Piperita, Rosmarinus officinalis, Lavandula, Anthemis Nobilis y Boswellia Frereana. RECOMENDADO PARA MUJERES EMBARAZADAS.', 65.00, '[]'::jsonb, FALSE),
('self-regulator', 'Self Regulator', 'SALUD Y BIENESTAR Self Regulator INDICACIONES La combinación de esta fórmula natural promueve la claridad mental, el estado de ánimo saludable, el corazón y vasos sanguíneos flexibles, aumenta la actividad del sistema inmunológico, reduce la inflamación, promueve un sistema digestivo y huesos saludables. DOSIS Tomar 6 gotas con un poco de agua natural o algunos de los líquidos permitidos. Cada 12 horas INGREDIENTES Vitamina D4, Vitamina K2 (MK4, MK7); CoQ10, ubiquinol, Zinc RECOMENDADO PARA MUJERES EMBARAZADAS.', 65.00, '[]'::jsonb, FALSE),
('pm-night', 'PM Night', 'EQUILIBRA TU DESCANSO PM NIGHT Proporciona nutrición y balance al sistema nervioso induciendo un estado de reposo físico y mental que facilite la relajación y/o el sueño profundo. INDICACIONES Contiene ácido y - aminobutírico (GABA); controla y disminuye alteración en el sistema simpático y parasimpático. DOSIS Tomar 1 a 2 cápsulas de PM night con agua natural, después de cenar, o bien 1 cápsula después del desayuno y cena. INGREDIENTES Vitamina B6, vitamina B12, magnesio, zinc, L-cisteína, L-carnitina, 5 hidroxi- triptófano, ácido y (GABA) APTO PARA EMBARAZADAS.', 65.00, '[]'::jsonb, FALSE),
('neuro-booster', 'Neuro Booster', 'POTENCIA TU MENTE Neuro BOOSTER Es un suplemento cerebral seguro y clínicamente probado que respalda el rendimiento cognitivo y la función mental. INDICACIONES Neuro booster produce refuerzo neurológico; ayuda a mantener niveles normales de cortisol. Mejora la respuesta del cuerpo a los factores estresantes físicos y mentales, al tiempo que aumenta el bienestar general, contine una gama completa de fitonutrientres que se encuentran naturalmente en sus componentes. Mejora la memoria y apoya la función cerebral, aumentando la energía, la vitalidad y la respuesta al estrés. Evita engrosamiento de placas cerebrales que ocasionan demencia con el paso del tiempo. DOSIS Tomar 1 cápsula de Neuro booster después del desayuno y 1 cápsula con la comida. Grado de afectación: Tomar desde 1 cápsula de Neuro booster cada 24 horas, hasta 2 cápsulas cada 2 horas. NOTA: Para continuar con el protocolo, puede indicar 1 cápsula Neuro booster cada 24 horas INGREDIENTES Espectro completo de ashwaganda 1000mg, L-tirosina 500 mg, semilla de achicoria, raiz de alcaparra. APTO PARA EMBARAZADAS.', 65.00, '[]'::jsonb, FALSE),
('skin-protector', 'Skin Protector', 'PROTEGE TU PIEL Skin Protector O SKIN PERFECT Fortalecer el nivel de PH de la piel, haciendo que de manera inmediata elimine el ardor, dolor y deje una sensación de suavidad. Eliminará bacterias y hongos y permitirá una regeneración de los tejidos logrando una recuperación pronta. INDICACIONES Recomendado en caso de: piel seca, agrietada, dañada, quemada, erupciones en piel, hongos, dermatitis, infecciones en la piel, psoriasis, resequedad de piel, DOSIS Agitar antes de usar, aplicar skin protector suavemente directo sobre la piel dañada, dejar secar 30 segundos. Aplicar mañana, tarde y noche. No aplicar en ojos, cavidades corporales o heridas abiertas. En caso de contacto lavar con abundante agua limpia. INGREDIENTES Pulpa de aloe vera, leche, miel, cocamida, ácido cítrico, HOCl D-Limonene, vaselina blanca, glicerina USP, dietinolamina, dietanolamina, trietanolamina, dodecilo de sodio, sulfato, colorante cochinilla. RECOMENDADO EN EMBARAZADAS.', 65.00, '[]'::jsonb, FALSE),
('neuro-pain-relief-crema', 'Neuro Pain Relief (Crema)', 'ALIVIA LA INFLAMACIÓN Neuro Pain RELIEF (CREMA) Para manejo del dolor e inflamación en enfermedades agudas o crónicas por medio del balance de la actividad del sistema nervioso INDICACIONES Recomendado en caso de: dolor, inflamación o contracción muscular, neuropatía diabética, afecciones autoinmunes, esguinces, torceduras, malestar o dolor articular, epilepsia o convulsiones, ansiedad, depresión, náuseas, vómito, parestesias (hormigueo) de alguna parte del cuerpo. DOSIS Solo uso tópico. Aplique Neuro pain Reliever crema según sea necesario para aliviar el dolor e inflación de los nervios y los músculos; aplique en el área afectada mañana, tarde y noche. En casos severo, aplicar con tanta frecuencia como sea necesario, desde una vez al día hasta cada hora. Se puede aplicar en piel a nivel de: Cabeza, cuello, tórax, abdomen, riñones y extremidades. •No aplicar en ojos, boca, nariz ni heridas abiertas •No ingerir. •Mantener fuera del alcance de los niños. INGREDIENTES Agua destilada purificada, manteca de karité, manteca de mango, aceite de cáñamo, aceite de oliva de lavanda, cera de abejas blanca, aislado de CBD de PCR derivado de cáñamo. RECOMENDADO EN EMBARAZADAS.', 65.00, '[]'::jsonb, FALSE),
('neuro-pain-relief-roll-on', 'Neuro Pain Relief (Roll-On)', 'VIVE SIN INFLAMACIÓN Neuro Pain RELIEF (ROLL-ON) Para manejo del dolor e inflamación en enfermedades agudas o crónicas por medio del balance de la actividad del sistema nervioso INDICACIONES Recomendado en caso de: dolor, inflamación o contracción muscular, neuropatía diabética, afecciones autoinmunes, esguinces, torceduras, malestar o dolor articular, epilepsia o convulsiones, ansiedad, depresión, náuseas, vómito, parestesias (hormigueo) de alguna parte del cuerpo. DOSIS Solo uso tópico. Aplique Neuro pain Reliever roll on según sea necesario para aliviar el dolor e inflación de los nervios y los músculos; aplique en el área afectada mañana, tarde y noche. En casos severo, aplicar con tanta frecuencia como sea necesario, desde una vez al día hasta cada hora. Se puede aplicar en piel a nivel de: Cabeza, cuello, tórax, abdomen, riñones y extremidades. •No aplicar en ojos, boca, nariz, genitales ni heridas abiertas •No ingerir. •Mantener fuera del alcance de los niños. INGREDIENTES Agua destilada purificada, manteca de karité, manteca de mango, aceite de cáñamo, aceite de oliva de lavanda, cera de abejas blanca, aislado de CBD de PCR derivado de cáñamo. RECOMENDADO EN EMBARAZADAS.', 65.00, '[]'::jsonb, FALSE)
ON CONFLICT (slug)
  DO NOTHING;
-- -------------------------------------------------------------
-- SECTION: Site mode configuration (legacy 04)
-- -------------------------------------------------------------
-- =============================================================
-- PūrVita Network - Site Mode Settings
-- Configuración para alternar entre modo Mantenimiento y Próximamente
-- =============================================================
-- -------------------------------------------------------------
-- SECTION: Centralised SEO settings
-- -------------------------------------------------------------
-- =============================================================
-- PūrVita Network - SEO configuration per page & locale
-- Mantiene metadatos coherentes para Google, redes sociales y apps móviles
-- =============================================================
CREATE TABLE IF NOT EXISTS public.seo_settings(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page text NOT NULL,
  locale text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  keywords text NOT NULL DEFAULT '',
  canonical_url text,
  robots_index boolean NOT NULL DEFAULT TRUE,
  robots_follow boolean NOT NULL DEFAULT TRUE,
  robots_advanced text,
  og_title text,
  og_description text,
  og_image text,
  twitter_title text,
  twitter_description text,
  twitter_image text,
  json_ld text,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW(),
  CONSTRAINT seo_settings_page_locale_key UNIQUE (page, locale)
);
ALTER TABLE public.seo_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "seo_settings_public_select" ON public.seo_settings;
CREATE POLICY "seo_settings_public_select" ON public.seo_settings
  FOR SELECT
    USING (TRUE);
DROP POLICY IF EXISTS "seo_settings_admin_manage" ON public.seo_settings;
CREATE POLICY "seo_settings_admin_manage" ON public.seo_settings
  FOR ALL
    USING (auth.role() = 'service_role' OR public.is_super_admin(auth.uid()))
    WITH CHECK (auth.role() = 'service_role' OR public.is_super_admin(auth.uid()));
INSERT INTO public.seo_settings(page, locale, title, description, keywords)
  VALUES ('global', 'en', 'PūrVita Network', 'Your lifestyle partner for wellness, classes and product subscriptions.', 'purvita, wellness, subscriptions, lifestyle'),
('global', 'es', 'PūrVita Network', 'Tu aliado en bienestar, clases exclusivas y suscripciones saludables.', 'purvita, bienestar, suscripciones, estilo de vida')
ON CONFLICT (page, locale)
  DO NOTHING;
-- Create trigger for seo_settings updated_at
DROP TRIGGER IF EXISTS on_seo_settings_updated ON public.seo_settings;
CREATE TRIGGER on_seo_settings_updated
  BEFORE UPDATE ON public.seo_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
-- -------------------------------------------------------------
-- SECTION: Footer branding migration (legacy 05)
-- -------------------------------------------------------------
-- =============================================================
-- PūrVita Network - Footer Branding Migration
-- Run these statements in Supabase SQL editor to backfill the new
-- footer branding controls introduced in the admin site-content UI.
-- =============================================================
-- 1. Ensure footer JSON objects exist and include the new branding keys
UPDATE
  landing_page_content AS l
SET
  footer = jsonb_set(jsonb_set(jsonb_set(jsonb_set(COALESCE(l.footer, '{}'::jsonb), '{showBrandingLogo}', to_jsonb(COALESCE((l.footer ->> 'showBrandingLogo')::boolean, TRUE)), TRUE), '{showBrandingAppName}', to_jsonb(COALESCE((l.footer ->> 'showBrandingAppName')::boolean, TRUE)), TRUE), '{showBrandingDescription}', to_jsonb(COALESCE((l.footer ->> 'showBrandingDescription')::boolean, TRUE)), TRUE), '{brandingOrientation}', to_jsonb(COALESCE(NULLIF(l.footer ->> 'brandingOrientation', ''), 'beside')), TRUE)
WHERE
  TRUE;
-- 2. Populate the footer.brandingAppName with the global app name when missing
WITH branding_defaults AS (
  SELECT
    app_name
  FROM
    site_branding_settings
  WHERE
    id = 'global')
UPDATE
  landing_page_content AS l
SET
  footer = jsonb_set(COALESCE(l.footer, '{}'::jsonb), '{brandingAppName}', to_jsonb(COALESCE(NULLIF(l.footer ->> 'brandingAppName', ''),(
          SELECT
            app_name
          FROM branding_defaults))), TRUE)
WHERE
  TRUE;
-- After running these updates you can verify the data with the helper query suite in docs/database/verification-suite.sql.
-- -------------------------------------------------------------
-- SECTION: Contact recipient defaults (legacy 06)
-- -------------------------------------------------------------
-- =============================================================
-- PūrVita Network - Contact Recipient Migration
-- Run these statements in Supabase SQL editor to backfill the
-- configurable recipient email for the landing page contact form.
-- =============================================================
-- 1. Ensure the contact JSON blob exists
UPDATE
  landing_page_content AS l
SET
  contact = COALESCE(l.contact, '{}'::jsonb)
WHERE
  l.contact IS NULL;
-- 2. Populate contact.recipientEmail using existing values or the app name fallback
WITH branding_defaults AS (
  SELECT
    app_name,
    NULLIF(regexp_replace(lower(app_name), '[^a-z0-9]+', '', 'g'), '') AS sanitized_app_name FROM site_branding_settings
      WHERE
        id = 'global')
    UPDATE
      landing_page_content AS l
    SET
      contact = jsonb_set(COALESCE(l.contact, '{}'::jsonb), '{recipientEmail}', to_jsonb(COALESCE(NULLIF(l.contact ->> 'recipientEmail', ''), NULLIF (l.contact -> 'contactInfo' ->> 'email', ''), CASE WHEN (
              SELECT
                sanitized_app_name
              FROM branding_defaults) IS NOT NULL THEN
              format('contact@%s.com',(
                  SELECT
                    sanitized_app_name
                  FROM branding_defaults))
            ELSE
              'contact@purvita.com'
            END)), TRUE)
    WHERE
      TRUE;
-- After running these updates you can verify the data with the helper query suite in docs/database/verification-suite.sql.
-- -------------------------------------------------------------
-- SECTION: Contact settings tables (legacy 07)
-- -------------------------------------------------------------
-- 07-contact-settings.sql
--
-- Purpose: Provision the contact configuration tables so the admin UI can manage
--          sender details, routing overrides, and keep an audit log of form submissions.
--
-- Prerequisites:
--   - Run scripts 01 through 06 first. The `landing_page_content` table must exist.
--   - Ensure the `pgcrypto` extension is available for UUID generation.
-- 1. Safety: enable pgcrypto for gen_random_uuid if it is not already available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- 2. Contact settings table (single row keyed by "global")
-- ===========================================
-- APP SETTINGS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.app_settings(
  id text PRIMARY KEY DEFAULT 'global',
  base_commission_rate numeric(5, 4) NOT NULL DEFAULT 0.10,
  referral_bonus_rate numeric(5, 4) NOT NULL DEFAULT 0.05,
  leadership_pool_rate numeric(5, 4) NOT NULL DEFAULT 0.02,
  max_members_per_level jsonb NOT NULL DEFAULT '[]' ::jsonb,
  payout_frequency text NOT NULL DEFAULT 'monthly' CHECK (payout_frequency IN ('weekly', 'biweekly', 'monthly')),
  currency text NOT NULL DEFAULT 'USD',
  currencies jsonb NOT NULL DEFAULT '[]' ::jsonb,
  ecommerce_commission_rate numeric(5, 4) NOT NULL DEFAULT 0.08,
  auto_advance_enabled boolean NOT NULL DEFAULT TRUE,
  team_levels_visible integer NOT NULL DEFAULT 2 CHECK (team_levels_visible BETWEEN 1 AND 10),
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);
COMMENT ON TABLE public.app_settings IS 'Global configuration for the multi-level compensation engine.';
INSERT INTO public.app_settings AS aps(id, base_commission_rate, referral_bonus_rate, leadership_pool_rate, max_members_per_level, payout_frequency, currency, currencies, ecommerce_commission_rate, auto_advance_enabled, team_levels_visible)
  VALUES ('global', 0.10, 0.05, 0.02, '[{"level":1,"max_members":5},{"level":2,"max_members":25},{"level":3,"max_members":125},{"level":4,"max_members":625},{"level":5,"max_members":3125}]'::jsonb, 'monthly', 'USD', '[{"code":"USD","countryCodes":[]}]'::jsonb, 0.08, TRUE, 2)
ON CONFLICT (id)
  DO NOTHING;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_settings_service_role" ON public.app_settings;
CREATE POLICY "app_settings_service_role" ON public.app_settings
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
DROP TRIGGER IF EXISTS on_app_settings_updated ON public.app_settings;
CREATE TRIGGER on_app_settings_updated
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
CREATE TABLE IF NOT EXISTS public.contact_settings(
  id text PRIMARY KEY DEFAULT 'global',
  from_name text NOT NULL,
  from_email text NOT NULL,
  reply_to_email text,
  recipient_email_override text,
  cc_emails text[] NOT NULL DEFAULT '{}',
  bcc_emails text[] NOT NULL DEFAULT '{}',
  subject_prefix text,
  auto_response_enabled boolean NOT NULL DEFAULT FALSE,
  auto_response_subject text,
  auto_response_body text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.contact_settings IS 'Admin-configurable sender identity and routing options for the public contact form.';
-- Seed or refresh the global row with sensible defaults.
-- The service layer will override `from_email` with environment variables when present.
INSERT INTO public.contact_settings AS cs(id, from_name, from_email, reply_to_email, recipient_email_override, cc_emails, bcc_emails, subject_prefix, auto_response_enabled, auto_response_subject, auto_response_body, created_at, updated_at)
SELECT
  'global',
  'Landing Contact',
  coalesce((
    SELECT
      contact -> 'contactInfo' ->> 'email'
    FROM public.landing_page_content
    WHERE
      contact ->> 'contactInfo' IS NOT NULL ORDER BY updated_at DESC nulls LAST LIMIT 1), 'contact@example.com') AS from_email,
  NULL::text AS reply_to_email,
  NULL::text AS recipient_email_override,
  '{}'::text[] AS cc_emails,
  '{}'::text[] AS bcc_emails,
  '[Contact]'::text AS subject_prefix,
  FALSE,
  NULL::text,
  NULL::text,
  now(),
  now()
ON CONFLICT (id)
  DO UPDATE SET
    updated_at = now()
  WHERE
    cs.id = 'global';
-- 3. Message log table to capture each submission attempt
CREATE TABLE IF NOT EXISTS public.contact_messages(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  locale text NOT NULL,
  name text NOT NULL,
  email text NOT NULL,
  message text NOT NULL,
  recipient_email text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error_message text
);
COMMENT ON TABLE public.contact_messages IS 'Immutable log of inbound contact form submissions.';
COMMENT ON COLUMN public.contact_messages.status IS 'sent|failed indicator to correlate with email provider responses.';
-- Helpful indexes for chronological review and failure triage
CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx ON public.contact_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS contact_messages_status_idx ON public.contact_messages(status);
-- 4. Optional: grant read access to service role only (RLS can be added later if needed)
-- For now the admin API uses the service role client, so we keep default privileges.
-- Verification snippet (run separately after executing this script):
--   select * from contact_settings;
--   select id, created_at, status from contact_messages order by created_at desc limit 5;
-- -------------------------------------------------------------
-- SECTION: Product inventory metrics (legacy 08)
-- -------------------------------------------------------------
-- Adds inventory tracking metadata for products so the admin dashboard can surface stock metrics.
-- Run this script after the base schema (01-03) and before seeding new data.
-- 1. Ensure the stock_quantity column exists on products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_quantity integer NOT NULL DEFAULT 0;
-- 2. Backfill null values just in case the column already existed without defaults
UPDATE
  public.products
SET
  stock_quantity = 0
WHERE
  stock_quantity IS NULL;
-- 3. Provide a helper view for quick stock summaries (optional, but useful for debugging)
CREATE OR REPLACE VIEW public.product_stock_overview AS
SELECT
  id,
  name,
  COALESCE(stock_quantity, 0) AS stock_quantity,
  updated_at
FROM
  public.products
ORDER BY
  name;
-- 4. Verify results
SELECT
  COUNT(*) AS product_count,
  SUM(stock_quantity) AS total_units
FROM
  public.products;
-- -------------------------------------------------------------
-- SECTION: Product cart visibility (20250418)
-- -------------------------------------------------------------
-- Ensure each product stores the list of ISO country codes where cart actions are available.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cart_visibility_countries TEXT[] DEFAULT '{}'::text[];
-- Backfill any null entries from previous deployments.
UPDATE
  public.products
SET
  cart_visibility_countries = '{}'
WHERE
  cart_visibility_countries IS NULL;
-- Enforce not-null semantics for simpler parsing in the application layer.
ALTER TABLE public.products
  ALTER COLUMN cart_visibility_countries SET NOT NULL;
-- Speed up lookups when checking if a country is eligible for purchases.
CREATE INDEX IF NOT EXISTS idx_products_cart_visibility_countries ON public.products USING GIN(cart_visibility_countries);
-- -------------------------------------------------------------
-- SECTION: Checkout preferences (legacy 09)
-- -------------------------------------------------------------
-- =============================================================
-- Checkout profile enhancements
-- Adds shipping/postal details and a default payment provider to profiles
-- Execute after `08-product-inventory-update.sql`
-- =============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS default_payment_provider TEXT;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_default_payment_provider_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_default_payment_provider_check CHECK (default_payment_provider IS NULL OR default_payment_provider IN ('paypal', 'stripe', 'wallet'));
-- -------------------------------------------------------------
-- SECTION: Product experience content (legacy 10)
-- -------------------------------------------------------------
-- =============================================================
-- PūrVita Network - Product Experience Content Migration
-- Adds the JSONB column required to store curated product storytelling
-- and review metadata controlled from the admin panel.
-- =============================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS experience jsonb DEFAULT '{}'::jsonb;
UPDATE
  public.products
SET
  experience = '{}'::jsonb
WHERE
  experience IS NULL;
-- -------------------------------------------------------------
-- SECTION: Product stock overview view (security fix)
-- -------------------------------------------------------------
-- =============================================================
-- Fix product_stock_overview view security
-- Changes from SECURITY DEFINER to SECURITY INVOKER for safety
-- =============================================================
DROP VIEW IF EXISTS public.product_stock_overview;
CREATE OR REPLACE VIEW public.product_stock_overview WITH ( security_invoker = TRUE
) AS
SELECT
  id,
  name,
  COALESCE(
    stock_quantity, 0
) AS stock_quantity,
  updated_at
FROM
  public.products
ORDER BY
  name;
COMMENT ON VIEW public.product_stock_overview IS 'Simplified view of product stock levels. Uses SECURITY INVOKER for safety.';
-- -------------------------------------------------------------
-- SECTION: Site Mode Settings (Site Status Management)
-- -------------------------------------------------------------
-- =============================================================
-- PūrVita Network - Site Mode Settings Table
-- Manages site visibility modes (maintenance, coming_soon)
-- with SEO metadata, appearance settings, and integrations
-- =============================================================
CREATE TABLE IF NOT EXISTS public.site_mode_settings(
  mode text PRIMARY KEY CHECK (mode IN ('maintenance', 'coming_soon')),
  meta_title jsonb DEFAULT '{"en": "", "es": ""}'::jsonb,
  meta_description jsonb DEFAULT '{"en": "", "es": ""}'::jsonb,
  meta_keywords text,
  og_title text,
  og_description text,
  og_image text,
  twitter_title text,
  twitter_description text,
  twitter_image text,
  is_active boolean DEFAULT FALSE,
  background_image_url text,
  background_overlay_opacity integer DEFAULT 90 CHECK (background_overlay_opacity >= 0 AND background_overlay_opacity <= 100),
  social_links jsonb DEFAULT '[]' ::jsonb,
  mailchimp_enabled boolean NOT NULL DEFAULT FALSE,
  mailchimp_audience_id text,
  mailchimp_server_prefix text,
  coming_soon_settings jsonb DEFAULT '{"headline": null, "subheadline": null, "countdown": {"isEnabled": false, "style": "date", "label": null, "numericValue": null, "targetDate": null}, "branding": {"logoUrl": null, "backgroundMode": "gradient", "backgroundImageUrl": null, "backgroundGradientColors": ["#9fc4ff", "#d3b4ff"]}}' ::jsonb,
  updated_at timestamptz DEFAULT NOW()
);
-- Add comments to document columns
COMMENT ON COLUMN public.site_mode_settings.meta_title IS 'Multilingual meta title stored as JSONB with language codes as keys (e.g., {"en": "Title", "es": "Título"})';
COMMENT ON COLUMN public.site_mode_settings.meta_description IS 'Multilingual meta description stored as JSONB with language codes as keys (e.g., {"en": "Description", "es": "Descripción"})';
COMMENT ON COLUMN public.site_mode_settings.mailchimp_enabled IS 'Controls whether Mailchimp integration is active for this site mode';
COMMENT ON COLUMN public.site_mode_settings.coming_soon_settings IS 'JSON payload for the coming soon experience (copy, countdown, and dedicated branding like logo or gradients).';
-- Enable RLS and create policies
ALTER TABLE public.site_mode_settings ENABLE ROW LEVEL SECURITY;
-- Public can read active site mode settings
DROP POLICY IF EXISTS "site_mode_settings_public_read" ON public.site_mode_settings;
CREATE POLICY "site_mode_settings_public_read" ON public.site_mode_settings
  FOR SELECT
    USING (is_active = TRUE);
-- Service role can manage all site mode settings
DROP POLICY IF EXISTS "site_mode_settings_service_role" ON public.site_mode_settings;
CREATE POLICY "site_mode_settings_service_role" ON public.site_mode_settings
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
-- Create trigger for updated_at
DROP TRIGGER IF EXISTS on_site_mode_settings_updated ON public.site_mode_settings;
CREATE TRIGGER on_site_mode_settings_updated
  BEFORE UPDATE ON public.site_mode_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
-- Insert default records for each mode
INSERT INTO public.site_mode_settings(mode, meta_title, meta_description, meta_keywords, is_active, mailchimp_enabled, coming_soon_settings)
  VALUES ('maintenance', '{"en": "Site under maintenance", "es": "Sitio en mantenimiento"}'::jsonb, '{"en": "We are currently performing scheduled maintenance. Please check back shortly.", "es": "Actualmente estamos realizando mantenimiento programado. Por favor, vuelve pronto."}'::jsonb, '', FALSE, FALSE, '{}'::jsonb),
('coming_soon', '{"en": "", "es": "Nosotros estamos lanzando pronto"}'::jsonb, '{"en": "", "es": "Una nueva experiencia está en camino. Mantente al tanto de las novedades."}'::jsonb, '', FALSE, FALSE, '{"headline": null, "subheadline": null, "countdown": {"isEnabled": false, "style": "date", "label": null, "numericValue": null, "targetDate": null}, "branding": {"logoUrl": null, "backgroundMode": "gradient", "backgroundImageUrl": null, "backgroundGradientColors": ["#9fc4ff", "#d3b4ff"]}}'::jsonb)
ON CONFLICT (mode)
  DO NOTHING;
-- ===========================================
-- 98. ADVERTISING SCRIPTS TABLE
-- ===========================================
-- Stores advertising and tracking scripts for the main website
-- These scripts are injected ONLY in the main public pages,
-- NOT in affiliate personalized pages
CREATE TABLE IF NOT EXISTS public.advertising_scripts (
  id TEXT PRIMARY KEY DEFAULT 'global',

  -- Facebook Pixel
  facebook_pixel_enabled BOOLEAN NOT NULL DEFAULT false,
  facebook_pixel_id TEXT,
  facebook_pixel_script TEXT,

  -- TikTok Pixel
  tiktok_pixel_enabled BOOLEAN NOT NULL DEFAULT false,
  tiktok_pixel_id TEXT,
  tiktok_pixel_script TEXT,

  -- Google Tag Manager
  gtm_enabled BOOLEAN NOT NULL DEFAULT false,
  gtm_container_id TEXT,
  gtm_script TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.advertising_scripts IS 'Stores advertising and tracking scripts for the main website (NOT for affiliate pages)';
COMMENT ON COLUMN public.advertising_scripts.facebook_pixel_enabled IS 'Enable/disable Facebook Pixel tracking';
COMMENT ON COLUMN public.advertising_scripts.facebook_pixel_id IS 'Facebook Pixel ID (e.g., 1234567890)';
COMMENT ON COLUMN public.advertising_scripts.facebook_pixel_script IS 'Complete Facebook Pixel script code';
COMMENT ON COLUMN public.advertising_scripts.tiktok_pixel_enabled IS 'Enable/disable TikTok Pixel tracking';
COMMENT ON COLUMN public.advertising_scripts.tiktok_pixel_id IS 'TikTok Pixel ID';
COMMENT ON COLUMN public.advertising_scripts.tiktok_pixel_script IS 'Complete TikTok Pixel script code';
COMMENT ON COLUMN public.advertising_scripts.gtm_enabled IS 'Enable/disable Google Tag Manager';
COMMENT ON COLUMN public.advertising_scripts.gtm_container_id IS 'GTM Container ID (e.g., GTM-XXXXXX)';
COMMENT ON COLUMN public.advertising_scripts.gtm_script IS 'Complete Google Tag Manager script code';

-- Insert default row
INSERT INTO public.advertising_scripts (id)
VALUES ('global')
ON CONFLICT (id) DO NOTHING;

-- RLS Policies
ALTER TABLE public.advertising_scripts ENABLE ROW LEVEL SECURITY;

-- Only admins can read advertising scripts
DROP POLICY IF EXISTS "advertising_scripts_select_policy" ON public.advertising_scripts;
CREATE POLICY "advertising_scripts_select_policy" ON public.advertising_scripts
  FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- Only admins can update advertising scripts
DROP POLICY IF EXISTS "advertising_scripts_update_policy" ON public.advertising_scripts;
CREATE POLICY "advertising_scripts_update_policy" ON public.advertising_scripts
  FOR UPDATE
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_advertising_scripts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS advertising_scripts_updated_at_trigger ON public.advertising_scripts;
CREATE TRIGGER advertising_scripts_updated_at_trigger
  BEFORE UPDATE ON public.advertising_scripts
  FOR EACH ROW
  EXECUTE FUNCTION update_advertising_scripts_updated_at();

-- ===========================================
-- 98a. ANALYTICS MODULE
-- ===========================================
-- Analytics Events Table - Stores raw analytics events for comprehensive tracking
CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event details
  event_type VARCHAR(50) NOT NULL,
  event_name VARCHAR(100),

  -- User context
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id VARCHAR(255) NOT NULL,

  -- Event parameters (JSONB for flexible schema)
  params JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Technical context
  user_agent TEXT,
  ip_address INET,
  referrer TEXT,

  -- Timestamp
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraint for valid event types
  CONSTRAINT valid_event_type CHECK (
    event_type IN (
      'pageview', 'product_view', 'add_to_cart', 'remove_from_cart',
      'begin_checkout', 'add_payment_info', 'purchase', 'search',
      'view_cart', 'view_item_list', 'select_item', 'user_signup',
      'user_login', 'share', 'custom'
    )
  )
);

-- Indexes for analytics_events
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON public.analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON public.analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON public.analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON public.analytics_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events(created_at DESC);

-- GIN index for JSONB params
CREATE INDEX IF NOT EXISTS idx_analytics_events_params ON public.analytics_events USING GIN (params);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_timestamp
  ON public.analytics_events(event_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_timestamp
  ON public.analytics_events(user_id, timestamp DESC) WHERE user_id IS NOT NULL;

-- Analytics Configuration Table - Stores user-specific analytics settings
CREATE TABLE IF NOT EXISTS public.analytics_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Feature flags
  analytics_enabled BOOLEAN NOT NULL DEFAULT true,
  advanced_analytics_enabled BOOLEAN NOT NULL DEFAULT false,

  -- Privacy settings
  tracking_consent BOOLEAN NOT NULL DEFAULT false,
  anonymize_ip BOOLEAN NOT NULL DEFAULT true,
  data_retention_days INTEGER NOT NULL DEFAULT 90 CHECK (data_retention_days >= 30 AND data_retention_days <= 730),

  -- Notification settings
  weekly_report_enabled BOOLEAN NOT NULL DEFAULT false,
  monthly_report_enabled BOOLEAN NOT NULL DEFAULT false,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for analytics_config
CREATE INDEX IF NOT EXISTS idx_analytics_config_user_id ON public.analytics_config(user_id);

-- Enable RLS on analytics tables
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_config ENABLE ROW LEVEL SECURITY;

-- Analytics Events Policies
-- Users can view their own events
DROP POLICY IF EXISTS "analytics_events_users_view_own" ON public.analytics_events;
CREATE POLICY "analytics_events_users_view_own"
  ON public.analytics_events FOR SELECT
  USING (
    auth.uid() = user_id OR
    public.is_super_admin(auth.uid())
  );

-- Users can insert their own events
DROP POLICY IF EXISTS "analytics_events_users_insert_own" ON public.analytics_events;
CREATE POLICY "analytics_events_users_insert_own"
  ON public.analytics_events FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR user_id IS NULL
  );

-- Admins can view all events
DROP POLICY IF EXISTS "analytics_events_admins_view_all" ON public.analytics_events;
CREATE POLICY "analytics_events_admins_view_all"
  ON public.analytics_events FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- Analytics Config Policies
-- Users can view their own config
DROP POLICY IF EXISTS "analytics_config_users_view_own" ON public.analytics_config;
CREATE POLICY "analytics_config_users_view_own"
  ON public.analytics_config FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own config
DROP POLICY IF EXISTS "analytics_config_users_insert_own" ON public.analytics_config;
CREATE POLICY "analytics_config_users_insert_own"
  ON public.analytics_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own config
DROP POLICY IF EXISTS "analytics_config_users_update_own" ON public.analytics_config;
CREATE POLICY "analytics_config_users_update_own"
  ON public.analytics_config FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all configs
DROP POLICY IF EXISTS "analytics_config_admins_view_all" ON public.analytics_config;
CREATE POLICY "analytics_config_admins_view_all"
  ON public.analytics_config FOR SELECT
  USING (public.is_super_admin(auth.uid()));

-- Function to update analytics_config updated_at timestamp
CREATE OR REPLACE FUNCTION update_analytics_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for analytics_config updated_at
DROP TRIGGER IF EXISTS trigger_update_analytics_config_updated_at ON public.analytics_config;
CREATE TRIGGER trigger_update_analytics_config_updated_at
  BEFORE UPDATE ON public.analytics_config
  FOR EACH ROW
  EXECUTE FUNCTION update_analytics_config_updated_at();

-- Function to automatically create analytics config for new users
CREATE OR REPLACE FUNCTION create_default_analytics_config()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.analytics_config (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create analytics config for new users
DROP TRIGGER IF EXISTS trigger_create_analytics_config ON public.profiles;
CREATE TRIGGER trigger_create_analytics_config
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_analytics_config();

-- View: Daily metrics aggregation
DROP VIEW IF EXISTS public.analytics_daily_metrics;
CREATE VIEW public.analytics_daily_metrics AS
SELECT
  DATE(timestamp) as date,
  user_id,
  COUNT(*) as total_events,
  COUNT(DISTINCT session_id) as sessions,
  COUNT(CASE WHEN event_type = 'pageview' THEN 1 END) as pageviews,
  COUNT(CASE WHEN event_type = 'product_view' THEN 1 END) as product_views,
  COUNT(CASE WHEN event_type = 'add_to_cart' THEN 1 END) as add_to_carts,
  COUNT(CASE WHEN event_type = 'purchase' THEN 1 END) as purchases,
  SUM(CASE
    WHEN event_type = 'purchase'
    THEN COALESCE((params->>'value')::numeric, 0)
    ELSE 0
  END) as revenue
FROM public.analytics_events
WHERE timestamp >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY DATE(timestamp), user_id;

-- Function to clean old analytics events based on user retention settings
CREATE OR REPLACE FUNCTION cleanup_old_analytics_events()
RETURNS void AS $$
BEGIN
  DELETE FROM public.analytics_events
  WHERE created_at < NOW() - INTERVAL '90 days'
  AND (
    user_id IS NULL
    OR user_id IN (
      SELECT user_id FROM public.analytics_config
      WHERE created_at + (data_retention_days || ' days')::INTERVAL < NOW()
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to authenticated users
GRANT SELECT, INSERT ON public.analytics_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.analytics_config TO authenticated;
GRANT SELECT ON public.analytics_daily_metrics TO authenticated;

-- ===========================================
-- 99. REGISTRATION ACCESS CODES (Weekly onboarding gate)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.registration_access_codes(
  id bigserial PRIMARY KEY,
  code text NOT NULL,
  valid_from timestamptz NOT NULL,
  valid_to timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.registration_access_codes IS 'Weekly rotating code used to authorize self-service registrations.';
COMMENT ON COLUMN public.registration_access_codes.code IS 'Human friendly access code generated by Supabase Edge function.';
COMMENT ON COLUMN public.registration_access_codes.valid_from IS 'Timestamp (UTC) marking the beginning of the code window.';
COMMENT ON COLUMN public.registration_access_codes.valid_to IS 'Timestamp (UTC) marking the expiration of the code window.';
ALTER TABLE public.registration_access_codes ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX IF NOT EXISTS registration_access_codes_valid_from_key ON public.registration_access_codes(valid_from);
CREATE INDEX IF NOT EXISTS registration_access_codes_window_idx ON public.registration_access_codes(valid_from DESC, valid_to DESC);
-- ===========================================
-- 100. INITIALIZE TEAM COUNTS
-- ===========================================
-- Initialize team_count for all existing users
-- This counts how many users have each user as their sponsor
UPDATE
  public.profiles p
SET
  team_count =(
    SELECT
      COUNT(*)
    FROM
      public.profiles ref
    WHERE
      ref.referred_by = p.id)
WHERE
  team_count = 0
  OR team_count IS NULL;
-- ===========================================
-- PHASE REWARDS SYSTEM
-- ===========================================
-- Tracks monthly rewards earned by users for maintaining their phase
CREATE TABLE IF NOT EXISTS public.phase_rewards(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month_year text NOT NULL,
  phase integer NOT NULL CHECK (phase BETWEEN 1 AND 3),
  free_product_granted boolean NOT NULL DEFAULT FALSE,
  free_product_used boolean NOT NULL DEFAULT FALSE,
  free_product_used_at timestamptz,
  free_product_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  credit_cents bigint NOT NULL DEFAULT 0 CHECK (credit_cents >= 0),
  credit_used_cents bigint NOT NULL DEFAULT 0 CHECK (credit_used_cents >= 0),
  credit_remaining_cents bigint GENERATED ALWAYS AS (credit_cents - credit_used_cents) STORED,
  granted_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT phase_rewards_credit_valid CHECK (credit_used_cents <= credit_cents),
  CONSTRAINT phase_rewards_unique_month UNIQUE (user_id, month_year)
);
CREATE INDEX IF NOT EXISTS idx_phase_rewards_user_month ON public.phase_rewards(user_id, month_year DESC);
CREATE INDEX IF NOT EXISTS idx_phase_rewards_expires ON public.phase_rewards(expires_at)
WHERE
  expires_at IS NOT NULL;
ALTER TABLE public.phase_rewards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "phase_rewards_read_self" ON public.phase_rewards;
CREATE POLICY "phase_rewards_read_self" ON public.phase_rewards
  FOR SELECT
    USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "phase_rewards_service_role" ON public.phase_rewards;
CREATE POLICY "phase_rewards_service_role" ON public.phase_rewards
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
-- Helper function to get current month in YYYY-MM format
CREATE OR REPLACE FUNCTION public.get_current_month()
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  AS $$
  SELECT
    to_char(timezone('utc', now()), 'YYYY-MM');
$$;
-- Helper function to get end of month
CREATE OR REPLACE FUNCTION public.get_end_of_month(month_year text)
  RETURNS timestamptz
  LANGUAGE plpgsql
  IMMUTABLE
  AS $$
DECLARE
  year integer;
  month integer;
BEGIN
  year := CAST(split_part(month_year, '-', 1) AS INTEGER);
  month := CAST(split_part(month_year, '-', 2) AS INTEGER);
  RETURN (DATE_TRUNC('month', make_date(year, month, 1)) + INTERVAL '1 month' - INTERVAL '1 second')::timestamptz;
END;
$$;
-- Function to grant monthly phase rewards
CREATE OR REPLACE FUNCTION public.grant_phase_reward(p_user_id uuid, p_phase integer)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
DECLARE
  v_month_year text;
  v_expires_at timestamptz;
  v_reward_id uuid;
  v_existing_id uuid;
  v_existing_phase integer;
  v_target_phase integer;
  v_config_credit bigint;
  v_config_free_product_cents bigint;
  v_has_free_product boolean;
  v_reward_credit bigint;
BEGIN
  v_month_year := public.get_current_month();
  v_expires_at := public.get_end_of_month(v_month_year);
  SELECT
    id,
    phase INTO v_existing_id,
    v_existing_phase
  FROM
    public.phase_rewards
  WHERE
    user_id = p_user_id
    AND month_year = v_month_year
  LIMIT 1;
  v_target_phase := GREATEST(COALESCE(v_existing_phase, p_phase), p_phase);
  SELECT
    pl.credit_cents,
    COALESCE(pl.free_product_value_cents, CASE WHEN pl.level = 1 THEN
        6500
      ELSE
        0
      END) INTO v_config_credit,
    v_config_free_product_cents
  FROM
    public.phase_levels pl
  WHERE
    pl.level = v_target_phase
    AND pl.is_active = TRUE
  ORDER BY
    pl.display_order
  LIMIT 1;
  IF v_config_credit IS NULL THEN
    v_config_credit := CASE WHEN v_target_phase = 2 THEN
      12500
    WHEN v_target_phase = 3 THEN
      24000
    ELSE
      0
    END;
  END IF;
  IF v_config_free_product_cents IS NULL THEN
    v_config_free_product_cents := CASE WHEN v_target_phase = 1 THEN
      6500
    ELSE
      0
    END;
  END IF;
  v_has_free_product := v_config_free_product_cents > 0;
  v_reward_credit := CASE WHEN v_target_phase >= 2 THEN
    v_config_credit
  ELSE
    0
  END;
  IF v_existing_id IS NOT NULL THEN
    UPDATE
      public.phase_rewards
    SET
      phase = v_target_phase,
      credit_cents = v_reward_credit,
      credit_used_cents = CASE WHEN v_target_phase >= 2 THEN
        LEAST(credit_used_cents, v_reward_credit)
      ELSE
        0
      END,
      free_product_granted = v_has_free_product,
      updated_at = timezone('utc', now()),
      expires_at = v_expires_at
    WHERE
      id = v_existing_id;
    RETURN v_existing_id;
  END IF;
  INSERT INTO public.phase_rewards(user_id, month_year, phase, free_product_granted, credit_cents, expires_at)
    VALUES (p_user_id, v_month_year, v_target_phase, v_has_free_product, v_reward_credit, v_expires_at)
  RETURNING
    id INTO v_reward_id;
  RETURN v_reward_id;
END;
$$;
-- Function to get active rewards for a user
CREATE OR REPLACE FUNCTION public.get_active_phase_rewards(p_user_id uuid)
  RETURNS TABLE(
    reward_id uuid,
    phase integer,
    has_free_product boolean,
    free_product_used boolean,
    credit_total_cents bigint,
    credit_remaining_cents bigint,
    expires_at timestamptz)
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
BEGIN
  RETURN QUERY
  SELECT
    pr.id,
    pr.phase,
(pr.free_product_granted
      AND NOT pr.free_product_used) AS has_free_product,
    pr.free_product_used,
    pr.credit_cents AS credit_total_cents,
    pr.credit_remaining_cents,
    pr.expires_at
  FROM
    public.phase_rewards pr
  WHERE
    pr.user_id = p_user_id
    AND pr.month_year = public.get_current_month()
    AND(pr.expires_at IS NULL
      OR pr.expires_at > timezone('utc', now()));
END;
$$;
-- Function to use free product reward
CREATE OR REPLACE FUNCTION public.use_free_product_reward(p_user_id uuid, p_order_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
DECLARE
  v_reward_id uuid;
BEGIN
  SELECT
    id INTO v_reward_id
  FROM
    public.phase_rewards
  WHERE
    user_id = p_user_id
    AND month_year = public.get_current_month()
    AND free_product_granted = TRUE
    AND free_product_used = FALSE
    AND (expires_at IS NULL
      OR expires_at > timezone('utc', now()));
  IF v_reward_id IS NULL THEN
    RETURN FALSE;
  END IF;
  UPDATE
    public.phase_rewards
  SET
    free_product_used = TRUE,
    free_product_used_at = timezone('utc', now()),
    free_product_order_id = p_order_id,
    updated_at = timezone('utc', now())
  WHERE
    id = v_reward_id;
  RETURN TRUE;
END;
$$;
-- Function to use store credit
CREATE OR REPLACE FUNCTION public.use_store_credit(p_user_id uuid, p_amount_cents bigint)
  RETURNS bigint
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
DECLARE
  v_reward_id uuid;
  v_available_cents bigint;
  v_to_use_cents bigint;
BEGIN
  SELECT
    id,
    credit_remaining_cents INTO v_reward_id,
    v_available_cents
  FROM
    public.phase_rewards
  WHERE
    user_id = p_user_id
    AND month_year = public.get_current_month()
    AND credit_remaining_cents > 0
    AND (expires_at IS NULL
      OR expires_at > timezone('utc', now()))
  ORDER BY
    phase DESC
  LIMIT 1;
  IF v_reward_id IS NULL OR v_available_cents = 0 THEN
    RETURN 0;
  END IF;
  v_to_use_cents := LEAST(p_amount_cents, v_available_cents);
  UPDATE
    public.phase_rewards
  SET
    credit_used_cents = credit_used_cents + v_to_use_cents,
    updated_at = timezone('utc', now())
  WHERE
    id = v_reward_id;
  RETURN v_to_use_cents;
END;
$$;
-- Function to transfer phase rewards to network earnings
-- Only available for Phase 2 and Phase 3 users
CREATE OR REPLACE FUNCTION public.transfer_phase_rewards_to_earnings(p_user_id uuid)
  RETURNS TABLE(
    success boolean,
    transferred_cents integer,
    remaining_cents integer,
    error_message text)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
DECLARE
  v_reward_id uuid;
  v_phase integer;
  v_credit_remaining integer;
  v_credit_total integer;
  v_month_year text;
BEGIN
  -- Get current month
  v_month_year := public.get_current_month();
  -- Get active phase reward
  SELECT
    id,
    phase,
    credit_remaining_cents,
    credit_cents INTO v_reward_id,
    v_phase,
    v_credit_remaining,
    v_credit_total
  FROM
    public.phase_rewards
  WHERE
    user_id = p_user_id
    AND month_year = v_month_year
  LIMIT 1;
  -- Check if reward exists
  IF v_reward_id IS NULL THEN
    RETURN QUERY
    SELECT
      FALSE,
      0,
      0,
      'No active rewards found for this month'::text;
    RETURN;
  END IF;
  -- Validate phase (only Phase 2 and 3)
  IF v_phase < 2 OR v_phase > 3 THEN
    RETURN QUERY
    SELECT
      FALSE,
      0,
      v_credit_remaining,
      'Only Phase 2 and Phase 3 users can transfer rewards'::text;
    RETURN;
  END IF;
  -- Validate there's credit to transfer
  IF v_credit_remaining <= 0 THEN
    RETURN QUERY
    SELECT
      FALSE,
      0,
      0,
      'No store credit available to transfer'::text;
    RETURN;
  END IF;
  -- Start transaction
  BEGIN
    -- 1. Deduct from phase_rewards
    UPDATE
      public.phase_rewards
    SET
      credit_remaining_cents = 0,
      credit_used_cents = v_credit_total,
      updated_at = timezone('utc', now())
    WHERE
      id = v_reward_id;
    -- 2. Add to network_commissions
    INSERT INTO public.network_commissions(user_id, from_user_id, order_id, amount_cents, currency, commission_type, status, level, created_at)
      VALUES (p_user_id, p_user_id, -- Self-referencing
        NULL, -- Not from an order
        v_credit_remaining, 'USD', 'phase_reward_transfer', 'available', 0, -- Special level for phase rewards
        timezone('utc', now()));
    -- Return success
    RETURN QUERY
    SELECT
      TRUE,
      v_credit_remaining,
      0,
      NULL::text;
  EXCEPTION
    WHEN OTHERS THEN
      -- Rollback happens automatically
      RETURN QUERY
      SELECT
        FALSE,
        0,
        v_credit_remaining,
        SQLERRM::text;
  END;
END;
$$;
-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_current_month() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_end_of_month(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_phase_reward(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_active_phase_rewards(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_phase_rewards(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.use_free_product_reward(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.use_store_credit(UUID, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.transfer_phase_rewards_to_earnings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_phase_rewards_to_earnings(UUID) TO service_role;
-- Add function comments
COMMENT ON FUNCTION public.get_current_month() IS 'Returns the current month in YYYY-MM format for phase rewards tracking';
COMMENT ON FUNCTION public.get_end_of_month(TEXT) IS 'Returns the end of month timestamp for a given month string';
COMMENT ON FUNCTION public.grant_phase_reward(UUID, INTEGER) IS 'Grants or updates phase rewards for a user based on their current phase';
COMMENT ON FUNCTION public.get_active_phase_rewards(UUID) IS 'Returns active phase rewards for a user in the current month';
COMMENT ON FUNCTION public.use_free_product_reward(UUID, UUID) IS 'Marks the free product reward as used for a specific order';
COMMENT ON FUNCTION public.use_store_credit(UUID, BIGINT) IS 'Deducts store credit from phase rewards for a purchase';
COMMENT ON FUNCTION public.transfer_phase_rewards_to_earnings(UUID) IS 'Transfers phase reward store credit to network earnings balance. Only available for Phase 2 and Phase 3 users. Returns success status, transferred amount, remaining amount, and error message if any.';
COMMIT;

-- =============================================================
-- MIGRATION: Add quantity alias for order_items
-- Date: 2025-01-08
-- Description: Add 'quantity' as a generated column alias for 'qty'
--              to support both naming conventions in the codebase
-- =============================================================
BEGIN;
-- Add quantity column as a generated column that mirrors qty
-- This allows queries to use either 'qty' or 'quantity'
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS quantity INTEGER GENERATED ALWAYS AS (qty) STORED;
-- Add helpful comments
COMMENT ON COLUMN public.order_items.quantity IS 'Generated column - alias for qty. Automatically synced with qty value.';
COMMENT ON COLUMN public.order_items.qty IS 'Primary quantity field. Use this column for INSERT and UPDATE operations.';
-- Note: When inserting or updating, always use 'qty' field
-- The 'quantity' field will automatically reflect the same value
-- =============================================================
-- MIGRATION: Add archived column to orders table
-- Date: 2025-10-14
-- Description: Add archived column to orders table to support
--              order archiving functionality in the profile page
-- =============================================================
-- Add archived column to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;
-- Add index for better performance when filtering archived orders
CREATE INDEX IF NOT EXISTS idx_orders_archived ON public.orders(archived)
WHERE
  archived = FALSE;
-- Add comment to document the column
COMMENT ON COLUMN public.orders.archived IS 'Flag to indicate if an order has been archived by the user. Archived orders are hidden from the profile page but still exist in the database.';
-- =============================================================
-- MIGRATION: Add notification preferences table
-- Date: 2025-10-22
-- Description: Add notification_preferences table to support
--              user notification settings for promotional offers,
--              team updates, and new video content
-- =============================================================
-- Create notification_preferences table
-- Stores user preferences for different types of email notifications
-- All preferences default to TRUE except new_video_content which defaults to FALSE
CREATE TABLE IF NOT EXISTS public.notification_preferences(
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  promotional_offers boolean NOT NULL DEFAULT TRUE,        -- Marketing emails and special offers
  team_updates boolean NOT NULL DEFAULT TRUE,              -- Notifications about team member activities
  new_video_content boolean NOT NULL DEFAULT FALSE,        -- Notifications when new videos are published
  order_notifications boolean NOT NULL DEFAULT TRUE,       -- Order confirmations and shipping updates
  subscription_notifications boolean NOT NULL DEFAULT TRUE, -- Subscription renewals, cancellations, etc.
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
COMMENT ON TABLE public.notification_preferences IS 'Stores user notification preferences for email notifications. RLS policies ensure users can only access their own preferences.';
-- Add RLS policies for notification_preferences
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
-- Users can view their own notification preferences
DROP POLICY IF EXISTS "notification_preferences_select_own" ON public.notification_preferences;
CREATE POLICY "notification_preferences_select_own" ON public.notification_preferences
  FOR SELECT
  TO authenticated
    USING (auth.uid() = user_id);
-- Users can insert their own notification preferences
DROP POLICY IF EXISTS "notification_preferences_insert_own" ON public.notification_preferences;
CREATE POLICY "notification_preferences_insert_own" ON public.notification_preferences
  FOR INSERT
  TO authenticated
    WITH CHECK (auth.uid() = user_id);
-- Users can update their own notification preferences
DROP POLICY IF EXISTS "notification_preferences_update_own" ON public.notification_preferences;
CREATE POLICY "notification_preferences_update_own" ON public.notification_preferences
  FOR UPDATE
  TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
-- Users can delete their own notification preferences
DROP POLICY IF EXISTS "notification_preferences_delete_own" ON public.notification_preferences;
CREATE POLICY "notification_preferences_delete_own" ON public.notification_preferences
  FOR DELETE
  TO authenticated
    USING (auth.uid() = user_id);
-- Service role can do everything
DROP POLICY IF EXISTS "notification_preferences_service_role_all" ON public.notification_preferences;
CREATE POLICY "notification_preferences_service_role_all" ON public.notification_preferences
  FOR ALL
  TO service_role
    USING (true)
    WITH CHECK (true);
-- Grant table permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_notification_preferences_promotional ON public.notification_preferences(promotional_offers)
  WHERE promotional_offers = TRUE;
CREATE INDEX IF NOT EXISTS idx_notification_preferences_team_updates ON public.notification_preferences(team_updates)
  WHERE team_updates = TRUE;
CREATE INDEX IF NOT EXISTS idx_notification_preferences_video_content ON public.notification_preferences(new_video_content)
  WHERE new_video_content = TRUE;
CREATE INDEX IF NOT EXISTS idx_notification_preferences_order_notifications ON public.notification_preferences(order_notifications)
  WHERE order_notifications = TRUE;
CREATE INDEX IF NOT EXISTS idx_notification_preferences_subscription_notifications ON public.notification_preferences(subscription_notifications)
  WHERE subscription_notifications = TRUE;
-- Add trigger for updated_at
DROP TRIGGER IF EXISTS on_notification_preferences_updated ON public.notification_preferences;
CREATE TRIGGER on_notification_preferences_updated
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
-- Create function to auto-create notification preferences when a user profile is created
-- This ensures that when users register, their Mailchimp subscription (from registration flow)
-- is properly reflected in their notification preferences
CREATE OR REPLACE FUNCTION public.create_default_notification_preferences()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
BEGIN
  -- Create default notification preferences for the new profile
  INSERT INTO public.notification_preferences (user_id, promotional_offers, team_updates, new_video_content, order_notifications, subscription_notifications)
  VALUES (NEW.id, true, true, false, true, true)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
-- Create trigger to automatically create notification preferences on profile insert
DROP TRIGGER IF EXISTS trigger_create_notification_preferences ON public.profiles;
CREATE TRIGGER trigger_create_notification_preferences
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_notification_preferences();
-- Grant execute permissions on notification preferences function
GRANT EXECUTE ON FUNCTION public.create_default_notification_preferences() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_default_notification_preferences() TO service_role;
-- Create function to notify when a new team member is added
CREATE OR REPLACE FUNCTION public.notify_team_member_added()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $$
DECLARE
  sponsor_record RECORD;
  notification_enabled BOOLEAN;
BEGIN
  -- Only proceed if this is a new insert with a referred_by value
  IF (TG_OP = 'INSERT' AND NEW.referred_by IS NOT NULL) THEN
    -- Get sponsor information
    SELECT
      id,
      name,
      email INTO sponsor_record
    FROM
      public.profiles
    WHERE
      id = NEW.referred_by;
    -- Check if sponsor exists
    IF sponsor_record.id IS NULL THEN
      RETURN NEW;
    END IF;
    -- Check if sponsor has team update notifications enabled
    SELECT
      team_updates INTO notification_enabled
    FROM
      public.notification_preferences
    WHERE
      user_id = sponsor_record.id;
    -- If no preference record exists, assume default (true)
    IF notification_enabled IS NULL THEN
      notification_enabled := TRUE;
    END IF;
    -- If notifications are enabled, log it
    -- In production, you might use pg_notify or call an external API
    IF notification_enabled THEN
      -- Log the notification (you can use this for debugging)
      RAISE NOTICE 'Team notification: % (%) added to team of % (%)', NEW.name, NEW.email, sponsor_record.name, sponsor_record.email;
      -- You could use pg_notify to send a notification to your application
      -- PERFORM pg_notify('team_member_added', json_build_object(
      --   'sponsor_id', sponsor_record.id,
      --   'sponsor_name', sponsor_record.name,
      --   'sponsor_email', sponsor_record.email,
      --   'new_member_id', NEW.id,
      --   'new_member_name', NEW.name,
      --   'new_member_email', NEW.email
      -- )::text);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
-- Create trigger to call the notification function
DROP TRIGGER IF EXISTS trigger_notify_team_member_added ON public.profiles;
CREATE TRIGGER trigger_notify_team_member_added
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_team_member_added();
-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.notify_team_member_added() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_team_member_added() TO service_role;
COMMENT ON TABLE public.notification_preferences IS 'Stores user notification preferences for email notifications';
COMMENT ON COLUMN public.notification_preferences.order_notifications IS 'Controls email notifications for order-related events (payments, tracking, delivery, cancellations)';
COMMENT ON COLUMN public.notification_preferences.subscription_notifications IS 'Controls email notifications for subscription-related events (renewals, payment method updates, renewal failures)';
COMMENT ON FUNCTION public.notify_team_member_added() IS 'Sends notification when a new team member is added via referral';

-- =============================================================
-- SECTION: Email Templates
-- Purpose: Store customizable email templates for all automated notifications
-- Description: Admins can edit these templates in multiple languages.
--              Templates support variables that are replaced at send time.
-- =============================================================
CREATE TABLE IF NOT EXISTS public.email_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  subject_en TEXT NOT NULL,
  subject_es TEXT NOT NULL,
  body_en TEXT NOT NULL,
  body_es TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_templates_category ON public.email_templates(category);
CREATE INDEX IF NOT EXISTS idx_email_templates_active ON public.email_templates(is_active);

-- Enable RLS
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active templates (for sending emails)
DROP POLICY IF EXISTS "email_templates_read_active" ON public.email_templates;
CREATE POLICY "email_templates_read_active"
  ON public.email_templates
  FOR SELECT
  USING (is_active = true);

-- Policy: Only admins can insert/update/delete templates
DROP POLICY IF EXISTS "email_templates_admin_all" ON public.email_templates;
CREATE POLICY "email_templates_admin_all"
  ON public.email_templates
  FOR ALL
  USING (
    public.is_super_admin(auth.uid())
  );

-- Add updated_at trigger
DROP TRIGGER IF EXISTS on_email_templates_updated ON public.email_templates;
CREATE TRIGGER on_email_templates_updated
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Grant permissions
GRANT SELECT ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;

-- Insert default email templates
-- Note: Default templates are loaded from docs/database/email-templates-seed.sql
-- Run this script after creating the table to populate with 14 default templates
-- Usage: Execute the seed script in Supabase SQL Editor or via psql:
--   \i docs/database/email-templates-seed.sql
-- This keeps the database.sql clean and maintainable

COMMENT ON TABLE public.email_templates IS 'Stores customizable email templates for automated notifications in multiple languages';
COMMENT ON COLUMN public.email_templates.category IS 'Categories: promotional, team, content, orders, subscription, payment';
COMMENT ON COLUMN public.email_templates.variables IS 'JSON array of variable names that can be used in subject and body templates';

-- =============================================================
-- SECTION: Admin Notes
-- Purpose: Allow admins to create and manage notes in the dashboard
-- =============================================================
CREATE TABLE IF NOT EXISTS public.admin_notes(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL CHECK (char_length(btrim(content)) > 0),
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);
-- Add RLS policies for admin_notes
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;
-- Only admins can view notes
DROP POLICY IF EXISTS "admin_notes_select_admin" ON public.admin_notes;
CREATE POLICY "admin_notes_select_admin" ON public.admin_notes
  FOR SELECT
    USING (public.is_super_admin(auth.uid()));
-- Only admins can insert notes
DROP POLICY IF EXISTS "admin_notes_insert_admin" ON public.admin_notes;
CREATE POLICY "admin_notes_insert_admin" ON public.admin_notes
  FOR INSERT
    WITH CHECK (public.is_super_admin(auth.uid()));
-- Only admins can update notes
DROP POLICY IF EXISTS "admin_notes_update_admin" ON public.admin_notes;
CREATE POLICY "admin_notes_update_admin" ON public.admin_notes
  FOR UPDATE
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));
-- Only admins can delete notes
DROP POLICY IF EXISTS "admin_notes_delete_admin" ON public.admin_notes;
CREATE POLICY "admin_notes_delete_admin" ON public.admin_notes
  FOR DELETE
    USING (public.is_super_admin(auth.uid()));
-- Service role can do everything
DROP POLICY IF EXISTS "admin_notes_service_role_all" ON public.admin_notes;
CREATE POLICY "admin_notes_service_role_all" ON public.admin_notes
  FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');
-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_notes_created_by ON public.admin_notes(created_by);
CREATE INDEX IF NOT EXISTS idx_admin_notes_created_at ON public.admin_notes(created_at DESC);
-- Add trigger for updated_at
DROP TRIGGER IF EXISTS on_admin_notes_updated ON public.admin_notes;
CREATE TRIGGER on_admin_notes_updated
  BEFORE UPDATE ON public.admin_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
COMMENT ON TABLE public.admin_notes IS 'Stores admin dashboard notes for internal use';
COMMENT ON COLUMN public.admin_notes.content IS 'The note content';
COMMENT ON COLUMN public.admin_notes.attachments IS 'Array of attachments (images, videos, audio) stored as JSONB with type, url, name, size';
COMMENT ON COLUMN public.admin_notes.created_by IS 'The admin who created the note';
-- ===========================================
-- ADMIN NOTES STORAGE BUCKET POLICIES
-- ===========================================
-- Create admin-notes bucket if it doesn't exist
INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('admin-notes', 'admin-notes', TRUE, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/wav', 'audio/ogg'])
ON CONFLICT (id)
  DO NOTHING;
-- Allow public read access to admin notes attachments
DROP POLICY IF EXISTS "storage_admin_notes_select" ON storage.objects;
CREATE POLICY "storage_admin_notes_select" ON storage.objects
  FOR SELECT
    USING (bucket_id = 'admin-notes');
-- Only admins can upload to admin-notes
DROP POLICY IF EXISTS "storage_admin_notes_insert" ON storage.objects;
CREATE POLICY "storage_admin_notes_insert" ON storage.objects
  FOR INSERT
    WITH CHECK (bucket_id = 'admin-notes'
    AND auth.role() = 'authenticated'
    AND public.is_super_admin(auth.uid()));
-- Only admins can update admin-notes
DROP POLICY IF EXISTS "storage_admin_notes_update" ON storage.objects;
CREATE POLICY "storage_admin_notes_update" ON storage.objects
  FOR UPDATE
    USING (bucket_id = 'admin-notes'
      AND auth.role() = 'authenticated'
      AND public.is_super_admin(auth.uid()));
-- Only admins can delete admin-notes
DROP POLICY IF EXISTS "storage_admin_notes_delete" ON storage.objects;
CREATE POLICY "storage_admin_notes_delete" ON storage.objects
  FOR DELETE
    USING (bucket_id = 'admin-notes'
      AND auth.role() = 'authenticated'
      AND public.is_super_admin(auth.uid()));
-- =============================================================
-- MIGRATION: Add purchase_source column to orders table
-- Date: 2025-01-30
-- Description: Add purchase_source column to track where the order
--              was placed (main_store or affiliate_store)
-- =============================================================
BEGIN;
-- Add purchase_source column to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS purchase_source TEXT NOT NULL DEFAULT 'main_store' CHECK (purchase_source IN ('main_store', 'affiliate_store'));
COMMENT ON COLUMN public.orders.purchase_source IS 'Source of the purchase: main_store (direct from main products page) or affiliate_store (from affiliate page).';
-- Recreate the order_fulfillment_view to include purchase_source
DROP VIEW IF EXISTS public.order_fulfillment_view;
CREATE VIEW public.order_fulfillment_view AS
SELECT
  o.id AS order_id,
  o.created_at AS order_created_at,
  o.status AS order_status,
  o.total_cents AS order_total_cents,
  COALESCE(o.tax_cents, 0) AS order_tax_cents,
  COALESCE(o.shipping_cents, 0) AS order_shipping_cents,
  COALESCE(o.discount_cents, 0) AS order_discount_cents,
  o.currency,
  o.purchase_source,
  o.user_id AS customer_id,
  p.name AS customer_name,
  p.email AS customer_email,
  p.phone AS customer_phone,
  p.address AS address_line,
  p.city,
  p.state,
  p.postal_code,
  p.country,
  oi.id AS order_item_id,
  oi.product_id,
  pr.name AS product_name,
  COALESCE(oi.qty, 0) AS quantity,
  COALESCE(oi.price_cents, 0) AS unit_price_cents,
  COALESCE(oi.qty, 0) * COALESCE(oi.price_cents, 0) AS line_total_cents
FROM
  public.orders o
  JOIN public.profiles p ON p.id = o.user_id
  LEFT JOIN public.order_items oi ON oi.order_id = o.id
  LEFT JOIN public.products pr ON pr.id = oi.product_id;
COMMENT ON VIEW public.order_fulfillment_view IS 'Denormalised orders with customer and line item details for fulfillment dashboards.';

-- =============================================================
-- STATIC PAGES CONTENT TABLE
-- Stores editable content for Contact, Privacy, and Terms pages
-- =============================================================
CREATE TABLE IF NOT EXISTS public.static_pages_content (
  locale TEXT PRIMARY KEY,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE public.static_pages_content ENABLE ROW LEVEL SECURITY;

-- Allow public read access
DROP POLICY IF EXISTS "Allow public read access to static pages" ON public.static_pages_content;
CREATE POLICY "Allow public read access to static pages"
  ON public.static_pages_content
  FOR SELECT
  USING (true);

-- Allow service role to manage static pages
DROP POLICY IF EXISTS "Allow service role to manage static pages" ON public.static_pages_content;
CREATE POLICY "Allow service role to manage static pages"
  ON public.static_pages_content
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_static_pages_locale ON public.static_pages_content(locale);

-- Add comment
COMMENT ON TABLE public.static_pages_content IS 'Stores editable content for static pages (Contact, Privacy, Terms) per locale.
Expected JSONB structure:
{
  "contact": {
    "title": "Contact Us",
    "subtitle": "Get in touch with us",
    "contactInfo": {
      "title": "Contact Information",
      "email": "info@example.com",
      "phone": "+123 456 7890",
      "hours": "Monday to Friday, 9:00 - 18:00"
    },
    "whyReachOut": {
      "title": "Why Reach Out?",
      "items": ["Reason 1", "Reason 2", "Reason 3"]
    }
  },
  "privacy": {
    "title": "Privacy Policy",
    "intro": "Your privacy is important...",
    "sections": {
      "informationWeCollect": { "title": "...", "content": "...", "details": "..." },
      "howWeUseInformation": { "title": "...", "content": "..." },
      "dataProtection": { "title": "...", "content": "..." }
    }
  },
  "terms": {
    "title": "Terms of Service",
    "intro": "Welcome to our service...",
    "sections": {
      "license": { "title": "...", "content": "...", "restrictions": { "title": "...", "items": ["..."] } },
      "userContent": { "title": "...", "content": "..." },
      "limitationOfLiability": { "title": "...", "content": "..." }
    }
  }
}';



-- ============================================================================
-- SECURITY ENHANCEMENTS - Added 2025-11-03
-- ============================================================================

-- ============================================================================
-- SECTION 1: AUDIT LOGS - Sistema de Auditoría de Seguridad
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  ip_address TEXT, -- Changed from INET to TEXT to support encrypted IPs (AES-256-GCM format: salt:iv:authTag:ciphertext)
  user_agent TEXT,
  request_method TEXT,
  request_path TEXT,
  status TEXT CHECK (status IN ('success', 'failure', 'pending')),
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Índices para audit_logs
-- Actualizado: 2025-11-13 - Agregado índice para status
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON public.audit_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON public.audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_security ON public.audit_logs(action, status, created_at DESC) WHERE status = 'failure';
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata ON public.audit_logs USING GIN (metadata);

-- RLS para audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_admin_read" ON public.audit_logs;
CREATE POLICY "audit_logs_admin_read" ON public.audit_logs
  FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "audit_logs_service_role" ON public.audit_logs;
CREATE POLICY "audit_logs_service_role" ON public.audit_logs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Función helper para crear audit logs
CREATE OR REPLACE FUNCTION public.create_audit_log(
  p_user_id UUID,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL, -- Changed from INET to TEXT for encrypted IPs
  p_user_agent TEXT DEFAULT NULL,
  p_request_method TEXT DEFAULT NULL,
  p_request_path TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'success',
  p_metadata JSONB DEFAULT '{}'::JSONB
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    user_id, action, entity_type, entity_id, ip_address, user_agent,
    request_method, request_path, status, metadata, created_at
  )
  VALUES (
    p_user_id, p_action, p_entity_type, p_entity_id, p_ip_address, p_user_agent,
    p_request_method, p_request_path, p_status, p_metadata, NOW()
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vista para eventos de seguridad críticos
-- Actualizado: 2025-11-13 - Agregados nuevos tipos de eventos y columna user_agent
CREATE OR REPLACE VIEW public.security_events AS
SELECT 
  al.id, 
  al.user_id, 
  p.email as user_email, 
  p.name as user_name,
  al.action, 
  al.entity_type, 
  al.entity_id, 
  al.ip_address,
  al.user_agent,
  al.status, 
  al.metadata,
  al.created_at
FROM public.audit_logs al
LEFT JOIN public.profiles p ON p.id = al.user_id
WHERE al.action IN (
  -- Existing security events
  'LOGIN_FAILED', 
  'PASSWORD_RESET_REQUESTED', 
  'PASSWORD_CHANGED',
  'EMAIL_CHANGED', 
  'USER_ROLE_CHANGED', 
  'USER_SUSPENDED',
  'PAYMENT_GATEWAY_UPDATED', 
  'WALLET_WITHDRAWAL_REQUESTED',
  'WALLET_WITHDRAWAL_APPROVED', 
  'WALLET_WITHDRAWAL_REJECTED',
  'FRAUD_ALERT_TRIGGERED', 
  'SUSPICIOUS_ACTIVITY', 
  'ADMIN_ACCESS',
  -- New security events (added 2025-11-13)
  'CSRF_FAILED',
  'FILE_UPLOAD_REJECTED',
  'UNAUTHORIZED_ACCESS',
  'RATE_LIMIT_EXCEEDED',
  'INVALID_INPUT',
  'AUTHENTICATION_FAILED',
  'PRIVILEGE_ESCALATION_ATTEMPT'
)
ORDER BY al.created_at DESC;

-- Vista para intentos de login fallidos
CREATE OR REPLACE VIEW public.failed_login_attempts AS
SELECT 
  al.id, al.user_id, p.email as user_email, al.ip_address,
  al.user_agent, al.metadata->>'reason' as failure_reason, al.created_at
FROM public.audit_logs al
LEFT JOIN public.profiles p ON p.id = al.user_id
WHERE al.action = 'LOGIN_FAILED'
ORDER BY al.created_at DESC;

-- Función para detectar actividad sospechosa
CREATE OR REPLACE FUNCTION public.detect_suspicious_activity(
  p_user_id UUID DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL, -- Changed from INET to TEXT for encrypted IPs
  p_time_window_minutes INTEGER DEFAULT 60
) RETURNS TABLE (
  alert_type TEXT,
  count BIGINT,
  details JSONB
) AS $$
BEGIN
  -- Múltiples intentos de login fallidos
  RETURN QUERY
  SELECT 
    'MULTIPLE_FAILED_LOGINS'::TEXT, COUNT(*),
    jsonb_build_object(
      'user_id', al.user_id, 'ip_address', al.ip_address,
      'first_attempt', MIN(al.created_at), 'last_attempt', MAX(al.created_at)
    )
  FROM public.audit_logs al
  WHERE al.action = 'LOGIN_FAILED'
    AND al.created_at > NOW() - (p_time_window_minutes || ' minutes')::INTERVAL
    AND (p_user_id IS NULL OR al.user_id = p_user_id)
    AND (p_ip_address IS NULL OR al.ip_address = p_ip_address)
  GROUP BY al.user_id, al.ip_address
  HAVING COUNT(*) >= 5;
  
  -- Múltiples retiros en corto tiempo
  RETURN QUERY
  SELECT 
    'MULTIPLE_WITHDRAWALS'::TEXT, COUNT(*),
    jsonb_build_object(
      'user_id', al.user_id,
      'total_amount', SUM((al.metadata->>'amount_cents')::INTEGER),
      'first_withdrawal', MIN(al.created_at), 'last_withdrawal', MAX(al.created_at)
    )
  FROM public.audit_logs al
  WHERE al.action = 'WALLET_WITHDRAWAL_REQUESTED'
    AND al.created_at > NOW() - (p_time_window_minutes || ' minutes')::INTERVAL
    AND (p_user_id IS NULL OR al.user_id = p_user_id)
  GROUP BY al.user_id
  HAVING COUNT(*) >= 3;
  
  -- Accesos desde múltiples IPs
  RETURN QUERY
  SELECT 
    'MULTIPLE_IPS'::TEXT, COUNT(DISTINCT al.ip_address),
    jsonb_build_object(
      'user_id', al.user_id, 'ip_addresses', jsonb_agg(DISTINCT al.ip_address),
      'time_window', p_time_window_minutes || ' minutes'
    )
  FROM public.audit_logs al
  WHERE al.action IN ('LOGIN_SUCCESS', 'ADMIN_ACCESS')
    AND al.created_at > NOW() - (p_time_window_minutes || ' minutes')::INTERVAL
    AND (p_user_id IS NULL OR al.user_id = p_user_id)
    AND al.ip_address IS NOT NULL
  GROUP BY al.user_id
  HAVING COUNT(DISTINCT al.ip_address) >= 3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para limpiar logs antiguos
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.audit_logs
  WHERE created_at < NOW() - INTERVAL '90 days'
  RETURNING COUNT(*) INTO v_deleted_count;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permisos para audit_logs
REVOKE ALL ON TABLE public.audit_logs FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_audit_log FROM PUBLIC;
REVOKE ALL ON FUNCTION public.detect_suspicious_activity FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_old_audit_logs FROM PUBLIC;

GRANT ALL ON TABLE public.audit_logs TO service_role;
GRANT EXECUTE ON FUNCTION public.create_audit_log TO service_role;
GRANT EXECUTE ON FUNCTION public.detect_suspicious_activity TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_old_audit_logs TO service_role;
GRANT EXECUTE ON FUNCTION public.create_audit_log TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_suspicious_activity TO authenticated;

COMMENT ON TABLE public.audit_logs IS 'Registro de auditoría para eventos de seguridad y actividades críticas del sistema';
COMMENT ON FUNCTION public.create_audit_log IS 'Crea un registro de auditoría con información contextual de la solicitud';
COMMENT ON FUNCTION public.detect_suspicious_activity IS 'Detecta patrones de actividad sospechosa basados en logs de auditoría';
COMMENT ON FUNCTION public.cleanup_old_audit_logs IS 'Limpia registros de auditoría más antiguos de 90 días';



-- ============================================================================
-- SECTION 2: ATOMIC WALLET OPERATIONS - Transacciones Atómicas
-- ============================================================================

-- Función para débito atómico con verificación de saldo
CREATE OR REPLACE FUNCTION public.atomic_wallet_debit(
  p_user_id UUID,
  p_amount_cents INTEGER,
  p_reason TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
) RETURNS JSONB AS $$
DECLARE
  v_transaction_id UUID;
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  IF p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT' USING HINT = 'Amount must be positive';
  END IF;

  SELECT balance_cents INTO v_current_balance
  FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WALLET_NOT_FOUND' USING HINT = 'Wallet does not exist for user';
  END IF;
  
  IF v_current_balance < p_amount_cents THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE' 
      USING HINT = format('Required: %s, Available: %s', p_amount_cents, v_current_balance);
  END IF;
  
  v_new_balance := v_current_balance - p_amount_cents;
  
  UPDATE public.wallets
  SET balance_cents = v_new_balance, updated_at = NOW()
  WHERE user_id = p_user_id;
  
  INSERT INTO public.wallet_txns (user_id, amount_cents, reason, metadata, created_at)
  VALUES (
    p_user_id, -p_amount_cents, p_reason,
    p_metadata || jsonb_build_object(
      'operation', 'debit',
      'previous_balance', v_current_balance,
      'new_balance', v_new_balance
    ),
    NOW()
  )
  RETURNING id INTO v_transaction_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'transactionId', v_transaction_id,
    'previousBalanceCents', v_current_balance,
    'newBalanceCents', v_new_balance,
    'amountDebited', p_amount_cents
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'atomic_wallet_debit failed: % %', SQLERRM, SQLSTATE;
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para crédito atómico
CREATE OR REPLACE FUNCTION public.atomic_wallet_credit(
  p_user_id UUID,
  p_amount_cents INTEGER,
  p_reason TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
) RETURNS JSONB AS $$
DECLARE
  v_transaction_id UUID;
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  IF p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT' USING HINT = 'Amount must be positive';
  END IF;

  SELECT balance_cents INTO v_current_balance
  FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
  
  IF NOT FOUND THEN
    INSERT INTO public.wallets (user_id, balance_cents, created_at, updated_at)
    VALUES (p_user_id, 0, NOW(), NOW());
    v_current_balance := 0;
  END IF;
  
  v_new_balance := v_current_balance + p_amount_cents;
  
  UPDATE public.wallets
  SET balance_cents = v_new_balance, updated_at = NOW()
  WHERE user_id = p_user_id;
  
  INSERT INTO public.wallet_txns (user_id, amount_cents, reason, metadata, created_at)
  VALUES (
    p_user_id, p_amount_cents, p_reason,
    p_metadata || jsonb_build_object(
      'operation', 'credit',
      'previous_balance', v_current_balance,
      'new_balance', v_new_balance
    ),
    NOW()
  )
  RETURNING id INTO v_transaction_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'transactionId', v_transaction_id,
    'previousBalanceCents', v_current_balance,
    'newBalanceCents', v_new_balance,
    'amountCredited', p_amount_cents
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'atomic_wallet_credit failed: % %', SQLERRM, SQLSTATE;
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para transferencia atómica entre wallets
CREATE OR REPLACE FUNCTION public.atomic_wallet_transfer(
  p_from_user_id UUID,
  p_to_user_id UUID,
  p_amount_cents INTEGER,
  p_reason TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
) RETURNS JSONB AS $$
DECLARE
  v_from_transaction_id UUID;
  v_to_transaction_id UUID;
BEGIN
  IF p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT' USING HINT = 'Amount must be positive';
  END IF;
  
  IF p_from_user_id = p_to_user_id THEN
    RAISE EXCEPTION 'INVALID_TRANSFER' USING HINT = 'Cannot transfer to same wallet';
  END IF;

  -- Bloquear en orden consistente para evitar deadlocks
  IF p_from_user_id < p_to_user_id THEN
    PERFORM 1 FROM public.wallets WHERE user_id = p_from_user_id FOR UPDATE;
    PERFORM 1 FROM public.wallets WHERE user_id = p_to_user_id FOR UPDATE;
  ELSE
    PERFORM 1 FROM public.wallets WHERE user_id = p_to_user_id FOR UPDATE;
    PERFORM 1 FROM public.wallets WHERE user_id = p_from_user_id FOR UPDATE;
  END IF;
  
  SELECT jsonb_extract_path_text(
    public.atomic_wallet_debit(
      p_from_user_id, p_amount_cents, p_reason,
      p_metadata || jsonb_build_object('transfer_to', p_to_user_id)
    ),
    'transactionId'
  )::UUID INTO v_from_transaction_id;
  
  SELECT jsonb_extract_path_text(
    public.atomic_wallet_credit(
      p_to_user_id, p_amount_cents, p_reason,
      p_metadata || jsonb_build_object('transfer_from', p_from_user_id)
    ),
    'transactionId'
  )::UUID INTO v_to_transaction_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'fromTransactionId', v_from_transaction_id,
    'toTransactionId', v_to_transaction_id,
    'amountTransferred', p_amount_cents
  );
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'atomic_wallet_transfer failed: % %', SQLERRM, SQLSTATE;
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permisos para funciones de wallet
REVOKE ALL ON FUNCTION public.atomic_wallet_debit FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atomic_wallet_credit FROM PUBLIC;
REVOKE ALL ON FUNCTION public.atomic_wallet_transfer FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.atomic_wallet_debit TO authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_wallet_credit TO authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_wallet_transfer TO authenticated;

GRANT EXECUTE ON FUNCTION public.atomic_wallet_debit TO service_role;
GRANT EXECUTE ON FUNCTION public.atomic_wallet_credit TO service_role;
GRANT EXECUTE ON FUNCTION public.atomic_wallet_transfer TO service_role;

COMMENT ON FUNCTION public.atomic_wallet_debit IS 'Realiza un débito atómico del wallet con verificación de saldo y bloqueo para prevenir race conditions';
COMMENT ON FUNCTION public.atomic_wallet_credit IS 'Realiza un crédito atómico al wallet, creando el wallet si no existe';
COMMENT ON FUNCTION public.atomic_wallet_transfer IS 'Transfiere fondos entre dos wallets de forma atómica, previniendo deadlocks';



-- ============================================================================
-- SECTION 3: WITHDRAWAL LIMITS - Límites de Retiro y Prevención de Fraude
-- ============================================================================

-- Tabla de configuración de límites
CREATE TABLE IF NOT EXISTS public.withdrawal_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_limit_cents INTEGER NOT NULL DEFAULT 100000,
  single_transaction_limit_cents INTEGER NOT NULL DEFAULT 50000,
  monthly_limit_cents INTEGER NOT NULL DEFAULT 500000,
  verified_daily_limit_cents INTEGER NOT NULL DEFAULT 500000,
  verified_single_transaction_limit_cents INTEGER NOT NULL DEFAULT 200000,
  verified_monthly_limit_cents INTEGER NOT NULL DEFAULT 2000000,
  alert_threshold_percentage INTEGER NOT NULL DEFAULT 80,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Insertar configuración por defecto
INSERT INTO public.withdrawal_limits (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Tabla de solicitudes de retiro
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')
  ),
  payment_method TEXT NOT NULL CHECK (
    payment_method IN ('stripe', 'paypal', 'bank_transfer', 'authorize_net', 'payoneer')
  ),
  payment_details JSONB,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Índices para withdrawal_requests
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user_id ON public.withdrawal_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON public.withdrawal_requests(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created_at ON public.withdrawal_requests(created_at DESC);

-- Función para verificar límites de retiro
CREATE OR REPLACE FUNCTION public.check_withdrawal_limits(
  p_user_id UUID,
  p_amount_cents INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_limits RECORD;
  v_is_verified BOOLEAN;
  v_daily_limit INTEGER;
  v_single_limit INTEGER;
  v_monthly_limit INTEGER;
  v_today_total INTEGER;
  v_month_total INTEGER;
  v_remaining_daily INTEGER;
  v_remaining_monthly INTEGER;
BEGIN
  SELECT * INTO v_limits FROM public.withdrawal_limits
  WHERE id = '00000000-0000-0000-0000-000000000001';
  
  SELECT COALESCE((metadata->>'kyc_verified')::BOOLEAN, FALSE) INTO v_is_verified
  FROM public.profiles WHERE id = p_user_id;
  
  IF v_is_verified THEN
    v_daily_limit := v_limits.verified_daily_limit_cents;
    v_single_limit := v_limits.verified_single_transaction_limit_cents;
    v_monthly_limit := v_limits.verified_monthly_limit_cents;
  ELSE
    v_daily_limit := v_limits.daily_limit_cents;
    v_single_limit := v_limits.single_transaction_limit_cents;
    v_monthly_limit := v_limits.monthly_limit_cents;
  END IF;
  
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_today_total
  FROM public.withdrawal_requests
  WHERE user_id = p_user_id
    AND status IN ('approved', 'completed')
    AND created_at >= CURRENT_DATE;
  
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_month_total
  FROM public.withdrawal_requests
  WHERE user_id = p_user_id
    AND status IN ('approved', 'completed')
    AND created_at >= DATE_TRUNC('month', CURRENT_DATE);
  
  v_remaining_daily := v_daily_limit - v_today_total;
  v_remaining_monthly := v_monthly_limit - v_month_total;
  
  IF p_amount_cents > v_single_limit THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'reason', 'EXCEEDS_SINGLE_TRANSACTION_LIMIT',
      'limit_cents', v_single_limit,
      'requested_cents', p_amount_cents
    );
  END IF;
  
  IF v_today_total + p_amount_cents > v_daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'reason', 'EXCEEDS_DAILY_LIMIT',
      'limit_cents', v_daily_limit,
      'used_today_cents', v_today_total,
      'remaining_cents', v_remaining_daily,
      'requested_cents', p_amount_cents
    );
  END IF;
  
  IF v_month_total + p_amount_cents > v_monthly_limit THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'reason', 'EXCEEDS_MONTHLY_LIMIT',
      'limit_cents', v_monthly_limit,
      'used_month_cents', v_month_total,
      'remaining_cents', v_remaining_monthly,
      'requested_cents', p_amount_cents
    );
  END IF;
  
  DECLARE
    v_should_alert BOOLEAN := FALSE;
    v_alert_reason TEXT;
  BEGIN
    IF (v_today_total + p_amount_cents) * 100 / v_daily_limit >= v_limits.alert_threshold_percentage THEN
      v_should_alert := TRUE;
      v_alert_reason := 'APPROACHING_DAILY_LIMIT';
    ELSIF (v_month_total + p_amount_cents) * 100 / v_monthly_limit >= v_limits.alert_threshold_percentage THEN
      v_should_alert := TRUE;
      v_alert_reason := 'APPROACHING_MONTHLY_LIMIT';
    END IF;
    
    RETURN jsonb_build_object(
      'allowed', TRUE,
      'is_verified', v_is_verified,
      'limits', jsonb_build_object(
        'daily_limit_cents', v_daily_limit,
        'single_limit_cents', v_single_limit,
        'monthly_limit_cents', v_monthly_limit
      ),
      'usage', jsonb_build_object(
        'today_total_cents', v_today_total,
        'month_total_cents', v_month_total,
        'remaining_daily_cents', v_remaining_daily - p_amount_cents,
        'remaining_monthly_cents', v_remaining_monthly - p_amount_cents
      ),
      'alert', jsonb_build_object(
        'should_alert', v_should_alert,
        'reason', v_alert_reason
      )
    );
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Función para crear solicitud de retiro con validación
CREATE OR REPLACE FUNCTION public.create_withdrawal_request(
  p_user_id UUID,
  p_amount_cents INTEGER,
  p_payment_method TEXT,
  p_payment_details JSONB DEFAULT '{}'::JSONB,
  p_metadata JSONB DEFAULT '{}'::JSONB
) RETURNS JSONB AS $$
DECLARE
  v_limit_check JSONB;
  v_wallet_balance INTEGER;
  v_request_id UUID;
BEGIN
  v_limit_check := public.check_withdrawal_limits(p_user_id, p_amount_cents);
  
  IF NOT (v_limit_check->>'allowed')::BOOLEAN THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'LIMIT_EXCEEDED',
      'details', v_limit_check
    );
  END IF;
  
  SELECT balance_cents INTO v_wallet_balance
  FROM public.wallets WHERE user_id = p_user_id;
  
  IF v_wallet_balance IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'WALLET_NOT_FOUND');
  END IF;
  
  IF v_wallet_balance < p_amount_cents THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'INSUFFICIENT_BALANCE',
      'available_cents', v_wallet_balance,
      'requested_cents', p_amount_cents
    );
  END IF;
  
  INSERT INTO public.withdrawal_requests (
    user_id, amount_cents, payment_method, payment_details, metadata, status
  )
  VALUES (
    p_user_id, p_amount_cents, p_payment_method, p_payment_details,
    p_metadata || jsonb_build_object(
      'limit_check', v_limit_check,
      'wallet_balance_at_request', v_wallet_balance
    ),
    'pending'
  )
  RETURNING id INTO v_request_id;
  
  IF (v_limit_check->'alert'->>'should_alert')::BOOLEAN THEN
    PERFORM public.create_audit_log(
      p_user_id, 'WITHDRAWAL_LIMIT_ALERT', 'withdrawal_request', v_request_id::TEXT,
      NULL, NULL, NULL, NULL, 'success',
      jsonb_build_object(
        'alert_reason', v_limit_check->'alert'->>'reason',
        'amount_cents', p_amount_cents,
        'usage', v_limit_check->'usage'
      )
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'request_id', v_request_id,
    'limit_check', v_limit_check
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS para withdrawal_limits y withdrawal_requests
ALTER TABLE public.withdrawal_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "withdrawal_limits_admin" ON public.withdrawal_limits;
CREATE POLICY "withdrawal_limits_admin" ON public.withdrawal_limits
  FOR ALL
  USING (
    public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "withdrawal_requests_user_read" ON public.withdrawal_requests;
CREATE POLICY "withdrawal_requests_user_read" ON public.withdrawal_requests
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "withdrawal_requests_admin" ON public.withdrawal_requests;
CREATE POLICY "withdrawal_requests_admin" ON public.withdrawal_requests
  FOR ALL
  USING (
    public.is_super_admin(auth.uid())
  );

DROP POLICY IF EXISTS "withdrawal_limits_service_role" ON public.withdrawal_limits;
CREATE POLICY "withdrawal_limits_service_role" ON public.withdrawal_limits
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "withdrawal_requests_service_role" ON public.withdrawal_requests;
CREATE POLICY "withdrawal_requests_service_role" ON public.withdrawal_requests
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Permisos
REVOKE ALL ON TABLE public.withdrawal_limits FROM PUBLIC;
REVOKE ALL ON TABLE public.withdrawal_requests FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_withdrawal_limits FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_withdrawal_request FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.check_withdrawal_limits TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_withdrawal_request TO authenticated;

GRANT ALL ON TABLE public.withdrawal_limits TO service_role;
GRANT ALL ON TABLE public.withdrawal_requests TO service_role;
GRANT EXECUTE ON FUNCTION public.check_withdrawal_limits TO service_role;
GRANT EXECUTE ON FUNCTION public.create_withdrawal_request TO service_role;

COMMENT ON TABLE public.withdrawal_limits IS 'Configuración de límites de retiro diarios, mensuales y por transacción';
COMMENT ON TABLE public.withdrawal_requests IS 'Solicitudes de retiro de fondos del wallet';
COMMENT ON FUNCTION public.check_withdrawal_limits IS 'Verifica si un retiro está dentro de los límites permitidos';
COMMENT ON FUNCTION public.create_withdrawal_request IS 'Crea una solicitud de retiro con validación de límites y saldo';

-- =============================================================
-- SECTION: Security Audit Logs (added 2025-11-04)
-- =============================================================
-- Security Audit Logs Table
-- Stores security events for monitoring and compliance

CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event information
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  message TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,

  -- Timestamp
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- User information
  user_id UUID,
  user_email TEXT,

  -- Request information
  ip_address TEXT,
  user_agent TEXT,
  request_path TEXT,
  request_method TEXT,

  -- Additional metadata (JSONB for flexibility)
  metadata JSONB,

  -- Indexes for common queries
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_timestamp ON public.security_audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_event_type ON public.security_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_severity ON public.security_audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user_id ON public.security_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_ip_address ON public.security_audit_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_success ON public.security_audit_logs(success);

-- Create index on metadata for JSONB queries
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_metadata ON public.security_audit_logs USING GIN(metadata);

-- Add RLS policies (admin only access)
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.security_audit_logs;
CREATE POLICY "Admins can view all audit logs"
  ON public.security_audit_logs
  FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
  );

-- System can insert audit logs (no RLS on insert)
DROP POLICY IF EXISTS "System can insert audit logs" ON public.security_audit_logs;
CREATE POLICY "System can insert audit logs"
  ON public.security_audit_logs
  FOR INSERT
  WITH CHECK (true);

-- No one can update or delete audit logs (immutable)
-- (No policies created for UPDATE or DELETE)

-- Permissions
REVOKE ALL ON TABLE public.security_audit_logs FROM PUBLIC;
GRANT SELECT ON TABLE public.security_audit_logs TO authenticated;
GRANT ALL ON TABLE public.security_audit_logs TO service_role;

-- Add comments
COMMENT ON TABLE public.security_audit_logs IS 'Security audit logs for compliance and monitoring';
COMMENT ON COLUMN public.security_audit_logs.event_type IS 'Type of security event (e.g., auth.login.success)';
COMMENT ON COLUMN public.security_audit_logs.severity IS 'Severity level: info, warning, error, critical';
COMMENT ON COLUMN public.security_audit_logs.success IS 'Whether the action succeeded or failed';
COMMENT ON COLUMN public.security_audit_logs.metadata IS 'Additional event-specific data as JSONB';

-- ============================================================================
-- SECURITY MANAGEMENT TABLES
-- ============================================================================

-- Security Settings Table
CREATE TABLE IF NOT EXISTS public.security_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',

  -- CAPTCHA Configuration
  captcha_enabled BOOLEAN NOT NULL DEFAULT false,
  captcha_provider TEXT CHECK (captcha_provider IN ('recaptcha_v2', 'recaptcha_v3', 'hcaptcha', 'turnstile')),
  captcha_site_key TEXT,
  captcha_secret_key TEXT,
  captcha_threshold DECIMAL(3,2) DEFAULT 0.5 CHECK (captcha_threshold >= 0 AND captcha_threshold <= 1),

  -- Threat Intelligence Configuration
  abuse_ch_enabled BOOLEAN NOT NULL DEFAULT false,
  abuse_ch_urlhaus_enabled BOOLEAN NOT NULL DEFAULT true,
  abuse_ch_threatfox_enabled BOOLEAN NOT NULL DEFAULT true,
  abuse_ch_cache_ttl_seconds INTEGER NOT NULL DEFAULT 3600,
  abuse_ch_log_threats BOOLEAN NOT NULL DEFAULT true,

  virustotal_enabled BOOLEAN NOT NULL DEFAULT false,
  virustotal_api_key TEXT,
  virustotal_cache_ttl_seconds INTEGER NOT NULL DEFAULT 7200,
  virustotal_threshold INTEGER NOT NULL DEFAULT 2 CHECK (virustotal_threshold >= 1 AND virustotal_threshold <= 10),

  google_safe_browsing_enabled BOOLEAN NOT NULL DEFAULT false,
  google_safe_browsing_api_key TEXT,
  google_safe_browsing_cache_ttl_seconds INTEGER NOT NULL DEFAULT 1800,

  threat_intelligence_strategy TEXT NOT NULL DEFAULT 'any' CHECK (threat_intelligence_strategy IN ('any', 'majority', 'all')),

  -- Rate Limiting Configuration
  api_rate_limit_requests INTEGER NOT NULL DEFAULT 60 CHECK (api_rate_limit_requests >= 1 AND api_rate_limit_requests <= 1000),
  api_rate_limit_window_ms INTEGER NOT NULL DEFAULT 60000 CHECK (api_rate_limit_window_ms >= 1000),
  login_rate_limit_attempts INTEGER NOT NULL DEFAULT 5 CHECK (login_rate_limit_attempts >= 1 AND login_rate_limit_attempts <= 100),
  login_rate_limit_window_seconds INTEGER NOT NULL DEFAULT 60 CHECK (login_rate_limit_window_seconds >= 1),

  -- Auto-Block Configuration
  auto_block_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_block_duration_hours INTEGER NOT NULL DEFAULT 24 CHECK (auto_block_duration_hours >= 1 AND auto_block_duration_hours <= 8760),
  auto_block_min_confidence INTEGER NOT NULL DEFAULT 70 CHECK (auto_block_min_confidence >= 0 AND auto_block_min_confidence <= 100),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.security_settings (id) VALUES ('global') ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.security_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security_settings_admin_all" ON public.security_settings
  FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_security_settings_updated_at
  BEFORE UPDATE ON public.security_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.security_settings IS 'Global security configuration including CAPTCHA and threat intelligence settings.';

-- Blocked IPs Table
CREATE TABLE IF NOT EXISTS public.blocked_ips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  blocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_by UUID REFERENCES public.profiles(id),
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip_address ON public.blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_expires_at ON public.blocked_ips(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blocked_ips_blocked_at ON public.blocked_ips(blocked_at DESC);

ALTER TABLE public.blocked_ips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocked_ips_admin_all" ON public.blocked_ips
  FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Service role bypass for admin API operations
CREATE POLICY "blocked_ips_service_role" ON public.blocked_ips
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER update_blocked_ips_updated_at
  BEFORE UPDATE ON public.blocked_ips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.blocked_ips IS 'IP addresses blocked from accessing the platform. Supports temporary and permanent blocks.';

-- Blocked Words Table
CREATE TABLE IF NOT EXISTS public.blocked_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('profanity', 'spam', 'hate', 'other')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  is_regex BOOLEAN NOT NULL DEFAULT false,
  added_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocked_words_category ON public.blocked_words(category);
CREATE INDEX IF NOT EXISTS idx_blocked_words_severity ON public.blocked_words(severity);
CREATE INDEX IF NOT EXISTS idx_blocked_words_word ON public.blocked_words(word);

ALTER TABLE public.blocked_words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocked_words_admin_all" ON public.blocked_words
  FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_blocked_words_updated_at
  BEFORE UPDATE ON public.blocked_words
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.blocked_words IS 'Prohibited words and phrases for content moderation. Supports regex patterns.';

-- Helper Functions
CREATE OR REPLACE FUNCTION public.is_ip_blocked(check_ip TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.blocked_ips
    WHERE ip_address = check_ip AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.contains_blocked_words(check_text TEXT)
RETURNS TABLE(word TEXT, category TEXT, severity TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT bw.word, bw.category, bw.severity
  FROM public.blocked_words bw
  WHERE
    CASE
      WHEN bw.is_regex THEN check_text ~* bw.word
      ELSE LOWER(check_text) LIKE '%' || LOWER(bw.word) || '%'
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================
-- POST-INSTALLATION STEPS
-- =============================================================
-- After running this schema, execute the following seed scripts:
--
-- 1. Email Templates (REQUIRED for email notifications to work):
--    \i docs/database/email-templates-seed.sql
--
-- 2. Verify installation:
--    SELECT id, name, category FROM public.email_templates ORDER BY category;
--
-- See docs/email-templates-setup.md for complete setup instructions.
-- =============================================================

-- =============================================================
-- SECTION: Trusted Agents (Security bypass for automation)
-- =============================================================

-- Table: trusted_agents
-- Purpose: Store configuration for trusted agents (Manus, etc.) that can bypass security protections
CREATE TABLE IF NOT EXISTS public.trusted_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  user_agent_pattern TEXT, -- Regex pattern to match User-Agent header
  ip_address TEXT,          -- Specific IP address (can be encrypted)
  api_key TEXT UNIQUE,      -- Optional API key for authentication
  bypass_captcha BOOLEAN NOT NULL DEFAULT true,
  bypass_rate_limiting BOOLEAN NOT NULL DEFAULT true,
  bypass_csrf BOOLEAN NOT NULL DEFAULT true,
  bypass_csp BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  created_by UUID REFERENCES public.profiles(id),
  last_used_at TIMESTAMPTZ,
  CONSTRAINT trusted_agents_detection_check
    CHECK (user_agent_pattern IS NOT NULL OR ip_address IS NOT NULL OR api_key IS NOT NULL)
);

-- Enable RLS
ALTER TABLE public.trusted_agents ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admins can manage trusted agents
DROP POLICY IF EXISTS "trusted_agents_admin_all" ON public.trusted_agents;
CREATE POLICY "trusted_agents_admin_all" ON public.trusted_agents
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trusted_agents_active ON public.trusted_agents(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_trusted_agents_user_agent ON public.trusted_agents(user_agent_pattern) WHERE user_agent_pattern IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trusted_agents_ip ON public.trusted_agents(ip_address) WHERE ip_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trusted_agents_api_key ON public.trusted_agents(api_key) WHERE api_key IS NOT NULL;

-- Table: trusted_agent_logs
-- Purpose: Audit trail of all requests from trusted agents
CREATE TABLE IF NOT EXISTS public.trusted_agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.trusted_agents(id) ON DELETE CASCADE,
  request_path TEXT NOT NULL,
  request_method TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  bypassed_protections JSONB, -- { "captcha": true, "rate_limiting": true, "csrf": true, "csp": false }
  response_status INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Enable RLS
ALTER TABLE public.trusted_agent_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only admins can view logs
DROP POLICY IF EXISTS "trusted_agent_logs_admin_read" ON public.trusted_agent_logs;
CREATE POLICY "trusted_agent_logs_admin_read" ON public.trusted_agent_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trusted_agent_logs_agent_id ON public.trusted_agent_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_trusted_agent_logs_created_at ON public.trusted_agent_logs(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_trusted_agents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_trusted_agents_updated_at ON public.trusted_agents;
CREATE TRIGGER trigger_update_trusted_agents_updated_at
  BEFORE UPDATE ON public.trusted_agents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_trusted_agents_updated_at();

-- =============================================================

-- -------------------------------------------------------------
-- SECTION: Upload Limits Configuration
-- -------------------------------------------------------------
-- Table: upload_limits_config
-- Purpose: Configuration for file upload limits (images, videos, documents)

CREATE TABLE IF NOT EXISTS public.upload_limits_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Image limits
  max_image_size_mb DECIMAL(10, 2) NOT NULL DEFAULT 5.0,
  allowed_image_types TEXT[] NOT NULL DEFAULT ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
  max_image_width INTEGER DEFAULT 4096,
  max_image_height INTEGER DEFAULT 4096,

  -- Video limits
  max_video_size_mb DECIMAL(10, 2) NOT NULL DEFAULT 100.0,
  allowed_video_types TEXT[] NOT NULL DEFAULT ARRAY['video/mp4', 'video/webm', 'video/ogg'],
  max_video_duration_seconds INTEGER DEFAULT 600, -- 10 minutes

  -- Document limits
  max_document_size_mb DECIMAL(10, 2) NOT NULL DEFAULT 10.0,
  allowed_document_types TEXT[] NOT NULL DEFAULT ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],

  -- Avatar limits
  max_avatar_size_mb DECIMAL(10, 2) NOT NULL DEFAULT 2.0,

  -- General upload limits
  max_files_per_upload INTEGER NOT NULL DEFAULT 10,
  max_total_upload_size_mb DECIMAL(10, 2) NOT NULL DEFAULT 50.0,

  -- Feature flags
  enable_image_compression BOOLEAN NOT NULL DEFAULT true,
  enable_video_transcoding BOOLEAN NOT NULL DEFAULT false,
  enable_virus_scanning BOOLEAN NOT NULL DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Ensure only one configuration row exists
  CONSTRAINT single_config_row CHECK (id = '00000000-0000-0000-0000-000000000001'::uuid)
);

-- Insert default configuration (using a specific UUID to ensure single row)
INSERT INTO public.upload_limits_config (id)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid)
ON CONFLICT (id) DO NOTHING;

-- Create index
CREATE INDEX IF NOT EXISTS idx_upload_limits_updated_at ON public.upload_limits_config(updated_at DESC);

-- Enable RLS
ALTER TABLE public.upload_limits_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Admin can read upload limits
DROP POLICY IF EXISTS "upload_limits_admin_read" ON public.upload_limits_config;
CREATE POLICY "upload_limits_admin_read"
  ON public.upload_limits_config
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
  );

-- Admin can update upload limits
DROP POLICY IF EXISTS "upload_limits_admin_update" ON public.upload_limits_config;
CREATE POLICY "upload_limits_admin_update"
  ON public.upload_limits_config
  FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
  );

-- Public read access (for validation during uploads)
DROP POLICY IF EXISTS "upload_limits_public_read" ON public.upload_limits_config;
CREATE POLICY "upload_limits_public_read"
  ON public.upload_limits_config
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_upload_limits_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_upload_limits_updated_at ON public.upload_limits_config;
CREATE TRIGGER trigger_update_upload_limits_updated_at
  BEFORE UPDATE ON public.upload_limits_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_upload_limits_updated_at();

-- Add comment
COMMENT ON TABLE public.upload_limits_config IS 'Configuration for file upload limits (images, videos, documents). Only one row should exist.';

-- =============================================================
-- RBAC SYSTEM IMPLEMENTATION COMPLETE ✅
-- =============================================================
-- All RLS policies have been successfully updated to use the new RBAC system.
-- All policies now use the `is_super_admin(auth.uid())` function instead of
-- the old `profiles.role = 'admin'` pattern.
--
-- The RBAC system includes:
-- - roles table with system roles (Super Admin, Member)
-- - is_super_admin() helper function for RLS policies
-- - role_id column in profiles table (replacing the old role column)
-- - Granular permissions system (11 permissions)
--
-- Updated policies include:
-- - analytics_events, analytics_config
-- - email_templates
-- - admin_notes (all CRUD operations)
-- - storage.objects (admin-notes bucket)
-- - audit_logs
-- - withdrawal_limits, withdrawal_requests
-- - security_audit_logs
-- - security_settings, blocked_ips, blocked_words
-- - upload_limits_config
-- - And all other admin-related policies
-- =============================================================

COMMIT;

-- =============================================================
-- MIGRATION 002: Add access_admin_panel permission to Super Admin role
-- Created: 2025-11-16
-- Description: Adds the new 'access_admin_panel' permission to the Super Admin role
--              This permission is required to access the admin panel
-- =============================================================

-- Update the Super Admin role to include the new access_admin_panel permission
UPDATE public.roles
SET
  permissions = ARRAY['access_admin_panel', 'view_dashboard', 'manage_users', 'manage_products', 'manage_orders', 'manage_payments', 'manage_plans', 'manage_content', 'manage_settings', 'view_reports', 'manage_security', 'manage_roles'],
  updated_at = NOW()
WHERE name = 'Super Admin' AND is_system_role = true;

-- =============================================================
-- MIGRATION 003: Create Admin IP Whitelist Tables
-- Created: 2025-11-16
-- Description: Creates tables for IP whitelisting functionality
-- =============================================================

-- Create admin_ip_whitelist_settings table
CREATE TABLE IF NOT EXISTS public.admin_ip_whitelist_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default settings
INSERT INTO public.admin_ip_whitelist_settings (id, enabled)
VALUES ('global', false)
ON CONFLICT (id) DO NOTHING;

-- Create admin_ip_whitelist table
CREATE TABLE IF NOT EXISTS public.admin_ip_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_ip_address CHECK (
    -- IPv4 address or CIDR
    ip_address ~* '^([0-9]{1,3}\.){3}[0-9]{1,3}(/[0-9]{1,2})?$'
  )
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_ip_whitelist_enabled
  ON public.admin_ip_whitelist(enabled)
  WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_admin_ip_whitelist_ip
  ON public.admin_ip_whitelist(ip_address);

-- Enable RLS
ALTER TABLE public.admin_ip_whitelist_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_ip_whitelist ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Settings: Only service role can modify
DROP POLICY IF EXISTS "admin_ip_whitelist_settings_service_role" ON public.admin_ip_whitelist_settings;
CREATE POLICY "admin_ip_whitelist_settings_service_role"
  ON public.admin_ip_whitelist_settings
  FOR ALL
  USING (auth.role() = 'service_role');

-- Whitelist: Only super admins can manage
DROP POLICY IF EXISTS "admin_ip_whitelist_super_admin" ON public.admin_ip_whitelist;
CREATE POLICY "admin_ip_whitelist_super_admin"
  ON public.admin_ip_whitelist
  FOR ALL
  USING (public.is_super_admin(auth.uid()));

-- Grant permissions
GRANT SELECT ON public.admin_ip_whitelist_settings TO authenticated;
GRANT SELECT ON public.admin_ip_whitelist TO authenticated;
GRANT ALL ON public.admin_ip_whitelist_settings TO service_role;
GRANT ALL ON public.admin_ip_whitelist TO service_role;

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_admin_ip_whitelist_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_admin_ip_whitelist_settings_timestamp
  BEFORE UPDATE ON public.admin_ip_whitelist_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_admin_ip_whitelist_settings_updated_at();

CREATE OR REPLACE FUNCTION public.update_admin_ip_whitelist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_admin_ip_whitelist_timestamp
  BEFORE UPDATE ON public.admin_ip_whitelist
  FOR EACH ROW
  EXECUTE FUNCTION public.update_admin_ip_whitelist_updated_at();

-- Add comments
COMMENT ON TABLE public.admin_ip_whitelist_settings IS 'Global settings for admin IP whitelisting feature. When enabled, only whitelisted IPs can access admin panel.';
COMMENT ON TABLE public.admin_ip_whitelist IS 'Whitelist of IP addresses and CIDR ranges allowed to access the admin panel when IP whitelisting is enabled.';

-- =============================================================
-- ADMIN SECURITY ENHANCEMENTS COMPLETE ✅
-- =============================================================
-- Migration 002: Added 'access_admin_panel' permission
--   - Now required for all admin access
--   - Automatically assigned to Super Admin role
--   - Can be manually added to other roles
--
-- Migration 003: Added IP Whitelist tables
--   - admin_ip_whitelist_settings: Global enable/disable
--   - admin_ip_whitelist: Whitelist entries with CIDR support
--   - Full RLS protection (Super Admin only)
--   - Automated updated_at triggers
-- =============================================================

COMMIT;

-- =============================================================
-- MIGRATION 004: Assign RBAC roles to existing users
-- Created: 2025-11-16
-- Description: Assigns role_id to all existing users who don't have one yet
--              This is CRITICAL for the RBAC system to work properly
-- =============================================================

-- Assign Member role to ALL users who don't have a role_id yet
UPDATE public.profiles
SET
  role_id = (SELECT id FROM public.roles WHERE name = 'Member' AND is_system_role = true LIMIT 1),
  updated_at = NOW()
WHERE role_id IS NULL;

-- IMPORTANT: After running this migration, manually set your admin user(s):
-- UPDATE public.profiles
-- SET role_id = (SELECT id FROM public.roles WHERE name = 'Super Admin' AND is_system_role = true LIMIT 1)
-- WHERE email = 'your-email@example.com';

-- =============================================================
-- RBAC SYSTEM NOW FULLY FUNCTIONAL ✅
-- =============================================================
-- Migration 004: Assigned Member role to all existing users
--   - All users without role_id now have Member role
--   - Admin users must be manually upgraded by updating their email
--   - New users will automatically get Member role via trigger
--
-- The handle_new_user() trigger has been updated to automatically
-- assign the Member role to new users, so no manual intervention
-- is needed for future user registrations.
--
-- To make a user admin, run:
-- UPDATE public.profiles
-- SET role_id = (SELECT id FROM public.roles WHERE name = 'Super Admin')
-- WHERE email = 'admin@example.com';
-- =============================================================

-- =============================================================
-- MIGRATION 005: Update Team Section Schema
-- Created: 2025-11-20
-- Description: Updates landing_page_content.team to use new schema
--              Old: {members: [...], featuredMembers: [...]}
--              New: {featuredMemberIds: [...]}
--              Team members now stored in team_page_content table
-- =============================================================

-- Update all existing landing_page_content records
UPDATE landing_page_content
SET team = jsonb_build_object(
  'title', COALESCE(team->>'title', CASE WHEN locale = 'es' THEN 'Conoce Nuestro Equipo' ELSE 'Meet Our Team' END),
  'subtitle', COALESCE(team->>'subtitle', CASE WHEN locale = 'es' THEN 'Las personas detrás de nuestro éxito' ELSE 'The people behind our success' END),
  'featuredMemberIds', COALESCE(team->'featuredMembers', team->'featuredMemberIds', '[]'::jsonb)
)
WHERE team IS NOT NULL;

-- Set default for any null team fields
UPDATE landing_page_content
SET team = jsonb_build_object(
  'title', CASE WHEN locale = 'es' THEN 'Conoce Nuestro Equipo' ELSE 'Meet Our Team' END,
  'subtitle', CASE WHEN locale = 'es' THEN 'Las personas detrás de nuestro éxito' ELSE 'The people behind our success' END,
  'featuredMemberIds', '[]'::jsonb
)
WHERE team IS NULL;

-- =============================================================
-- TEAM SECTION SCHEMA UPDATED ✅
-- =============================================================
-- Migration 005: Updated team section to new schema
--   - Removed members array (now in team_page_content table)
--   - Renamed featuredMembers to featuredMemberIds
--   - Maximum 3 featured members (down from 4)
--   - Preserved existing title and subtitle values
-- =============================================================

-- =============================================================
-- MIGRATION 006: Add Admin RLS Policies for site_mode_settings
-- Created: 2025-11-20
-- Description: Adds RLS policies to allow admins to read and modify
--              ALL site_mode_settings records (not just active ones)
-- =============================================================

-- Create RLS policy to allow users with admin access to read all site_mode_settings records
DROP POLICY IF EXISTS "site_mode_settings_admin_read" ON public.site_mode_settings;
CREATE POLICY "site_mode_settings_admin_read"
  ON public.site_mode_settings
  FOR SELECT
  TO authenticated
  USING (public.has_admin_access(auth.uid()));

-- Create RLS policy to allow users with admin access to update site_mode_settings records
DROP POLICY IF EXISTS "site_mode_settings_admin_update" ON public.site_mode_settings;
CREATE POLICY "site_mode_settings_admin_update"
  ON public.site_mode_settings
  FOR UPDATE
  TO authenticated
  USING (public.has_admin_access(auth.uid()))
  WITH CHECK (public.has_admin_access(auth.uid()));

-- Create RLS policy to allow users with admin access to insert site_mode_settings records
DROP POLICY IF EXISTS "site_mode_settings_admin_insert" ON public.site_mode_settings;
CREATE POLICY "site_mode_settings_admin_insert"
  ON public.site_mode_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_admin_access(auth.uid()));

-- =============================================================
-- SITE MODE SETTINGS ADMIN ACCESS FIXED ✅
-- =============================================================
-- Migration 006: Added admin RLS policies for site_mode_settings
--   - Admins can now read ALL site_mode_settings (not just active)
--   - Admins can update any site_mode_settings record
--   - Admins can insert new site_mode_settings records
--   - Public users can still only read active modes
--   - Service role maintains full access
--
-- This fixes the issue where admins couldn't activate/deactivate
-- site modes from the admin panel because they couldn't read
-- inactive mode records.
-- =============================================================

-- ===========================================
-- APP SETTINGS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  id text PRIMARY KEY DEFAULT 'global',
  max_members_per_level jsonb DEFAULT '[]'::jsonb,
  payout_frequency text DEFAULT 'monthly',
  currency text DEFAULT 'USD',
  currencies jsonb DEFAULT '[]'::jsonb,
  auto_advance_enabled boolean DEFAULT true,
  ecommerce_commission_rate numeric DEFAULT 0.08,
  team_levels_visible integer DEFAULT 2,
  store_owner_discount_type text DEFAULT 'fixed',
  store_owner_discount_value numeric DEFAULT 0,
  direct_sponsor_commission_rate numeric DEFAULT 0,
  network_commission_rate numeric DEFAULT 0,
  reward_credit_label_en text DEFAULT 'Reward Credits',
  reward_credit_label_es text DEFAULT 'Créditos de Recompensa',
  free_product_label_en text DEFAULT 'Free Product Value',
  free_product_label_es text DEFAULT 'Valor de Producto Gratis',
  affiliate_commission_rate numeric DEFAULT 0.10,
  affiliate_direct_sponsor_commission_rate numeric DEFAULT 0.05,
  affiliate_general_sponsor_commission_rate numeric DEFAULT 0.02,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Allow admin read" ON public.app_settings;
CREATE POLICY "Allow admin read" ON public.app_settings FOR SELECT USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Allow admin update" ON public.app_settings;
CREATE POLICY "Allow admin update" ON public.app_settings FOR UPDATE USING (public.is_super_admin(auth.uid()));

-- ===========================================
-- NAVIGATION CONFIG TABLE
-- Stores navigation configuration for different page types (main, affiliate, mlm)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.navigation_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    locale VARCHAR(10) NOT NULL DEFAULT 'es',
    config_type VARCHAR(20) NOT NULL DEFAULT 'main',
    header_config JSONB NOT NULL DEFAULT '{
        "navigationLinks": [],
        "primaryAction": null,
        "secondaryAction": null,
        "showCart": true,
        "showUserMenu": true,
        "allowCustomLogo": true,
        "allowCustomStoreName": true
    }'::jsonb,
    footer_config JSONB NOT NULL DEFAULT '{
        "showFooter": true,
        "navigationLinks": [],
        "legalLinks": [],
        "inheritSocialLinks": true,
        "showBranding": true,
        "showLanguageSwitcher": true,
        "showThemeSwitcher": true,
        "tagline": null,
        "copyrightText": null
    }'::jsonb,
    global_settings JSONB NOT NULL DEFAULT '{
        "allowCustomBanner": true,
        "allowCustomStoreTitle": true,
        "defaultBannerUrl": null,
        "showPoweredByBadge": true,
        "poweredByPosition": "footer"
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT navigation_config_locale_type_unique UNIQUE (locale, config_type)
);

COMMENT ON TABLE public.navigation_config IS 'Stores navigation configuration for different page types (main, affiliate, mlm)';
COMMENT ON COLUMN public.navigation_config.locale IS 'Language locale for this configuration';
COMMENT ON COLUMN public.navigation_config.config_type IS 'Type of pages this config applies to: main, affiliate, or mlm';
COMMENT ON COLUMN public.navigation_config.header_config IS 'JSON configuration for header navigation and actions';
COMMENT ON COLUMN public.navigation_config.footer_config IS 'JSON configuration for footer links and settings';
COMMENT ON COLUMN public.navigation_config.global_settings IS 'Global settings for page customization options';

CREATE INDEX IF NOT EXISTS idx_navigation_config_locale_type ON public.navigation_config (locale, config_type);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_navigation_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_navigation_config_updated_at ON public.navigation_config;
CREATE TRIGGER trigger_navigation_config_updated_at
    BEFORE UPDATE ON public.navigation_config
    FOR EACH ROW
    EXECUTE FUNCTION public.update_navigation_config_updated_at();

-- RLS Policies
ALTER TABLE public.navigation_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read navigation config" ON public.navigation_config;
CREATE POLICY "Anyone can read navigation config"
    ON public.navigation_config
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can manage navigation config" ON public.navigation_config;
CREATE POLICY "Admins can manage navigation config"
    ON public.navigation_config
    FOR ALL
    USING (public.has_admin_access(auth.uid()))
    WITH CHECK (public.has_admin_access(auth.uid()));

GRANT SELECT ON public.navigation_config TO authenticated;
GRANT SELECT ON public.navigation_config TO anon;
GRANT ALL ON public.navigation_config TO service_role;

-- Insert default configurations
INSERT INTO public.navigation_config (locale, config_type) VALUES ('es', 'main') ON CONFLICT (locale, config_type) DO NOTHING;
INSERT INTO public.navigation_config (locale, config_type) VALUES ('en', 'main') ON CONFLICT (locale, config_type) DO NOTHING;
INSERT INTO public.navigation_config (locale, config_type) VALUES ('es', 'affiliate') ON CONFLICT (locale, config_type) DO NOTHING;
INSERT INTO public.navigation_config (locale, config_type) VALUES ('en', 'affiliate') ON CONFLICT (locale, config_type) DO NOTHING;
INSERT INTO public.navigation_config (locale, config_type) VALUES ('es', 'mlm') ON CONFLICT (locale, config_type) DO NOTHING;
INSERT INTO public.navigation_config (locale, config_type) VALUES ('en', 'mlm') ON CONFLICT (locale, config_type) DO NOTHING;

-- ===========================================
-- AFFILIATE OPPORTUNITY CONTENT TABLE
-- Stores affiliate opportunity section content for landing page (per locale)
-- ===========================================
CREATE TABLE IF NOT EXISTS public.affiliate_opportunity_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    locale VARCHAR(10) NOT NULL UNIQUE,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL,
    description TEXT,
    benefits JSONB NOT NULL DEFAULT '[]'::jsonb,
    commission_rate TEXT,
    commission_label TEXT,
    cta_text TEXT NOT NULL,
    cta_link TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.affiliate_opportunity_content IS 'Stores affiliate opportunity section content for landing page promotion';
COMMENT ON COLUMN public.affiliate_opportunity_content.locale IS 'Language locale for this content (en, es)';
COMMENT ON COLUMN public.affiliate_opportunity_content.is_enabled IS 'Whether to show this section on the landing page';
COMMENT ON COLUMN public.affiliate_opportunity_content.title IS 'Section title';
COMMENT ON COLUMN public.affiliate_opportunity_content.subtitle IS 'Section subtitle';
COMMENT ON COLUMN public.affiliate_opportunity_content.description IS 'Optional detailed description';
COMMENT ON COLUMN public.affiliate_opportunity_content.benefits IS 'JSON array of benefits with id, icon, title, description, order';
COMMENT ON COLUMN public.affiliate_opportunity_content.commission_rate IS 'Display text for commission rate (e.g., "15%", "Up to 20%")';
COMMENT ON COLUMN public.affiliate_opportunity_content.commission_label IS 'Label for commission (e.g., "Commission per sale")';
COMMENT ON COLUMN public.affiliate_opportunity_content.cta_text IS 'Call to action button text';
COMMENT ON COLUMN public.affiliate_opportunity_content.cta_link IS 'Call to action link URL';
COMMENT ON COLUMN public.affiliate_opportunity_content.image_url IS 'Optional image URL for the section';

CREATE INDEX IF NOT EXISTS idx_affiliate_opportunity_content_locale ON public.affiliate_opportunity_content (locale);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_affiliate_opportunity_content_updated_at ON public.affiliate_opportunity_content;
CREATE TRIGGER trigger_affiliate_opportunity_content_updated_at
    BEFORE UPDATE ON public.affiliate_opportunity_content
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- RLS Policies
ALTER TABLE public.affiliate_opportunity_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read affiliate opportunity content" ON public.affiliate_opportunity_content;
CREATE POLICY "Anyone can read affiliate opportunity content"
    ON public.affiliate_opportunity_content
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins can manage affiliate opportunity content" ON public.affiliate_opportunity_content;
CREATE POLICY "Admins can manage affiliate opportunity content"
    ON public.affiliate_opportunity_content
    FOR ALL
    USING (public.has_admin_access(auth.uid()))
    WITH CHECK (public.has_admin_access(auth.uid()));

DROP POLICY IF EXISTS "Service role full access affiliate opportunity" ON public.affiliate_opportunity_content;
CREATE POLICY "Service role full access affiliate opportunity"
    ON public.affiliate_opportunity_content
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

GRANT SELECT ON public.affiliate_opportunity_content TO authenticated;
GRANT SELECT ON public.affiliate_opportunity_content TO anon;
GRANT ALL ON public.affiliate_opportunity_content TO service_role;

-- Insert default content for each locale
INSERT INTO public.affiliate_opportunity_content (locale, is_enabled, title, subtitle, cta_text, cta_link, benefits)
VALUES 
  (
    'es',
    true,
    'Programa de Afiliados',
    'Gana comisiones promocionando nuestros productos',
    'Únete Ahora',
    '/register',
    '[
      {"id": "benefit-1", "icon": "gift", "title": "Comisiones Atractivas", "description": "Gana hasta un 15% de comisión por cada venta referida", "order": 0},
      {"id": "benefit-2", "icon": "store", "title": "Tu Propia Tienda", "description": "Obtén tu tienda personalizada con tu propio enlace", "order": 1},
      {"id": "benefit-3", "icon": "trending-up", "title": "Sin Límites", "description": "No hay límite en cuánto puedes ganar", "order": 2}
    ]'::jsonb
  ),
  (
    'en',
    true,
    'Affiliate Program',
    'Earn commissions by promoting our products',
    'Join Now',
    '/register',
    '[
      {"id": "benefit-1", "icon": "gift", "title": "Attractive Commissions", "description": "Earn up to 15% commission on every referred sale", "order": 0},
      {"id": "benefit-2", "icon": "store", "title": "Your Own Store", "description": "Get your personalized store with your own link", "order": 1},
      {"id": "benefit-3", "icon": "trending-up", "title": "No Limits", "description": "There is no limit on how much you can earn", "order": 2}
    ]'::jsonb
  )
ON CONFLICT (locale) DO NOTHING;

-- =============================================================
-- SECURITY REPORT SCHEDULES TABLE
-- =============================================================
-- Stores scheduled security report configurations

CREATE TABLE IF NOT EXISTS public.security_report_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  recipients TEXT[] NOT NULL DEFAULT '{}',
  format TEXT NOT NULL DEFAULT 'email' CHECK (format IN ('email', 'json', 'csv')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sent_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only allow one active schedule per frequency
CREATE UNIQUE INDEX IF NOT EXISTS idx_security_report_schedules_active_frequency 
  ON public.security_report_schedules (frequency) 
  WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.security_report_schedules ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins can access
DROP POLICY IF EXISTS "Admins can manage security report schedules" ON public.security_report_schedules;
CREATE POLICY "Admins can manage security report schedules"
  ON public.security_report_schedules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() 
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- Service role full access
DROP POLICY IF EXISTS "Service role full access security report schedules" ON public.security_report_schedules;
CREATE POLICY "Service role full access security report schedules"
  ON public.security_report_schedules
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT ON public.security_report_schedules TO authenticated;
GRANT ALL ON public.security_report_schedules TO service_role;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_security_report_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_security_report_schedules_updated_at ON public.security_report_schedules;
CREATE TRIGGER trigger_update_security_report_schedules_updated_at
  BEFORE UPDATE ON public.security_report_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_security_report_schedules_updated_at();

-- Comment
COMMENT ON TABLE public.security_report_schedules IS 'Stores scheduled security report configurations for automatic email delivery';

-- =============================================================
-- AFFILIATE PAGE SETTINGS TABLE
-- =============================================================
-- Stores global configuration for affiliate personalized pages

CREATE TABLE IF NOT EXISTS public.affiliate_page_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT affiliate_page_settings_id_check CHECK (id = 'global')
);

-- Add comment to table
COMMENT ON TABLE public.affiliate_page_settings IS 'Global configuration for affiliate personalized pages including header, footer, and customization settings';

-- Add comments to columns
COMMENT ON COLUMN public.affiliate_page_settings.id IS 'Always "global" - single row table for global settings';
COMMENT ON COLUMN public.affiliate_page_settings.config IS 'JSON configuration object containing header, footer, and settings';
COMMENT ON COLUMN public.affiliate_page_settings.created_at IS 'Timestamp when the configuration was first created';
COMMENT ON COLUMN public.affiliate_page_settings.updated_at IS 'Timestamp when the configuration was last updated';

-- Create index on updated_at for cache invalidation
CREATE INDEX IF NOT EXISTS idx_affiliate_page_settings_updated_at 
  ON public.affiliate_page_settings(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE public.affiliate_page_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to affiliate page settings" ON public.affiliate_page_settings;
DROP POLICY IF EXISTS "Allow admin update access to affiliate page settings" ON public.affiliate_page_settings;

-- Policy: Allow public read access (for rendering affiliate pages)
CREATE POLICY "Allow public read access to affiliate page settings"
  ON public.affiliate_page_settings
  FOR SELECT
  USING (true);

-- Policy: Allow admin update access (requires manage_content permission)
CREATE POLICY "Allow admin update access to affiliate page settings"
  ON public.affiliate_page_settings
  FOR ALL
  USING (public.has_permission(auth.uid(), 'manage_content'));

-- Insert default configuration if not exists
INSERT INTO public.affiliate_page_settings (id, config)
VALUES (
  'global',
  '{
    "header": {
      "navigationLinks": [],
      "showCart": true,
      "showUserMenu": true,
      "allowCustomLogo": true,
      "allowCustomStoreName": true
    },
    "footer": {
      "showFooter": true,
      "navigationLinks": [],
      "legalLinks": [],
      "inheritSocialLinks": true,
      "showBranding": true,
      "showLanguageSwitcher": true,
      "showThemeSwitcher": true
    },
    "settings": {
      "allowCustomBanner": true,
      "allowCustomStoreTitle": true,
      "showPoweredByBadge": true,
      "poweredByPosition": "footer"
    }
  }'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_affiliate_page_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_affiliate_page_settings_updated_at ON public.affiliate_page_settings;
CREATE TRIGGER trigger_update_affiliate_page_settings_updated_at
  BEFORE UPDATE ON public.affiliate_page_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_affiliate_page_settings_updated_at();


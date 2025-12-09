'use client';

import { use, useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AuthGuard from '@/components/auth-guard';
import { useToast } from '@/hooks/use-toast';
import { useAppDictionary } from '@/contexts/locale-content-context';
import { supabase, getSafeSession as _getSafeSession } from '@/lib/supabase';
import { ArrowLeft, Upload, X, Store } from 'lucide-react';
import Image from 'next/image';
import { validateBannerUrl, validateLogoUrl } from '@/lib/security/validate-url';

interface AffiliateStoreSettingsPageProps {
  params: Promise<{
    lang: Locale;
    referralCode: string;
  }>;
}

export default function AffiliateStoreSettingsPage({ params }: AffiliateStoreSettingsPageProps) {
  const { lang, referralCode } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const dict = useAppDictionary();
  const storeErrors = dict.settings?.sections?.store?.errors;
  const bannerFileInputRef = useRef<HTMLInputElement>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [storeTitle, setStoreTitle] = useState('');
  const [storeSlug, setStoreSlug] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<{ type: 'unauthorized' | 'subscription' | 'waitlisted'; message: string } | null>(null);

  // ✅ SECURITY: Validate ownership AND subscription using server-side API
  useEffect(() => {
    const checkOwnershipAndSubscription = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          setLoading(false);
          return;
        }

        setUserId(session.user.id);

        // Use server-side validation endpoint for security
        const response = await fetch(`/api/affiliate/${referralCode}/validate-ownership`);
        const data = await response.json();

        if (!response.ok) {
          console.warn('[SECURITY] Ownership validation failed:', data);
          
          // Handle specific error cases - messages will be set from dict in render
          if (data.requiresSubscription) {
            setAccessError({
              type: 'subscription',
              message: '', // Will use dict in render
            });
          } else if (data.waitlisted) {
            setAccessError({
              type: 'waitlisted',
              message: '', // Will use dict in render
            });
          } else {
            setAccessError({
              type: 'unauthorized',
              message: '', // Will use dict in render
            });
          }
          setLoading(false);
          return;
        }

        if (data.valid) {
          setIsOwner(true);

          // Load existing store settings from profile
          const { data: profileData, error: profileDataError } = await supabase
            .from('profiles')
            .select('affiliate_store_title, affiliate_store_slug, affiliate_store_banner_url, affiliate_store_logo_url')
            .eq('id', session.user.id)
            .single();

          if (!profileDataError && profileData) {
            setStoreTitle(profileData.affiliate_store_title || '');
            setStoreSlug(profileData.affiliate_store_slug || '');
            setBannerUrl(profileData.affiliate_store_banner_url || '');
            setLogoUrl(profileData.affiliate_store_logo_url || '');
          }
        }
      } catch (error) {
        console.error('Error checking ownership and subscription:', error);
        router.push(`/${lang}/dashboard`);
      } finally {
        setLoading(false);
      }
    };

    checkOwnershipAndSubscription();
  }, [referralCode, lang, router]);

  const handleBannerUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

    setUploadingBanner(true);

    // ✅ SECURITY: Validate file against server-configured upload limits
    try {
      const validationResponse = await fetch('/api/upload/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          size: file.size,
          type: file.type,
          category: 'image',
        }),
      });

      const validationResult = await validationResponse.json();

      if (!validationResult.valid) {
        toast({
          title: 'Error',
          description: validationResult.error || 'File validation failed.',
          variant: 'destructive',
        });
        setUploadingBanner(false);
        return;
      }
    } catch (validationError) {
      console.error('Error validating file:', validationError);
      toast({
        title: 'Error',
        description: 'Failed to validate file. Please try again.',
        variant: 'destructive',
      });
      setUploadingBanner(false);
      return;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `affiliate-banners/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('public-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('public-assets')
        .getPublicUrl(filePath);

      setBannerUrl(publicUrl);

      toast({
        title: 'Success',
        description: 'Banner uploaded successfully',
      });
    } catch (error) {
      console.error('Error uploading banner:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload banner',
        variant: 'destructive',
      });
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

    setUploadingLogo(true);

    // ✅ SECURITY: Validate file against server-configured upload limits
    try {
      const validationResponse = await fetch('/api/upload/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          size: file.size,
          type: file.type,
          category: 'image',
        }),
      });

      const validationResult = await validationResponse.json();

      if (!validationResult.valid) {
        toast({
          title: 'Error',
          description: validationResult.error || 'File validation failed.',
          variant: 'destructive',
        });
        setUploadingLogo(false);
        return;
      }
    } catch (validationError) {
      console.error('Error validating file:', validationError);
      toast({
        title: 'Error',
        description: 'Failed to validate file. Please try again.',
        variant: 'destructive',
      });
      setUploadingLogo(false);
      return;
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-logo-${Date.now()}.${fileExt}`;
      const filePath = `affiliate-logos/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('public-assets')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('public-assets')
        .getPublicUrl(filePath);

      setLogoUrl(publicUrl);

      toast({
        title: 'Success',
        description: 'Logo uploaded successfully',
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload logo',
        variant: 'destructive',
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveBanner = () => {
    setBannerUrl('');
  };

  const handleRemoveLogo = () => {
    setLogoUrl('');
  };

  const handleSave = async () => {
    if (!userId) return;

    setSaving(true);

    try {
      // ✅ SECURITY: Validate banner URL client-side first
      if (bannerUrl) {
        const bannerValidation = validateBannerUrl(bannerUrl);
        if (!bannerValidation.valid) {
          toast({
            title: 'Invalid Banner URL',
            description: bannerValidation.error || 'Banner URL is not valid',
            variant: 'destructive',
          });
          setSaving(false);
          return;
        }
        // Use sanitized URL
        setBannerUrl(bannerValidation.sanitized || '');
      }

      // ✅ SECURITY: Validate logo URL client-side first
      if (logoUrl) {
        const logoValidation = validateLogoUrl(logoUrl);
        if (!logoValidation.valid) {
          toast({
            title: 'Invalid Logo URL',
            description: logoValidation.error || 'Logo URL is not valid',
            variant: 'destructive',
          });
          setSaving(false);
          return;
        }
        // Use sanitized URL
        setLogoUrl(logoValidation.sanitized || '');
      }

      // ✅ SECURITY FIX: Call server-side endpoint with subscription revalidation and CSRF token
      const { addCsrfTokenToHeaders } = await import('@/lib/utils/admin-csrf-helpers');
      const headers = await addCsrfTokenToHeaders({
        'Content-Type': 'application/json',
      });

      const response = await fetch('/api/affiliate/store-settings', {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          storeTitle: storeTitle || null,
          bannerUrl: bannerUrl || null,
          logoUrl: logoUrl || null,
          referralCode,
          storeSlug: storeSlug ? storeSlug : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }

      toast({
        title: 'Success',
        description: 'Store settings saved successfully',
      });

      // Redirect back to affiliate store
      router.push(`/${lang}/affiliate/${referralCode}`);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save settings',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AuthGuard lang={lang}>
        <div className="container mx-auto px-4 py-12">
          <div className="text-center">Loading...</div>
        </div>
      </AuthGuard>
    );
  }

  // Show access error if validation failed
  if (accessError || !isOwner) {
    return (
      <AuthGuard lang={lang}>
        <div className="container mx-auto px-4 py-12">
          <Card className="mx-auto max-w-2xl border-destructive/50">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <Store className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-xl">
                {accessError?.type === 'subscription' 
                  ? storeErrors?.subscriptionRequired
                  : accessError?.type === 'waitlisted'
                  ? storeErrors?.accountWaitlisted
                  : storeErrors?.accessDenied}
              </CardTitle>
              <CardDescription className="text-base mt-2">
                {accessError?.type === 'subscription'
                  ? storeErrors?.needsSubscription
                  : accessError?.type === 'waitlisted'
                  ? storeErrors?.waitlistedMessage
                  : storeErrors?.noPermission}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {accessError?.type === 'subscription' && (
                <Button 
                  onClick={() => router.push(`/${lang}/subscription`)}
                  className="w-full"
                >
                  {storeErrors?.viewPlans}
                </Button>
              )}
              <Button 
                variant="outline"
                onClick={() => router.push(`/${lang}/affiliate/${referralCode}`)}
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {storeErrors?.backToStore}
              </Button>
            </CardContent>
          </Card>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard lang={lang}>
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          {/* Back Button */}
          <Button
            variant="ghost"
            onClick={() => router.push(`/${lang}/affiliate/${referralCode}/settings`)}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Settings
          </Button>

          <Card>
            <CardHeader>
              <CardTitle>Store Customization</CardTitle>
              <CardDescription>
                Personalize your affiliate store with a custom title and banner image
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Store Title */}
              <div className="space-y-2">
                <Label htmlFor="store-title">Store Title</Label>
                <Input
                  id="store-title"
                  value={storeTitle}
                  onChange={(e) => setStoreTitle(e.target.value)}
                  placeholder="My Awesome Store"
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">
                  This title will appear at the top of your affiliate store page
                </p>
              </div>

              {/* Store URL slug */}
              <div className="space-y-2">
                <Label htmlFor="store-slug">Store URL</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <Input
                      id="store-slug"
                      value={storeSlug}
                      onChange={(event) => setStoreSlug(event.target.value)}
                      placeholder="my-store"
                      maxLength={30}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Use 3-30 lowercase letters, numbers, and hyphens. Leave empty to use your referral code.
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground sm:w-64">
                    <span className="font-mono text-[11px]">
                      /{lang}/affiliate/{storeSlug || referralCode}
                    </span>
                  </div>
                </div>
              </div>

              {/* Logo Image */}
              <div className="space-y-2">
                <Label>Store Logo</Label>

                {logoUrl ? (
                  <div className="relative">
                    <div className="relative h-24 w-24 overflow-hidden rounded-lg border bg-white">
                      <Image
                        src={logoUrl}
                        alt="Store logo"
                        fill
                        className="object-contain p-2"
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleRemoveLogo}
                      className="mt-2"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Remove Logo
                    </Button>
                  </div>
                ) : (
                  <div
                    onClick={() => logoFileInputRef.current?.click()}
                    className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 transition-colors hover:border-muted-foreground/50 hover:bg-muted"
                  >
                    <Upload className="h-6 w-6 text-muted-foreground" />
                    <p className="mt-1 text-xs text-muted-foreground">Upload</p>
                  </div>
                )}

                <input
                  ref={logoFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  disabled={uploadingLogo}
                  aria-label="Upload store logo image"
                />

                <p className="text-xs text-muted-foreground">
                  Upload a logo for your store header (recommended: square image, max 2MB)
                </p>
              </div>

              {/* Banner Image */}
              <div className="space-y-2">
                <Label>Banner Image</Label>

                {bannerUrl ? (
                  <div className="relative">
                    <div className="relative aspect-[3/1] w-full overflow-hidden rounded-lg border">
                      <Image
                        src={bannerUrl}
                        alt="Store banner"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleRemoveBanner}
                      className="mt-2"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Remove Banner
                    </Button>
                  </div>
                ) : (
                  <div
                    onClick={() => bannerFileInputRef.current?.click()}
                    className="flex aspect-[3/1] w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 transition-colors hover:border-muted-foreground/50 hover:bg-muted"
                  >
                    <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">
                      Click to upload banner
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Recommended: 1200x400px, max 5MB
                    </p>
                  </div>
                )}

                <input
                  ref={bannerFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBannerUpload}
                  className="hidden"
                  disabled={uploadingBanner}
                  aria-label="Upload store banner image"
                />

                <p className="text-xs text-muted-foreground">
                  Upload a banner image to make your store stand out
                </p>
              </div>

              {/* Save Button */}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => router.push(`/${lang}/affiliate/${referralCode}/settings`)}
                  disabled={saving || uploadingBanner || uploadingLogo}
                >
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving || uploadingBanner || uploadingLogo}>
                  {saving ? 'Saving...' : (uploadingBanner || uploadingLogo) ? 'Uploading...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthGuard>
  );
}


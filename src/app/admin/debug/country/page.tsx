"use client";

import { useEffect, useState, useCallback } from "react";
import { DevOnlyGuard } from "@/components/dev-only-guard";
import { useSupabaseUser } from "@/modules/auth/hooks/use-supabase-user";
import { useCurrentUserCountry } from "@/modules/profile/hooks/use-current-user-country";
import { useCountryCartAvailability } from "@/modules/products/hooks/use-country-cart-availability";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default function DebugCountryPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useSupabaseUser();
  const {
    country: userCountry,
    isLoading: countryLoading,
    error: countryError,
    refresh,
    isAutoDetecting
  } = useCurrentUserCountry({
    userId: user?.id ?? null,
    isAuthenticated,
    isAuthLoading: authLoading,
    autoDetect: true, // Enable auto-detection
  });
  const { allowed: isCartAllowed, isLoading: cartLoading, error: cartError, source } = useCountryCartAvailability(
    userCountry,
    { enabled: isAuthenticated && !authLoading && !countryLoading }
  );

  const [profileData, setProfileData] = useState<any>(null);
  const [productsData, setProductsData] = useState<any[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const loadProfileData = useCallback(async () => {
    if (!user?.id) return;
    setLoadingProfile(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error loading profile:', error);
      } else {
        setProfileData(data);
      }
    } catch (err) {
      console.error('Exception loading profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  }, [user?.id]);

  const loadProductsData = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, slug, cart_visibility_countries')
        .limit(10);
      
      if (error) {
        console.error('Error loading products:', error);
      } else {
        setProductsData(data || []);
      }
    } catch (err) {
      console.error('Exception loading products:', err);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      loadProfileData();
      loadProductsData();
    }
  }, [isAuthenticated, user?.id, loadProfileData, loadProductsData]);

  const StatusIcon = ({ loading, error, value }: { loading: boolean; error: unknown; value: unknown }) => {
    if (loading) return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
    if (error) return <XCircle className="h-5 w-5 text-red-500" />;
    if (value) return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    return <XCircle className="h-5 w-5 text-gray-400" />;
  };

  return (
    <DevOnlyGuard>
      <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Country Detection Debug</h1>
        <Button onClick={() => {
          refresh();
          loadProfileData();
          loadProductsData();
        }} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh All
        </Button>
      </div>

      {/* Authentication Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StatusIcon loading={authLoading} error={null} value={isAuthenticated} />
            Authentication Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="font-medium">Authenticated:</div>
            <div>{isAuthenticated ? <Badge variant="default">Yes</Badge> : <Badge variant="secondary">No</Badge>}</div>
            
            <div className="font-medium">User ID:</div>
            <div className="font-mono text-xs">{user?.id || 'N/A'}</div>
            
            <div className="font-medium">Email:</div>
            <div className="text-xs">{user?.email || 'N/A'}</div>
          </div>
        </CardContent>
      </Card>

      {/* Country Detection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StatusIcon loading={countryLoading} error={countryError} value={userCountry} />
            Country Detection
          </CardTitle>
          <CardDescription>
            Detected from user profile
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="font-medium">Country Code:</div>
            <div>
              {countryLoading ? (
                <Badge variant="outline">Loading...</Badge>
              ) : userCountry ? (
                <Badge variant="default" className="font-mono">{userCountry}</Badge>
              ) : (
                <Badge variant="destructive">Not Set</Badge>
              )}
            </div>
            
            <div className="font-medium">Loading:</div>
            <div>{countryLoading ? 'Yes' : 'No'}</div>

            <div className="font-medium">Auto-Detecting:</div>
            <div>
              {isAutoDetecting ? (
                <Badge variant="outline" className="gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Detecting...
                </Badge>
              ) : (
                'No'
              )}
            </div>

            <div className="font-medium">Error:</div>
            <div className="text-xs text-red-500">{countryError?.message || 'None'}</div>
          </div>
        </CardContent>
      </Card>

      {/* Cart Availability */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StatusIcon loading={cartLoading} error={cartError} value={isCartAllowed} />
            Cart Availability
          </CardTitle>
          <CardDescription>
            Checks if cart is available for user&apos;s country
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="font-medium">Allowed:</div>
            <div>
              {cartLoading ? (
                <Badge variant="outline">Checking...</Badge>
              ) : isCartAllowed ? (
                <Badge variant="default">Yes</Badge>
              ) : (
                <Badge variant="destructive">No</Badge>
              )}
            </div>
            
            <div className="font-medium">Source:</div>
            <div><Badge variant="outline">{source}</Badge></div>
            
            <div className="font-medium">Loading:</div>
            <div>{cartLoading ? 'Yes' : 'No'}</div>
            
            <div className="font-medium">Error:</div>
            <div className="text-xs text-red-500">{cartError?.message || 'None'}</div>
          </div>
        </CardContent>
      </Card>

      {/* Profile Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StatusIcon loading={loadingProfile} error={null} value={profileData} />
            Profile Data (Raw)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingProfile ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading profile...
            </div>
          ) : profileData ? (
            <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-64">
              {JSON.stringify(profileData, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">No profile data loaded</p>
          )}
        </CardContent>
      </Card>

      {/* Products Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StatusIcon loading={loadingProducts} error={null} value={productsData.length > 0} />
            Products with Country Restrictions
          </CardTitle>
          <CardDescription>
            First 10 products showing cart_visibility_countries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingProducts ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading products...
            </div>
          ) : productsData.length > 0 ? (
            <div className="space-y-3">
              {productsData.map((product) => (
                <div key={product.id} className="border rounded-md p-3 space-y-2">
                  <div className="font-medium text-sm">{product.name}</div>
                  <div className="text-xs text-muted-foreground">Slug: {product.slug}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">Countries:</span>
                    {product.cart_visibility_countries && product.cart_visibility_countries.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {product.cart_visibility_countries.map((country: string) => (
                          <Badge 
                            key={country} 
                            variant={country === userCountry ? "default" : "outline"}
                            className="text-xs"
                          >
                            {country}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <Badge variant="secondary" className="text-xs">No countries set</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No products loaded</p>
          )}
        </CardContent>
      </Card>
      </div>
    </DevOnlyGuard>
  );
}

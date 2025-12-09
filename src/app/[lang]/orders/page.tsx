'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Package, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSupabaseUser } from '@/modules/auth/hooks/use-supabase-user';
import AuthGuard from '@/components/auth-guard';
import type { Locale } from '@/i18n/config';

interface OrdersPageProps {
  params: Promise<{ lang: Locale }>;
  searchParams: Promise<{ order_id?: string; status?: string }>;
}

interface OrderItem {
  id: string;
  product_id: string | null;
  qty: number;
  price_cents: number;
  product?: {
    name: string | null;
  } | null;
}

interface Order {
  id: string;
  status: string;
  total_cents: number;
  tax_cents: number;
  shipping_cents: number;
  discount_cents: number;
  currency: string;
  gateway: string | null;
  created_at: string;
  items: OrderItem[];
}

export default function OrdersPage({ params, searchParams }: OrdersPageProps) {
  const [lang, setLang] = useState<Locale>('en');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { user } = useSupabaseUser();

  useEffect(() => {
    Promise.all([params, searchParams]).then(([p, sp]) => {
      setLang(p.lang);
      setOrderId(sp.order_id || null);
    });
  }, [params, searchParams]);

  useEffect(() => {
    if (!orderId || !user) return;

    const fetchOrder = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select(`
            id,
            status,
            total_cents,
            tax_cents,
            shipping_cents,
            discount_cents,
            currency,
            gateway,
            created_at,
            items:order_items(
              id,
              product_id,
              qty,
              price_cents,
              product:products(name)
            )
          `)
          .eq('id', orderId)
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('[OrdersPage] Error fetching order:', error);
          return;
        }

        // Transform the data to match the Order type
        const transformedData: Order = {
          ...data,
          items: data.items.map((item: any) => ({
            ...item,
            product: Array.isArray(item.product) && item.product.length > 0
              ? item.product[0]
              : null
          }))
        };

        setOrder(transformedData);
      } catch (err) {
        console.error('[OrdersPage] Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, user]);

  const formatCurrency = (cents: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(cents / 100);
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  if (!orderId) {
    return (
      <AuthGuard lang={lang}>
        <div className="container mx-auto py-8">
          <Card>
            <CardHeader>
              <CardTitle>My Orders</CardTitle>
              <CardDescription>View your order history</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                No order specified. Please check your email for order confirmation links.
              </p>
              <Button
                onClick={() => router.push(`/${lang}/dashboard`)}
                className="mt-4"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </AuthGuard>
    );
  }

  if (loading) {
    return (
      <AuthGuard lang={lang}>
        <div className="container mx-auto py-8">
          <Card>
            <CardContent className="py-8">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            </CardContent>
          </Card>
        </div>
      </AuthGuard>
    );
  }

  if (!order) {
    return (
      <AuthGuard lang={lang}>
        <div className="container mx-auto py-8">
          <Card>
            <CardHeader>
              <CardTitle>Order Not Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                The order you&apos;re looking for could not be found.
              </p>
              <Button
                onClick={() => router.push(`/${lang}/dashboard`)}
                className="mt-4"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard lang={lang}>
      <div className="container mx-auto py-8 max-w-3xl">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl text-green-600 dark:text-green-400">
              Order Confirmed!
            </CardTitle>
            <CardDescription>
              Thank you for your purchase. Your order has been received.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Order Details */}
            <div className="border-t pt-6">
              <h3 className="font-semibold mb-4 flex items-center">
                <Package className="mr-2 h-5 w-5" />
                Order Details
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order ID:</span>
                  <span className="font-mono">{order.id.slice(0, 8)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date:</span>
                  <span>{formatDate(order.created_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="capitalize font-medium">{order.status}</span>
                </div>
                {order.gateway && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Method:</span>
                    <span className="capitalize">{order.gateway}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Order Items */}
            <div className="border-t pt-6">
              <h3 className="font-semibold mb-4">Items</h3>
              <div className="space-y-3">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <div>
                      <span>{item.product?.name || 'Product'}</span>
                      <span className="text-muted-foreground ml-2">× {item.qty}</span>
                    </div>
                    <span>{formatCurrency(item.price_cents * item.qty, order.currency)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Summary */}
            <div className="border-t pt-6">
              <h3 className="font-semibold mb-4">Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span>{formatCurrency(order.total_cents - order.tax_cents - order.shipping_cents + order.discount_cents, order.currency)}</span>
                </div>
                {order.discount_cents > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>Discount:</span>
                    <span>-{formatCurrency(order.discount_cents, order.currency)}</span>
                  </div>
                )}
                {order.shipping_cents > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipping:</span>
                    <span>{formatCurrency(order.shipping_cents, order.currency)}</span>
                  </div>
                )}
                {order.tax_cents > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax:</span>
                    <span>{formatCurrency(order.tax_cents, order.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(order.total_cents, order.currency)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t pt-6 flex gap-4">
              <Button
                onClick={() => router.push(`/${lang}/dashboard`)}
                variant="outline"
                className="flex-1"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
              <Button
                onClick={() => router.push(`/${lang}/products`)}
                className="flex-1"
              >
                Continue Shopping
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthGuard>
  );
}


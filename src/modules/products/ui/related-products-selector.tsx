'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label as _Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { X, Settings } from 'lucide-react';
import type { Product } from '@/lib/models/definitions';

interface RelatedProductsSelectorProps {
  currentProductId?: string;
  selected: string[];
  onChange: (ids: string[]) => void;
  copy: {
    sectionTitle: string;
    sectionDescription: string;
    manageButton: string;
    dialogTitle: string;
    dialogDescription: string;
    searchPlaceholder: string;
    noResults: string;
    emptySummary: string;
    summaryTemplate: string;
    clearAction: string;
    closeAction: string;
  };
}

export function RelatedProductsSelector({
  currentProductId,
  selected,
  onChange,
  copy,
}: RelatedProductsSelectorProps) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!open) return;

    const loadProducts = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/admin/products', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Failed to load products');
        }
        const data = await response.json();
        setProducts(data);
      } catch (error) {
        console.error('Error loading products:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProducts();
  }, [open]);

  const availableProducts = useMemo(() => {
    return products.filter((p) => p.id !== currentProductId);
  }, [products, currentProductId]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) {
      return availableProducts;
    }

    const query = searchQuery.toLowerCase();
    return availableProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.slug.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query)
    );
  }, [availableProducts, searchQuery]);

  const selectedProducts = useMemo(() => {
    return availableProducts.filter((p) => selected.includes(p.id));
  }, [availableProducts, selected]);

  const handleToggle = (productId: string) => {
    if (selected.includes(productId)) {
      onChange(selected.filter((id) => id !== productId));
    } else {
      onChange([...selected, productId]);
    }
  };

  const handleRemove = (productId: string) => {
    onChange(selected.filter((id) => id !== productId));
  };

  const handleClear = () => {
    onChange([]);
  };

  const summaryText = useMemo(() => {
    if (selected.length === 0) {
      return copy.emptySummary;
    }
    return copy.summaryTemplate.replace('{{count}}', selected.length.toString());
  }, [selected.length, copy.emptySummary, copy.summaryTemplate]);

  return (
    <div className="space-y-4 rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 p-4">
      <div className="space-y-1">
        <h3 className="font-headline text-lg font-semibold">{copy.sectionTitle}</h3>
        <p className="text-sm text-muted-foreground">{copy.sectionDescription}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {selectedProducts.map((product) => (
          <Badge key={product.id} variant="secondary" className="gap-1 pr-1">
            {product.name}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-4 w-4 rounded-full p-0 hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => handleRemove(product.id)}
            >
              <X className="h-3 w-3" />
              <span className="sr-only">Remove {product.name}</span>
            </Button>
          </Badge>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{summaryText}</p>
        <div className="flex gap-2">
          {selected.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
              {copy.clearAction}
            </Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <Settings className="mr-2 h-4 w-4" />
                {copy.manageButton}
              </Button>
            </DialogTrigger>
            <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-0 p-0">
              <DialogHeader className="px-6 pt-6">
                <DialogTitle>{copy.dialogTitle}</DialogTitle>
                <DialogDescription>{copy.dialogDescription}</DialogDescription>
              </DialogHeader>

              <div className="flex flex-1 flex-col gap-4 overflow-hidden px-6 pb-6">
                <Input
                  placeholder={copy.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-shrink-0"
                />

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-md border p-4">
                  {loading ? (
                    <p className="text-center text-sm text-muted-foreground">Cargando productos...</p>
                  ) : filteredProducts.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground">{copy.noResults}</p>
                  ) : (
                    filteredProducts.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-start gap-3 rounded-md p-2 hover:bg-muted"
                      >
                        <Checkbox
                          id={`product-${product.id}`}
                          checked={selected.includes(product.id)}
                          onCheckedChange={() => handleToggle(product.id)}
                        />
                        <label
                          htmlFor={`product-${product.id}`}
                          className="flex-1 cursor-pointer space-y-1"
                        >
                          <div className="font-medium">{product.name}</div>
                          <div className="text-xs text-muted-foreground">{product.slug}</div>
                        </label>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex flex-shrink-0 justify-end border-t pt-4">
                  <Button type="button" onClick={() => setOpen(false)}>
                    {copy.closeAction}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}


import type { Product } from '@/lib/models/definitions';

export type ProductEvent =
  | { type: 'product_created'; payload: Product }
  | { type: 'product_updated'; payload: Product }
  | { type: 'product_deleted'; payload: { id: string } }
  | { type: 'products_loaded'; payload: Product[] };

export type ProductObserver = (event: ProductEvent) => void;

export class ProductEventBus {
  private observers = new Set<ProductObserver>();

  subscribe(observer: ProductObserver): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  emit(event: ProductEvent) {
    this.observers.forEach((observer) => {
      observer(event);
    });
  }

  clear() {
    this.observers.clear();
  }
}
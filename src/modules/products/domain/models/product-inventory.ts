export interface ProductInventoryRecord {
  id: string;
  name: string;
  stockQuantity: number;
}

export interface ProductInventorySummary {
  totalStock: number;
  products: ProductInventoryRecord[];
}

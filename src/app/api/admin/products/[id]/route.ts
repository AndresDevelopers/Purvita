import { NextResponse } from 'next/server';
import { withAdminPermission } from '@/lib/auth/with-auth';
import { getAdminClient } from '@/lib/supabase/admin';
import { logUserAction } from '@/lib/services/audit-log-service';

/**
 * DELETE /api/admin/products/[id]
 * Delete a product by ID
 * Requires: manage_products permission
 */
export const DELETE = withAdminPermission('manage_products', async (request: Request, { params }: { params: Promise<{ id: string }> }) => {
    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json(
                { error: 'Product ID is required' },
                { status: 400 }
            );
        }

        const supabaseAdmin = getAdminClient();

        // First, fetch the product to get its data for audit logging and image cleanup
        const { data: productData, error: fetchError } = await supabaseAdmin
            .from('products')
            .select('name, slug, price, images, stock_quantity')
            .eq('id', id)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                return NextResponse.json(
                    { error: 'Product not found' },
                    { status: 404 }
                );
            }
            console.error('Error fetching product for deletion:', fetchError);
            return NextResponse.json(
                { error: `Error fetching product: ${fetchError.message}` },
                { status: 400 }
            );
        }

        // Delete images from storage if product has images
        if (productData?.images && Array.isArray(productData.images) && productData.images.length > 0) {
            const imagePaths = productData.images
                .map((img: { id: string }) => img.id)
                .filter(Boolean);

            if (imagePaths.length > 0) {
                const productsBucket = process.env.NEXT_PUBLIC_SUPABASE_PRODUCTS_BUCKET || 'products';
                const { error: storageError } = await supabaseAdmin.storage
                    .from(productsBucket)
                    .remove(imagePaths);

                if (storageError) {
                    console.warn(`Failed to delete images for product ${id}:`, storageError);
                    // Continue with product deletion even if image deletion fails
                }
            }
        }

        // Delete the product from the database
        const { error: deleteError } = await supabaseAdmin
            .from('products')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error('Error deleting product:', deleteError);
            return NextResponse.json(
                { error: `Error deleting product: ${deleteError.message}` },
                { status: 400 }
            );
        }

        // Log the deletion for audit purposes
        const metadata = productData
            ? {
                name: productData.name,
                slug: productData.slug,
                price: productData.price,
                stock: productData.stock_quantity,
            }
            : { productId: id };

        await logUserAction('PRODUCT_DELETED', 'product', id, metadata);

        return NextResponse.json(
            { success: true, message: 'Product deleted successfully' },
            { status: 200 }
        );
    } catch (error) {
        console.error('API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
});

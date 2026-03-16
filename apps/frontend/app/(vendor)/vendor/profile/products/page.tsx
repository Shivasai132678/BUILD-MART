'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/api';
import { getCategories, getProducts } from '@/lib/catalog-api';
import { addVendorProducts, getVendorProducts, removeVendorProduct, type VendorProduct } from '@/lib/vendor-api';
import { getVendorProfile } from '@/lib/vendor-profile-api';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export default function VendorProductsPage() {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [confirmRemoveProductId, setConfirmRemoveProductId] = useState<string | null>(null);

  const vendorProductsQuery = useQuery({
    queryKey: ['vendor-products'],
    queryFn: getVendorProducts,
  });

  const profileQuery = useQuery({
    queryKey: ['vendor-profile'],
    queryFn: getVendorProfile,
    retry: false,
  });

  const isApproved = profileQuery.data?.status === 'APPROVED';

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories(),
  });

  const productsQuery = useQuery({
    queryKey: ['products', selectedCategory],
    queryFn: () => getProducts({ categoryId: selectedCategory || undefined, limit: 100 }),
    enabled: !!selectedCategory && isAddModalOpen,
  });

  const addProductsMutation = useMutation({
    mutationFn: addVendorProducts,
    onSuccess: () => {
      toast.success('Products added successfully!');
      setIsAddModalOpen(false);
      setSelectedProducts([]);
      setSelectedCategory(null);
      queryClient.invalidateQueries({ queryKey: ['vendor-products'] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to add products'));
    },
  });

  const removeProductMutation = useMutation({
    mutationFn: (productId: string) => removeVendorProduct(productId),
    onSuccess: () => {
      toast.success('Product removed successfully!');
      queryClient.invalidateQueries({ queryKey: ['vendor-products'] });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to remove product'));
    },
  });

  const existingProductIds = vendorProductsQuery.data?.items.map((p) => p.productId) ?? [];

  const availableProducts = productsQuery.data?.items.filter((p) => !existingProductIds.includes(p.id)) ?? [];

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const handleAddProducts = () => {
    if (selectedProducts.length === 0) {
      toast.error('Please select at least one product');
      return;
    }
    addProductsMutation.mutate(selectedProducts);
  };

  const handleRemoveProduct = (productId: string) => {
    setConfirmRemoveProductId(productId);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F0E8]">My Products</h1>
          <p className="text-[#8EA5C0] text-sm mt-1">
            Manage the products you sell. These determine which RFQs you receive.
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          disabled={!isApproved}
          title={!isApproved ? 'Approval required to manage products' : undefined}
          className="inline-flex items-center gap-2 bg-[#3B7FC1] hover:bg-[#2B6FAF] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add Products
        </button>
      </div>

      {/* Approval banner */}
      {!isApproved && !profileQuery.isLoading && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-400 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">pending</span>
          Your vendor profile is pending admin approval. Product management will be available once approved.
        </div>
      )}

      {/* Products List */}
      {vendorProductsQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[#111827] border border-[#1E2A3A] rounded-2xl h-32 animate-pulse" />
          ))}
        </div>
      ) : vendorProductsQuery.isError ? (
        <div className="bg-[#111827] border border-[#1E2A3A] rounded-2xl flex flex-col items-center justify-center py-20 text-center px-6">
          <span className="material-symbols-outlined text-[56px] text-red-400/40 mb-4">error</span>
          <p className="text-base font-medium text-[#F5F0E8]">Failed to load products</p>
          <p className="text-sm text-[#8EA5C0] mt-1 max-w-sm">
            Something went wrong while fetching your products.
          </p>
          <button
            onClick={() => void vendorProductsQuery.refetch()}
            className="mt-6 inline-flex items-center gap-2 bg-[#3B7FC1] hover:bg-[#2B6FAF] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            Retry
          </button>
        </div>
      ) : vendorProductsQuery.data?.items.length === 0 ? (
        <div className="bg-[#111827] border border-[#1E2A3A] rounded-2xl flex flex-col items-center justify-center py-20 text-center px-6">
          <span className="material-symbols-outlined text-[56px] text-[#1E2A3A] mb-4">inventory_2</span>
          <p className="text-base font-medium text-[#F5F0E8]">No products yet</p>
          <p className="text-sm text-[#8EA5C0] mt-1 max-w-sm">
            Add products to your profile to start receiving matching RFQs
          </p>
          <button
            onClick={() => setIsAddModalOpen(true)}
            disabled={!isApproved}
            title={!isApproved ? 'Approval required to manage products' : undefined}
            className="mt-6 inline-flex items-center gap-2 bg-[#3B7FC1] hover:bg-[#2B6FAF] text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Products
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendorProductsQuery.data?.items.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onRemove={() => handleRemoveProduct(product.productId)}
              isRemoving={removeProductMutation.isPending && removeProductMutation.variables === product.productId}
              canManage={isApproved}
            />
          ))}
        </div>
      )}

      {/* Confirm Remove Dialog */}
      <ConfirmDialog
        open={confirmRemoveProductId !== null}
        onClose={() => setConfirmRemoveProductId(null)}
        onConfirm={() => {
          if (confirmRemoveProductId) removeProductMutation.mutate(confirmRemoveProductId);
          setConfirmRemoveProductId(null);
        }}
        title="Remove Product"
        description="Are you sure you want to remove this product from your profile?"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        loading={removeProductMutation.isPending}
      />

      {/* Add Products Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-[#111827] border border-[#1E2A3A] rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E2A3A]">
              <h2 className="text-lg font-semibold text-[#F5F0E8]">Add Products</h2>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setSelectedProducts([]);
                  setSelectedCategory(null);
                }}
                className="text-[#4A6080] hover:text-[#F5F0E8] transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Categories */}
              <div>
                <label className="block text-sm font-medium text-[#8EA5C0] mb-2">
                  Select a category
                </label>
                {categoriesQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-[#4A6080]">
                    <span className="material-symbols-outlined animate-spin">progress_activity</span>
                    Loading...
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {categoriesQuery.data?.items.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setSelectedCategory(cat.id);
                          setSelectedProducts([]);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          selectedCategory === cat.id
                            ? 'bg-[#3B7FC1] text-white'
                            : 'bg-[#1E2A3A] text-[#8EA5C0] hover:bg-[#2A3545]'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Products */}
              {selectedCategory && (
                <div>
                  <label className="block text-sm font-medium text-[#8EA5C0] mb-2">
                    Select products to add ({selectedProducts.length} selected)
                  </label>
                  {productsQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-[#4A6080]">
                      <span className="material-symbols-outlined animate-spin">progress_activity</span>
                      Loading products...
                    </div>
                  ) : availableProducts.length === 0 ? (
                    <p className="text-sm text-[#4A6080]">No available products to add</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                      {availableProducts.map((product) => (
                          <button
                            key={product.id}
                            onClick={() => toggleProductSelection(product.id)}
                            className={`p-3 rounded-xl text-left text-sm transition-colors ${
                              selectedProducts.includes(product.id)
                                ? 'bg-[#3B7FC1]/20 border border-[#3B7FC1] text-white'
                                : 'bg-[#1E2A3A] border border-transparent text-[#8EA5C0] hover:bg-[#2A3545]'
                            }`}
                          >
                            <div className="font-medium">{product.name}</div>
                            <div className="text-xs text-[#4A6080]">{product.unit}</div>
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#1E2A3A]">
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setSelectedProducts([]);
                  setSelectedCategory(null);
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-[#8EA5C0] hover:text-[#F5F0E8] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddProducts}
                disabled={selectedProducts.length === 0 || addProductsMutation.isPending}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-[#3B7FC1] hover:bg-[#2B6FAF] text-white transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {addProductsMutation.isPending && (
                  <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                )}
                Add {selectedProducts.length > 0 && `(${selectedProducts.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductCard({
  product,
  onRemove,
  isRemoving,
  canManage,
}: {
  product: VendorProduct;
  onRemove: () => void;
  isRemoving: boolean;
  canManage: boolean;
}) {
  return (
    <div className="bg-[#111827] border border-[#1E2A3A] rounded-2xl p-4 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-[#F5F0E8] truncate">{product.name}</p>
          <p className="text-xs text-[#4A6080] mt-0.5">
            {product.category.name} • {product.unit}
          </p>
        </div>
        <button
          onClick={onRemove}
          disabled={isRemoving || !canManage}
          title={!canManage ? 'Approval required to manage products' : undefined}
          className="text-[#4A6080] hover:text-red-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isRemoving ? (
            <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined text-[18px]">delete</span>
          )}
        </button>
      </div>
      <div className="mt-3 pt-3 border-t border-[#1E2A3A]">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
              product.stockAvailable
                ? 'bg-green-500/15 text-green-400'
                : 'bg-amber-500/15 text-amber-400'
            }`}
          >
            {product.stockAvailable ? 'In Stock' : 'Out of Stock'}
          </span>
          {product.customPrice && (
            <span className="text-xs text-[#8EA5C0]">₹{product.customPrice}</span>
          )}
        </div>
      </div>
    </div>
  );
}

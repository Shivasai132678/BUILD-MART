'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/api';
import {
  listCategories,
  listAdminProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  createCategory,
  updateCategory,
  deleteCategory,
  uploadProductImage,
  type AdminCategory,
  type AdminProduct,
} from '@/lib/admin-api';

// ─── helpers ────────────────────────────────────────────────

function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');
}

// ─── sub-components ─────────────────────────────────────────

function ImageUploadField({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadProductImage(file);
      onChange(url);
      toast.success('Image uploaded');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Upload failed'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-[#8A9BC0]">Image</label>
      <div className="flex gap-2 items-center">
        <input
          type="text"
          placeholder="https://… (or upload below)"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 rounded-xl bg-[#0C0F1A] border border-[#1E2238] text-sm text-[#F5F0E8] placeholder-[#4A5A80] focus:outline-none focus:border-[#6764f2] transition-colors"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm bg-[#6764f2]/15 hover:bg-[#6764f2]/25 text-[#8B89F8] border border-[#6764f2]/20 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined text-[16px]">upload</span>
          )}
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleFile} />
      </div>
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="preview" className="h-16 w-16 rounded-xl object-cover border border-[#1E2238]" />
      )}
    </div>
  );
}

// ─── Category modal ─────────────────────────────────────────

type CategoryFormState = {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  isActive: boolean;
};

function CategoryModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: AdminCategory;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CategoryFormState>({
    name: initial?.name ?? '',
    slug: initial?.slug ?? '',
    description: initial?.description ?? '',
    imageUrl: initial?.imageUrl ?? '',
    isActive: initial?.isActive ?? true,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      initial
        ? updateCategory(initial.id, {
            name: form.name,
            slug: form.slug,
            description: form.description || undefined,
            imageUrl: form.imageUrl || undefined,
            isActive: form.isActive,
          })
        : createCategory({
            name: form.name,
            slug: form.slug,
            description: form.description || undefined,
            imageUrl: form.imageUrl || undefined,
            isActive: form.isActive,
          }),
    onSuccess: () => {
      toast.success(initial ? 'Category updated' : 'Category created');
      onSaved();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to save category')),
  });

  function handleNameChange(name: string) {
    setForm((f) => ({ ...f, name, slug: initial ? f.slug : slugify(name) }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#12152A] border border-[#1E2238] rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
        <h2 className="text-base font-bold text-[#F5F0E8]">{initial ? 'Edit Category' : 'New Category'}</h2>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-[#8A9BC0]">Name *</label>
            <input
              value={form.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-[#0C0F1A] border border-[#1E2238] text-sm text-[#F5F0E8] focus:outline-none focus:border-[#6764f2] transition-colors"
              placeholder="Steel & Iron"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#8A9BC0]">Slug *</label>
            <input
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-[#0C0F1A] border border-[#1E2238] text-sm text-[#F5F0E8] focus:outline-none focus:border-[#6764f2] transition-colors font-mono"
              placeholder="steel-iron"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#8A9BC0]">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-[#0C0F1A] border border-[#1E2238] text-sm text-[#F5F0E8] focus:outline-none focus:border-[#6764f2] transition-colors resize-none"
            />
          </div>
          <ImageUploadField value={form.imageUrl} onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="accent-[#6764f2]"
            />
            <span className="text-sm text-[#8A9BC0]">Active</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-[#8A9BC0] border border-[#1E2238] hover:text-[#F5F0E8] transition-colors">
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !form.name || !form.slug}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-[#6764f2] hover:bg-[#5855e0] text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {saveMutation.isPending && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Product modal ───────────────────────────────────────────

type ProductFormState = {
  categoryId: string;
  name: string;
  description: string;
  unit: string;
  basePrice: string;
  imageUrl: string;
  isActive: boolean;
};

function ProductModal({
  initial,
  categories,
  onClose,
  onSaved,
}: {
  initial?: AdminProduct;
  categories: AdminCategory[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ProductFormState>({
    categoryId: initial?.categoryId ?? categories[0]?.id ?? '',
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    unit: initial?.unit ?? '',
    basePrice: initial?.basePrice ?? '',
    imageUrl: initial?.imageUrl ?? '',
    isActive: initial?.isActive ?? true,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      initial
        ? updateProduct(initial.id, {
            categoryId: form.categoryId,
            name: form.name,
            description: form.description || undefined,
            unit: form.unit,
            basePrice: form.basePrice,
            imageUrl: form.imageUrl || undefined,
            isActive: form.isActive,
          })
        : createProduct({
            categoryId: form.categoryId,
            name: form.name,
            description: form.description || undefined,
            unit: form.unit,
            basePrice: form.basePrice,
            imageUrl: form.imageUrl || undefined,
            isActive: form.isActive,
          }),
    onSuccess: () => {
      toast.success(initial ? 'Product updated' : 'Product created');
      onSaved();
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to save product')),
  });

  const isValid =
    form.categoryId &&
    form.name.trim() &&
    form.unit.trim() &&
    /^\d+(\.\d{1,2})?$/.test(form.basePrice);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#12152A] border border-[#1E2238] rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-base font-bold text-[#F5F0E8]">{initial ? 'Edit Product' : 'New Product'}</h2>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-[#8A9BC0]">Category *</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-[#0C0F1A] border border-[#1E2238] text-sm text-[#F5F0E8] focus:outline-none focus:border-[#6764f2] transition-colors"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-[#8A9BC0]">Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-[#0C0F1A] border border-[#1E2238] text-sm text-[#F5F0E8] focus:outline-none focus:border-[#6764f2] transition-colors"
              placeholder="TMT Steel Bar 8mm"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#8A9BC0]">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={2}
              className="mt-1 w-full px-3 py-2 rounded-xl bg-[#0C0F1A] border border-[#1E2238] text-sm text-[#F5F0E8] focus:outline-none focus:border-[#6764f2] transition-colors resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#8A9BC0]">Unit *</label>
              <input
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-[#0C0F1A] border border-[#1E2238] text-sm text-[#F5F0E8] focus:outline-none focus:border-[#6764f2] transition-colors"
                placeholder="kg / bag / piece"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#8A9BC0]">Base Price (₹) *</label>
              <input
                value={form.basePrice}
                onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))}
                className="mt-1 w-full px-3 py-2 rounded-xl bg-[#0C0F1A] border border-[#1E2238] text-sm text-[#F5F0E8] focus:outline-none focus:border-[#6764f2] transition-colors"
                placeholder="850.00"
              />
            </div>
          </div>
          <ImageUploadField value={form.imageUrl} onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="accent-[#6764f2]"
            />
            <span className="text-sm text-[#8A9BC0]">Active (visible in catalog)</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-[#8A9BC0] border border-[#1E2238] hover:text-[#F5F0E8] transition-colors">
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !isValid}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-[#6764f2] hover:bg-[#5855e0] text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {saveMutation.isPending && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────

type Tab = 'products' | 'categories';

export default function AdminProductsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('products');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [productModal, setProductModal] = useState<{ open: boolean; item?: AdminProduct }>({ open: false });
  const [categoryModal, setCategoryModal] = useState<{ open: boolean; item?: AdminCategory }>({ open: false });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: false } | { open: true; type: 'product' | 'category'; id: string; name: string }>({ open: false });

  const categoriesQuery = useQuery({
    queryKey: ['admin-categories'],
    queryFn: () => listCategories(100, 0),
  });

  const productsQuery = useQuery({
    queryKey: ['admin-products', categoryFilter, search],
    queryFn: () => listAdminProducts(100, 0, categoryFilter || undefined, search || undefined),
    enabled: tab === 'products',
  });

  const deleteMutation = useMutation({
    mutationFn: ({ type, id }: { type: 'product' | 'category'; id: string }) =>
      type === 'product' ? deleteProduct(id) : deleteCategory(id),
    onSuccess: (_, vars) => {
      toast.success(`${vars.type === 'product' ? 'Product' : 'Category'} deleted`);
      setDeleteConfirm({ open: false });
      void queryClient.invalidateQueries({ queryKey: vars.type === 'product' ? ['admin-products'] : ['admin-categories'] });
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Delete failed')),
  });

  const categories = categoriesQuery.data?.items ?? [];
  const products = productsQuery.data?.items ?? [];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-[#F5F0E8]">Product Catalog</h1>
          <p className="text-[#8A9BC0] text-sm mt-1">Manage products and categories available in the buyer catalog.</p>
        </div>
        <button
          onClick={() => tab === 'products' ? setProductModal({ open: true }) : setCategoryModal({ open: true })}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-[#6764f2] hover:bg-[#5855e0] text-white transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          {tab === 'products' ? 'New Product' : 'New Category'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['products', 'categories'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-colors capitalize ${
              tab === t
                ? 'bg-[#6764f2] text-white'
                : 'bg-[#12152A] text-[#8A9BC0] hover:text-[#F5F0E8] border border-[#1E2238]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'products' && (
        <>
          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#12152A] border border-[#1E2238] text-sm text-[#F5F0E8] focus:outline-none focus:border-[#6764f2] transition-colors"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="relative flex-1 max-w-xs">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5A80] text-[18px]">search</span>
              <input
                type="text"
                placeholder="Search products…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#12152A] border border-[#1E2238] text-sm text-[#F5F0E8] placeholder-[#4A5A80] focus:outline-none focus:border-[#6764f2] transition-colors"
              />
            </div>
          </div>

          {/* Products table */}
          {productsQuery.isLoading ? (
            <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="bg-[#12152A] border border-[#1E2238] rounded-2xl h-16 animate-pulse" />)}</div>
          ) : products.length === 0 ? (
            <div className="bg-[#12152A] border border-[#1E2238] rounded-2xl flex flex-col items-center justify-center py-20 text-center px-6">
              <span className="material-symbols-outlined text-[56px] text-[#1E2238] mb-4">inventory_2</span>
              <p className="text-base font-medium text-[#F5F0E8]">No products found</p>
              <p className="text-sm text-[#8A9BC0] mt-1">Click "New Product" to add your first product.</p>
            </div>
          ) : (
            <div className="bg-[#12152A] border border-[#1E2238] rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E2238]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#4A5A80] uppercase tracking-wider">Product</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#4A5A80] uppercase tracking-wider hidden md:table-cell">Category</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#4A5A80] uppercase tracking-wider">Unit</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-[#4A5A80] uppercase tracking-wider">Base Price</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-[#4A5A80] uppercase tracking-wider hidden sm:table-cell">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2238]">
                  {products.map((p) => (
                    <tr key={p.id} className="hover:bg-[#1E2238]/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {p.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.imageUrl} alt={p.name} className="w-9 h-9 rounded-lg object-cover border border-[#1E2238] shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-[#1E2238] flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-[#4A5A80] text-[18px]">inventory_2</span>
                            </div>
                          )}
                          <span className="font-medium text-[#F5F0E8] truncate max-w-[200px]">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#8A9BC0] hidden md:table-cell">{p.category?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-[#8A9BC0]">{p.unit}</td>
                      <td className="px-4 py-3 text-right font-mono text-[#F5F0E8]">₹{p.basePrice}</td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${p.isActive ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                          {p.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setProductModal({ open: true, item: p })}
                            className="p-1.5 rounded-lg text-[#4A5A80] hover:text-[#6764f2] hover:bg-[#6764f2]/10 transition-colors"
                            aria-label="Edit"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ open: true, type: 'product', id: p.id, name: p.name })}
                            className="p-1.5 rounded-lg text-[#4A5A80] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            aria-label="Delete"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'categories' && (
        <>
          {categoriesQuery.isLoading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-[#12152A] border border-[#1E2238] rounded-2xl h-16 animate-pulse" />)}</div>
          ) : categories.length === 0 ? (
            <div className="bg-[#12152A] border border-[#1E2238] rounded-2xl flex flex-col items-center justify-center py-20 text-center px-6">
              <span className="material-symbols-outlined text-[56px] text-[#1E2238] mb-4">category</span>
              <p className="text-base font-medium text-[#F5F0E8]">No categories yet</p>
              <p className="text-sm text-[#8A9BC0] mt-1">Click "New Category" to create the first one.</p>
            </div>
          ) : (
            <div className="bg-[#12152A] border border-[#1E2238] rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1E2238]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#4A5A80] uppercase tracking-wider">Category</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-[#4A5A80] uppercase tracking-wider hidden sm:table-cell">Slug</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-[#4A5A80] uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2238]">
                  {categories.map((c) => (
                    <tr key={c.id} className="hover:bg-[#1E2238]/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {c.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.imageUrl} alt={c.name} className="w-9 h-9 rounded-lg object-cover border border-[#1E2238] shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded-lg bg-[#1E2238] flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-[#4A5A80] text-[18px]">category</span>
                            </div>
                          )}
                          <span className="font-medium text-[#F5F0E8]">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#8A9BC0] font-mono text-xs hidden sm:table-cell">{c.slug}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.isActive ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                          {c.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setCategoryModal({ open: true, item: c })}
                            className="p-1.5 rounded-lg text-[#4A5A80] hover:text-[#6764f2] hover:bg-[#6764f2]/10 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ open: true, type: 'category', id: c.id, name: c.name })}
                            className="p-1.5 rounded-lg text-[#4A5A80] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Product modal */}
      {productModal.open && (
        <ProductModal
          initial={productModal.item}
          categories={categories}
          onClose={() => setProductModal({ open: false })}
          onSaved={() => {
            setProductModal({ open: false });
            void queryClient.invalidateQueries({ queryKey: ['admin-products'] });
          }}
        />
      )}

      {/* Category modal */}
      {categoryModal.open && (
        <CategoryModal
          initial={categoryModal.item}
          onClose={() => setCategoryModal({ open: false })}
          onSaved={() => {
            setCategoryModal({ open: false });
            void queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
          }}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#12152A] border border-[#1E2238] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-base font-bold text-[#F5F0E8] mb-2">Delete {deleteConfirm.type === 'product' ? 'Product' : 'Category'}?</h2>
            <p className="text-sm text-[#8A9BC0] mb-6">
              <span className="font-semibold text-[#F5F0E8]">{deleteConfirm.name}</span> will be permanently removed.
              {deleteConfirm.type === 'category' && ' Products in this category will be unaffected.'}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm({ open: false })}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-xl text-sm text-[#8A9BC0] border border-[#1E2238] hover:text-[#F5F0E8] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteConfirm.open && deleteMutation.mutate({ type: deleteConfirm.type, id: deleteConfirm.id })}
                disabled={deleteMutation.isPending}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/25 transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {deleteMutation.isPending && <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

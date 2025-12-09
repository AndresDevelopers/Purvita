'use client';

import { useState, useEffect, useCallback, type ChangeEvent, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { Checkbox } from '@/components/ui/checkbox';

interface MarketingCategory {
  id: string;
  slug: string;
  name_en: string;
  name_es: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface FormState {
  slug: string;
  name_en: string;
  name_es: string;
  is_active: boolean;
  display_order: number;
}

const createEmptyFormState = (): FormState => ({
  slug: '',
  name_en: '',
  name_es: '',
  is_active: true,
  display_order: 0,
});

export function CategoriesSection() {
  const [categories, setCategories] = useState<MarketingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(createEmptyFormState);
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [currentCategory, setCurrentCategory] = useState<MarketingCategory | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: queryError } = await supabase
        .from('marketing_categories')
        .select('*')
        .order('display_order', { ascending: true })
        .order('slug', { ascending: true });

      if (queryError) throw queryError;
      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching marketing categories:', err);
      setError('Error al cargar las categorías');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const resetFormState = useCallback(() => {
    setFormState(createEmptyFormState());
    setFormError(null);
  }, []);

  const closeModal = useCallback(() => {
    resetFormState();
    setCurrentCategory(null);
    setFormMode(null);
  }, [resetFormState]);

  const openCreateModal = () => {
    resetFormState();
    setFormMode('create');
  };

  const openEditModal = (category: MarketingCategory) => {
    resetFormState();
    setCurrentCategory(category);
    setFormState({
      slug: category.slug,
      name_en: category.name_en,
      name_es: category.name_es,
      is_active: category.is_active,
      display_order: category.display_order,
    });
    setFormMode('edit');
  };

  const handleTextChange = (field: keyof FormState) => (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    setFormState((prev) => ({
      ...prev,
      [field]: field === 'slug' ? value.toLowerCase().replace(/[^a-z0-9-]/g, '') : value,
    }));
  };

  const handleNumberChange = (field: keyof FormState) => (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const value = Number(event.target.value);
    setFormState((prev) => ({
      ...prev,
      [field]: Number.isFinite(value) ? value : 0,
    }));
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error: updateError } = await supabase
        .from('marketing_categories')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (updateError) throw updateError;
      await fetchCategories();
    } catch (err) {
      console.error('Error updating category status:', err);
      alert('Error al actualizar el estado');
    }
  };

  const handleDelete = async (category: MarketingCategory) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar la categoría "${category.name_es}"?`)) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from('marketing_categories')
        .delete()
        .eq('id', category.id);

      if (deleteError) throw deleteError;

      // Remove from selected if it was selected
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(category.id);
        return next;
      });

      await fetchCategories();
    } catch (err) {
      console.error('Error deleting category:', err);
      alert('Error al eliminar la categoría. Puede que esté en uso por algunos recursos.');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      return;
    }

    if (!confirm(`¿Estás seguro de que quieres eliminar ${selectedIds.size} categoría(s)?`)) {
      return;
    }

    setIsSaving(true);
    try {
      const { error: deleteError } = await supabase
        .from('marketing_categories')
        .delete()
        .in('id', Array.from(selectedIds));

      if (deleteError) throw deleteError;

      setSelectedIds(new Set());
      await fetchCategories();
    } catch (err) {
      console.error('Error deleting categories:', err);
      alert('Error al eliminar las categorías. Puede que estén en uso por algunos recursos.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSelection = (categoryId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const _toggleSelectAll = () => {
    if (selectedIds.size === categories.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(categories.map(c => c.id)));
    }
  };

  const validateForm = (): string | null => {
    if (!formState.slug.trim()) {
      return 'El slug es obligatorio';
    }
    if (!formState.name_en.trim()) {
      return 'El nombre en inglés es obligatorio';
    }
    if (!formState.name_es.trim()) {
      return 'El nombre en español es obligatorio';
    }
    if (!/^[a-z0-9-]+$/.test(formState.slug)) {
      return 'El slug solo puede contener letras minúsculas, números y guiones';
    }
    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const validationMessage = validateForm();
    if (validationMessage) {
      setFormError(validationMessage);
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        slug: formState.slug.trim(),
        name_en: formState.name_en.trim(),
        name_es: formState.name_es.trim(),
        is_active: formState.is_active,
        display_order: formState.display_order,
      };

      if (formMode === 'create') {
        const { error: insertError } = await supabase
          .from('marketing_categories')
          .insert(payload);

        if (insertError) throw insertError;
      } else if (formMode === 'edit' && currentCategory) {
        const { error: updateError } = await supabase
          .from('marketing_categories')
          .update(payload)
          .eq('id', currentCategory.id);

        if (updateError) throw updateError;
      }

      await fetchCategories();
      closeModal();
    } catch (err: unknown) {
      console.error('Error saving category:', err);
      const message = err instanceof Error ? err.message : 'Error al guardar la categoría';
      setFormError(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-200 rounded"></div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <p className="text-sm text-gray-600">
            Gestiona las categorías para organizar los recursos de marketing en múltiples idiomas.
          </p>
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={isSaving}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors flex items-center text-sm disabled:opacity-50"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
              </svg>
              Eliminar seleccionadas ({selectedIds.size})
            </button>
          )}
        </div>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Agregar categoría
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {categories.map((category) => (
            <li key={category.id} className="px-6 py-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="pt-1">
                    <Checkbox
                      checked={selectedIds.has(category.id)}
                      onCheckedChange={() => toggleSelection(category.id)}
                    />
                  </div>
                  <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-medium text-gray-900">{category.name_es}</h3>
                    <span className="text-sm text-gray-500">/ {category.name_en}</span>
                    {!category.is_active && (
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                        Inactiva
                      </span>
                    )}
                  </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                        {category.slug}
                      </span>
                      <span>Orden: {category.display_order}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(category.id, category.is_active)}
                    className={`px-3 py-1 text-sm rounded transition-colors ${
                      category.is_active
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {category.is_active ? 'Activa' : 'Inactiva'}
                  </button>
                  <button
                    onClick={() => openEditModal(category)}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(category)}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>

        {categories.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No hay categorías. Agrega tu primera categoría.</p>
          </div>
        )}
      </div>

      {formMode && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-start justify-center overflow-y-auto">
          <div className="relative my-10 w-full max-w-2xl rounded-lg bg-white shadow-xl">
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  {formMode === 'create' ? 'Agregar categoría' : 'Editar categoría'}
                </h3>
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {formError}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Slug (identificador único) *
                  </label>
                  <input
                    type="text"
                    value={formState.slug}
                    onChange={handleTextChange('slug')}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 font-mono"
                    placeholder="ej: redes-sociales"
                    disabled={formMode === 'edit'}
                  />
                  <p className="text-xs text-gray-500">
                    Solo letras minúsculas, números y guiones. No se puede cambiar después de crear.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Nombre en Español *
                    </label>
                    <input
                      type="text"
                      value={formState.name_es}
                      onChange={handleTextChange('name_es')}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      placeholder="Redes Sociales"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                      Nombre en Inglés *
                    </label>
                    <input
                      type="text"
                      value={formState.name_en}
                      onChange={handleTextChange('name_en')}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      placeholder="Social Media"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Orden de visualización</label>
                  <input
                    type="number"
                    value={formState.display_order}
                    onChange={handleNumberChange('display_order')}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                  <p className="text-xs text-gray-500">
                    Las categorías se ordenan de menor a mayor número.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={formState.is_active}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, is_active: e.target.checked }))
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="is_active" className="text-sm text-gray-700">
                    Categoría activa (visible en el selector)
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  disabled={isSaving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
                  disabled={isSaving}
                >
                  {isSaving ? 'Guardando...' : formMode === 'create' ? 'Crear categoría' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


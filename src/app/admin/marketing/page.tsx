'use client';

import {
  useState,
  useEffect,
  useCallback,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import Image from 'next/image';
import { supabase, MARKETING_ASSETS_BUCKET } from '@/lib/supabase';
import { Checkbox } from '@/components/ui/checkbox';
import { CategoriesSection } from './categories-section';
import AdminGuard from '@/components/admin-guard';
import { useUploadLimits } from '@/modules/upload';

type MediaType = 'image' | 'video';
type FileType = 'gif' | 'png' | 'jpg' | 'jpeg' | 'video';

interface MarketingCategory {
  id: string;
  slug: string;
  name: string;
  display_order: number;
}

interface MarketingAsset {
  id: string;
  title: string;
  title_en?: string | null;
  title_es?: string | null;
  description?: string | null;
  description_en?: string | null;
  description_es?: string | null;
  file_url: string | null;
  video_url: string | null;
  file_type: FileType | null;
  media_type: MediaType;
  category: string;
  category_id?: string | null;
  storage_path: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface FormState {
  title_en: string;
  title_es: string;
  description_en: string;
  description_es: string;
  media_type: MediaType;
  category: string;
  category_id: string | null;
  file_url: string | null;
  video_url: string | null;
  file_type: FileType | null;
  storage_path: string | null;
  display_order: number;
  is_active: boolean;
  file: File | null;
  previewUrl: string | null;
}

const IMAGE_EXTENSIONS: FileType[] = ['gif', 'png', 'jpg', 'jpeg'];
const IMAGE_ACCEPT = '.png,.jpg,.jpeg,.gif';

const createEmptyFormState = (): FormState => ({
  title_en: '',
  title_es: '',
  description_en: '',
  description_es: '',
  media_type: 'image',
  category: 'general',
  category_id: null,
  file_url: null,
  video_url: null,
  file_type: null,
  storage_path: null,
  display_order: 0,
  is_active: true,
  file: null,
  previewUrl: null,
});

const isValidImageExtension = (value: string | null | undefined): value is FileType => {
  if (!value) return false;
  return IMAGE_EXTENSIONS.includes(value as FileType);
};

const extractVideoProvider = (url: string): 'youtube' | 'other' => {
  if (/youtu\.be|youtube\.com/i.test(url)) {
    return 'youtube';
  }
  return 'other';
};

const sanitizeCategory = (value: string): string => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : 'general';
};

// Force dynamic rendering to prevent build-time fetch errors
export const dynamic = 'force-dynamic';

export default function AdminMarketingPage() {
  return (
    <AdminGuard lang="en">
      <AdminMarketingPageContent />
    </AdminGuard>
  );
}

function AdminMarketingPageContent() {
  const { getImageLimitText } = useUploadLimits();
  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  const [categories, setCategories] = useState<MarketingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>(createEmptyFormState);
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [currentAsset, setCurrentAsset] = useState<MarketingAsset | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'es' | 'en'>('es');
  const [activeSection, setActiveSection] = useState<'assets' | 'categories'>('assets');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchCategories = useCallback(async () => {
    try {
      const { data, error: queryError } = await supabase
        .rpc('get_marketing_categories', { locale_param: 'es' });

      if (queryError) throw queryError;
      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching marketing categories:', err);
      // Si falla, usar categorías por defecto
      setCategories([{ id: '', slug: 'general', name: 'General', display_order: 0 }]);
    }
  }, []);

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error: queryError } = await supabase
        .from('marketing_assets')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (queryError) throw queryError;
      setAssets(data || []);
    } catch (err) {
      console.error('Error fetching marketing assets:', err);
      setError('Error al cargar los recursos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchAssets();
  }, [fetchCategories, fetchAssets]);

  const resetFormState = useCallback(() => {
    setFormState((prev) => {
      if (prev.previewUrl) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return createEmptyFormState();
    });
    setFormError(null);
  }, []);

  const closeModal = useCallback(() => {
    resetFormState();
    setCurrentAsset(null);
    setFormMode(null);
  }, [resetFormState]);

  const openCreateModal = () => {
    resetFormState();
    setActiveTab('es');
    setFormMode('create');
  };

  const openEditModal = (asset: MarketingAsset) => {
    resetFormState();
    setCurrentAsset(asset);
    setActiveTab('es');
    setFormState(() => ({
      ...createEmptyFormState(),
      media_type: asset.media_type,
      category: asset.category ?? 'general',
      category_id: asset.category_id ?? null,
      title_en: asset.title_en ?? '',
      title_es: asset.title_es ?? '',
      description_en: asset.description_en ?? '',
      description_es: asset.description_es ?? '',
      file_url: asset.file_url,
      video_url: asset.video_url,
      file_type: asset.file_type ?? (asset.media_type === 'video' ? 'video' : null),
      storage_path: asset.storage_path,
      display_order: asset.display_order ?? 0,
      is_active: asset.is_active,
      previewUrl: null,
      file: null,
    }));
    setFormMode('edit');
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    const extension = file?.name?.split('.')?.pop()?.toLowerCase() ?? null;

    setFormState((prev) => {
      if (prev.previewUrl) {
        URL.revokeObjectURL(prev.previewUrl);
      }

      if (file && (!extension || !isValidImageExtension(extension))) {
        setFormError('Selecciona un archivo PNG, JPG o GIF válido.');
        return {
          ...prev,
          file: null,
          previewUrl: null,
          file_type: prev.file_type,
        };
      }

      const previewUrl = file ? URL.createObjectURL(file) : null;
      return {
        ...prev,
        file,
        previewUrl,
        file_type: (extension as FileType) ?? prev.file_type,
      };
    });
  };

  const handleTextChange = (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setFormState((prev) => ({
      ...prev,
      [field]: field === 'category' ? sanitizeCategory(value) : value,
    }));
  };

  const handleDisplayOrderChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    setFormState((prev) => ({
      ...prev,
      display_order: Number.isFinite(value) ? value : 0,
    }));
  };

  const handleMediaTypeChange = (mediaType: MediaType) => {
    setFormState((prev) => {
      if (prev.previewUrl) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return {
        ...prev,
        media_type: mediaType,
        file: null,
        previewUrl: null,
        file_url: mediaType === 'image' ? prev.file_url : null,
        video_url: mediaType === 'video' ? (prev.video_url ?? '') : null,
        file_type: mediaType === 'video' ? 'video' : prev.file_type && prev.file_type !== 'video' ? prev.file_type : null,
        storage_path: mediaType === 'image' ? prev.storage_path : null,
      };
    });
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error: updateError } = await supabase
        .from('marketing_assets')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (updateError) throw updateError;
      await fetchAssets();
    } catch (err) {
      console.error('Error updating asset status:', err);
      alert('Error al actualizar el estado');
    }
  };

  const handleDelete = async (asset: MarketingAsset) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este recurso?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('marketing_assets')
        .delete()
        .eq('id', asset.id);

      if (deleteError) throw deleteError;

      if (asset.storage_path) {
        const { error: storageError } = await supabase.storage
          .from(MARKETING_ASSETS_BUCKET)
          .remove([asset.storage_path]);

        if (storageError) {
          console.warn('No se pudo eliminar el archivo del almacenamiento:', storageError);
        }
      }

      // Remove from selected if it was selected
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(asset.id);
        return next;
      });

      await fetchAssets();
    } catch (err) {
      console.error('Error deleting asset:', err);
      alert('Error al eliminar el recurso');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      return;
    }

    if (!confirm(`¿Estás seguro de que quieres eliminar ${selectedIds.size} recurso(s)?`)) {
      return;
    }

    setIsSaving(true);
    try {
      const assetsToDelete = assets.filter(a => selectedIds.has(a.id));
      const storagePaths = assetsToDelete
        .map(a => a.storage_path)
        .filter((path): path is string => path !== null);

      // Delete from database
      const { error: deleteError } = await supabase
        .from('marketing_assets')
        .delete()
        .in('id', Array.from(selectedIds));

      if (deleteError) throw deleteError;

      // Delete from storage
      if (storagePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from(MARKETING_ASSETS_BUCKET)
          .remove(storagePaths);

        if (storageError) {
          console.warn('No se pudieron eliminar algunos archivos del almacenamiento:', storageError);
        }
      }

      setSelectedIds(new Set());
      await fetchAssets();
    } catch (err) {
      console.error('Error deleting assets:', err);
      alert('Error al eliminar los recursos');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSelection = (assetId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  };

  const _toggleSelectAll = () => {
    if (selectedIds.size === assets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(assets.map(a => a.id)));
    }
  };

  const uploadImageToBucket = async (file: File): Promise<{ publicUrl: string; path: string; fileType: FileType }> => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !isValidImageExtension(extension)) {
      throw new Error('Formato de imagen no soportado. Usa PNG, JPG o GIF.');
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError) {
      throw userError;
    }

    const ownerFolder = user?.id ?? 'anonymous';
    const uniqueId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const fileName = `${ownerFolder}/${uniqueId}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(MARKETING_ASSETS_BUCKET)
      .upload(fileName, file);

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicData } = supabase.storage
      .from(MARKETING_ASSETS_BUCKET)
      .getPublicUrl(fileName);

    return {
      publicUrl: publicData.publicUrl,
      path: fileName,
      fileType: extension as FileType,
    };
  };

  const validateForm = (): string | null => {
    if (!formState.title_es.trim() && !formState.title_en.trim()) {
      return 'Debes proporcionar al menos un título (ES o EN).';
    }

    if (formState.media_type === 'image') {
      if (!formState.file && !formState.file_url) {
        return 'Selecciona una imagen o sube un nuevo archivo.';
      }
    }

    if (formState.media_type === 'video') {
      const videoUrl = formState.video_url?.trim();
      if (!videoUrl) {
        return 'Ingresa la URL del video.';
      }

      if (extractVideoProvider(videoUrl) === 'other') {
        return 'Por ahora solo aceptamos enlaces de YouTube.';
      }
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

    const previousAsset = currentAsset;

    try {
      let fileUrl: string | null = formState.file_url;
      let storagePath: string | null = formState.storage_path;
      let fileType: FileType | null = formState.media_type === 'video' ? 'video' : formState.file_type;
      let videoUrl: string | null = formState.media_type === 'video' ? formState.video_url?.trim() ?? null : null;

      if (formState.media_type === 'image' && formState.file) {
        const uploadResult = await uploadImageToBucket(formState.file);
        fileUrl = uploadResult.publicUrl;
        storagePath = uploadResult.path;
        fileType = uploadResult.fileType;
      } else if (formState.media_type === 'video') {
        fileUrl = null;
        fileType = 'video';
        videoUrl = formState.video_url?.trim() ?? null;
      }

      const payload = {
        title: formState.title_es.trim() || formState.title_en.trim() || 'Sin título',
        title_en: formState.title_en.trim() || null,
        title_es: formState.title_es.trim() || null,
        description: formState.description_es.trim() || formState.description_en.trim() || null,
        description_en: formState.description_en.trim() || null,
        description_es: formState.description_es.trim() || null,
        category: sanitizeCategory(formState.category),
        category_id: formState.category_id,
        media_type: formState.media_type,
        file_url: fileUrl,
        file_type: fileType,
        video_url: videoUrl,
        storage_path: storagePath,
        is_active: formState.is_active,
        display_order: Number.isFinite(formState.display_order)
          ? formState.display_order
          : 0,
      };

      if (formMode === 'create') {
        const { error: insertError } = await supabase
          .from('marketing_assets')
          .insert(payload);

        if (insertError) throw insertError;
      } else if (formMode === 'edit' && previousAsset) {
        const { error: updateError } = await supabase
          .from('marketing_assets')
          .update(payload)
          .eq('id', previousAsset.id);

        if (updateError) throw updateError;

        const shouldRemoveOldFile =
          previousAsset.storage_path &&
          previousAsset.storage_path !== storagePath;

        if (shouldRemoveOldFile) {
          const { error: removeError } = await supabase.storage
            .from(MARKETING_ASSETS_BUCKET)
            .remove([previousAsset.storage_path!]);

          if (removeError) {
            console.warn('No se pudo limpiar el archivo anterior:', removeError);
          }
        }
      }

      await fetchAssets();
      closeModal();
    } catch (err: unknown) {
      console.error('Error saving marketing asset:', err);
      const message = err instanceof Error ? err.message : 'Error al guardar el recurso';
      setFormError(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Marketing</h1>
        <p className="text-sm text-gray-500">Gestiona recursos y categorías de marketing.</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveSection('assets')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeSection === 'assets'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Recursos
          </button>
          <button
            onClick={() => setActiveSection('categories')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeSection === 'categories'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Categorías
          </button>
        </nav>
      </div>

      {/* Content based on active section */}
      {activeSection === 'categories' ? (
        <CategoriesSection />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <p className="text-sm text-gray-600">
                Gestiona imágenes y videos que verán los usuarios en la sección de marketing.
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
                  Eliminar seleccionados ({selectedIds.size})
                </button>
              )}
            </div>
            <button
              onClick={openCreateModal}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Agregar recurso
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
              {error}
            </div>
          )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {assets.map((asset) => (
            <li key={asset.id} className="px-6 py-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="pt-1">
                    <Checkbox
                      checked={selectedIds.has(asset.id)}
                      onCheckedChange={() => toggleSelection(asset.id)}
                    />
                  </div>
                  <div className="h-16 w-16 rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                    {asset.media_type === 'video' ? (
                      <svg className="w-8 h-8 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M4 4h12a2 2 0 0 1 2 2v1.586l2.707-2.707A1 1 0 0 1 22 5v14a1 1 0 0 1-1.707.707L18 17.414V19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm0 2v13h12V6H4Zm14 3.414v5.172L20 16.586V7.414L18 9.414ZM9.5 9.5 14 12l-4.5 2.5V9.5Z" />
                      </svg>
                    ) : (
                      <Image
                        src={asset.file_url ?? ''}
                        alt={asset.title}
                        width={64}
                        height={64}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{asset.title}</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {asset.category}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {asset.media_type === 'video' ? 'Video' : (asset.file_type ?? '').toUpperCase()}
                      </span>
                    </div>
                    {asset.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {asset.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      Orden: {asset.display_order} • Estado: {asset.is_active ? 'Activo' : 'Inactivo'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end md:self-center">
                  <button
                    onClick={() => handleToggleActive(asset.id, asset.is_active)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${asset.is_active
                      ? 'bg-green-100 text-green-800 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                      }`}
                  >
                    {asset.is_active ? 'Activo' : 'Inactivo'}
                  </button>
                  <button
                    onClick={() => openEditModal(asset)}
                    className="text-blue-600 hover:text-blue-900"
                    title="Editar recurso"
                    aria-label="Editar recurso"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 1 1 2.828 2.828L11.828 15H9v-2.828l8.586-8.586Z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(asset)}
                    className="text-red-600 hover:text-red-900"
                    title="Eliminar recurso"
                    aria-label="Eliminar recurso"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {assets.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Aún no hay recursos de marketing. Agrega tu primer imagen o video.</p>
          </div>
        )}
      </div>

      {formMode && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-40 flex items-start justify-center overflow-y-auto">
          <div className="relative my-10 w-full max-w-3xl rounded-lg bg-white shadow-xl">
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h3 className="text-xl font-semibold text-gray-900">
                  {formMode === 'create' ? 'Agregar recurso' : 'Editar recurso'}
                </h3>
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Cerrar
                </button>
              </div>

              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {formError}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="marketing-category" className="text-sm font-medium text-gray-700">Categoría</label>
                <div>
                  <select
                    id="marketing-category"
                    value={formState.category_id || ''}
                    onChange={(e) => {
                      const selectedId = e.target.value || null;
                      const selectedCategory = categories.find(cat => cat.id === selectedId);
                      setFormState((prev) => ({
                        ...prev,
                        category_id: selectedId,
                        category: selectedCategory?.slug || 'general',
                      }));
                    }}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecciona una categoría</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-400 mt-1">Selecciona la categoría para organizar los recursos de marketing.</p>
                </div>
              </div>

              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  <button
                    type="button"
                    onClick={() => setActiveTab('es')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'es'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    Español
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('en')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === 'en'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    English
                  </button>
                </nav>
              </div>

              {activeTab === 'es' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Título (ES)</label>
                    <input
                      type="text"
                      value={formState.title_es}
                      onChange={handleTextChange('title_es')}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      placeholder="Título en español"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Descripción (ES)</label>
                    <textarea
                      value={formState.description_es}
                      onChange={handleTextChange('description_es')}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      rows={4}
                      placeholder="Descripción en español"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'en' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Título (EN)</label>
                    <input
                      type="text"
                      value={formState.title_en}
                      onChange={handleTextChange('title_en')}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      placeholder="Título en inglés"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Descripción (EN)</label>
                    <textarea
                      value={formState.description_en}
                      onChange={handleTextChange('description_en')}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      rows={4}
                      placeholder="Descripción en inglés"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-3 space-y-3">
                  <label className="text-sm font-medium text-gray-700">Tipo de recurso</label>
                  <div className="flex flex-wrap gap-3">
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="mediaType"
                        value="image"
                        checked={formState.media_type === 'image'}
                        onChange={() => handleMediaTypeChange('image')}
                      />
                      <span className="text-sm text-gray-600">Imagen (PNG, JPG o GIF)</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="mediaType"
                        value="video"
                        checked={formState.media_type === 'video'}
                        onChange={() => handleMediaTypeChange('video')}
                      />
                      <span className="text-sm text-gray-600">Video (URL de YouTube)</span>
                    </label>
                  </div>
                </div>
              </div>

              {formState.media_type === 'image' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="marketing-image-file" className="text-sm font-medium text-gray-700">Archivo de imagen</label>
                    <input
                      id="marketing-image-file"
                      type="file"
                      accept={IMAGE_ACCEPT}
                      onChange={handleFileChange}
                      className="w-full text-sm text-gray-600"
                    />
                    <p className="text-xs text-gray-400">
                      Sube imágenes optimizadas para móvil. {getImageLimitText()}.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Vista previa</label>
                    <div className="border border-dashed border-gray-300 rounded-md h-40 flex items-center justify-center overflow-hidden">
                      {formState.previewUrl ? (
                        <Image src={formState.previewUrl} alt="Vista previa" width={640} height={160} className="object-cover h-full w-full" unoptimized />
                      ) : formState.file_url ? (
                        <Image src={formState.file_url} alt="Vista previa actual" width={640} height={160} className="object-cover h-full w-full" unoptimized />
                      ) : (
                        <span className="text-sm text-gray-400">No hay imagen seleccionada</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">URL del video (YouTube)</label>
                  <input
                    type="url"
                    value={formState.video_url ?? ''}
                    onChange={handleTextChange('video_url')}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                  <p className="text-xs text-gray-400">
                    Usa un enlace público de YouTube. Mostraremos el reproductor en la página de usuarios.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label htmlFor="marketing-display-order" className="text-sm font-medium text-gray-700">Orden de visualización</label>
                  <input
                    id="marketing-display-order"
                    type="number"
                    value={formState.display_order}
                    onChange={handleDisplayOrderChange}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-400">Usa números bajos para mostrar primero el recurso.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Estado</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="marketing-asset-active"
                      checked={formState.is_active}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, is_active: event.target.checked }))
                      }
                    />
                    <label htmlFor="marketing-asset-active" className="text-sm text-gray-600">
                      Disponible para los usuarios
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-300"
                >
                  {isSaving ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}

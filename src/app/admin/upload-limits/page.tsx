'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import type { UploadLimitsConfig } from '@/modules/upload/domain/models/upload-limits';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';

export default function UploadLimitsPage() {
  const [config, setConfig] = useState<UploadLimitsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state - Solo campos que realmente se usan en el proyecto
  const [formData, setFormData] = useState({
    // Image limits (usados en productos, páginas, marketing)
    max_image_size_mb: 5,
    // Avatar limits (usados en perfiles de usuarios y afiliados)
    max_avatar_size_mb: 2,
  });

  // Fetch current configuration
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/upload-limits');

      if (!response.ok) {
        throw new Error('Failed to fetch upload limits');
      }

      const data = await response.json();
      setConfig(data.config);

      // Update form data - Solo campos que realmente se usan
      setFormData({
        max_image_size_mb: data.config.max_image_size_mb,
        max_avatar_size_mb: data.config.max_avatar_size_mb,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to load configuration',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      const response = await adminApi.put('/api/admin/upload-limits', formData);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update upload limits');
      }

      const data = await response.json();
      setConfig(data.config);
      setMessage({ type: 'success', text: 'Upload limits updated successfully' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to update upload limits',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset all upload limits to defaults?')) {
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      const response = await adminApi.post('/api/admin/upload-limits');

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reset upload limits');
      }

      await fetchConfig();
      setMessage({ type: 'success', text: 'Upload limits reset to defaults' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to reset upload limits',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Límites de Subida de Archivos</h1>
            <p className="text-muted-foreground mt-2">
              Configura los límites de tamaño para imágenes
            </p>
          </div>
          <Button onClick={handleReset} variant="outline" disabled={saving}>
            Restaurar Valores
          </Button>
        </div>

        {message && (
          <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Límites de Imágenes</CardTitle>
            <CardDescription>
              Configura los tamaños máximos permitidos para imágenes de productos, páginas y avatares
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="max_image_size_mb">Tamaño Máximo de Imagen (MB)</Label>
              <Input
                id="max_image_size_mb"
                type="number"
                step="0.1"
                min="0.1"
                max="100"
                value={formData.max_image_size_mb || ''}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  setFormData({ ...formData, max_image_size_mb: isNaN(value) ? 0 : value });
                }}
              />
              <p className="text-sm text-muted-foreground">
                Aplica a: productos, páginas, marketing (Máximo permitido: 100 MB)
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="max_avatar_size_mb">Tamaño Máximo de Avatar (MB)</Label>
              <Input
                id="max_avatar_size_mb"
                type="number"
                step="0.1"
                min="0.1"
                max="10"
                value={formData.max_avatar_size_mb || ''}
                onChange={(e) => {
                  const value = parseFloat(e.target.value);
                  setFormData({ ...formData, max_avatar_size_mb: isNaN(value) ? 0 : value });
                }}
              />
              <p className="text-sm text-muted-foreground">
                Aplica a: fotos de perfil de usuarios y afiliados (Máximo permitido: 10 MB)
              </p>
            </div>

            <div className="bg-muted p-4 rounded-md">
              <p className="text-sm font-medium mb-2">Tipos de Imagen Permitidos:</p>
              <p className="text-sm text-muted-foreground">
                JPEG, JPG, PNG, WebP, GIF, SVG
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={fetchConfig} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </Button>
        </div>

        {config && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Información de Configuración</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-1">
              <p>Última actualización: {new Date(config.updated_at).toLocaleString()}</p>
              <p>Actualizado por: {config.updated_by || 'Sistema'}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

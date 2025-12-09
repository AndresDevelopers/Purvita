'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';
import { ImageUploader } from '@/components/admin/image-uploader';

interface Tutorial {
  id: string;
  title: string;
  title_es?: string | null;
  title_en?: string | null;
  description: string;
  description_es?: string | null;
  description_en?: string | null;
  content: TutorialStep[];
  is_active: boolean;
  show_on_all_pages: boolean;
  target_pages: string[];
  created_at: string;
  updated_at: string;
}

interface TutorialStep {
  title: string;
  title_es?: string;
  title_en?: string;
  description: string;
  description_es?: string;
  description_en?: string;
  image_url?: string;
  action_type?: string;
}

interface TutorialsFormProps {
  copy: Record<string, any>;
}

export function TutorialsForm({ copy: _copy }: TutorialsFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [activeTab, setActiveTab] = useState<'es' | 'en'>('es');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadTutorials = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/tutorials', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to load tutorials');
      }
      const data = await response.json();
      setTutorials(data.tutorials || []);
    } catch (error) {
      console.error('Error loading tutorials:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tutorials. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadTutorials();
  }, [loadTutorials]);

  const saveTutorial = async (tutorial: Partial<Tutorial>) => {
    // Validate before sending
    const hasTitle = (tutorial.title_es?.trim() || tutorial.title_en?.trim() || tutorial.title?.trim());
    const hasValidContent = tutorial.content &&
      Array.isArray(tutorial.content) &&
      tutorial.content.length > 0 &&
      tutorial.content.some(step => step.title_es?.trim() || step.title_en?.trim() || step.title?.trim());

    if (!hasTitle) {
      toast({
        title: 'Error',
        description: activeTab === 'es'
          ? 'Por favor ingresa un título para el tutorial'
          : 'Please enter a title for the tutorial',
        variant: 'destructive',
      });
      return;
    }

    if (!hasValidContent) {
      toast({
        title: 'Error',
        description: activeTab === 'es'
          ? 'Por favor agrega al menos un paso con título'
          : 'Please add at least one step with a title',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const url = tutorial.id ? `/api/admin/tutorials/${tutorial.id}` : '/api/admin/tutorials';
      const response = tutorial.id
        ? await adminApi.put(url, tutorial)
        : await adminApi.post(url, tutorial);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to save tutorial' }));
        throw new Error(error.error || error.message || 'Failed to save tutorial');
      }

      toast({
        title: 'Success',
        description: `Tutorial ${tutorial.id ? 'updated' : 'created'} successfully.`,
      });

      loadTutorials();
    } catch (error) {
      console.error('Error saving tutorial:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save tutorial. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteTutorial = async (tutorialId: string) => {
    if (!confirm('Are you sure you want to delete this tutorial?')) {
      return;
    }

    try {
      const response = await adminApi.delete(`/api/admin/tutorials/${tutorialId}`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to delete tutorial' }));
        throw new Error(error.error || error.message || 'Failed to delete tutorial');
      }

      toast({
        title: 'Success',
        description: 'Tutorial deleted successfully.',
      });

      // Remove from selected if it was selected
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(tutorialId);
        return next;
      });

      loadTutorials();
    } catch (error) {
      console.error('Error deleting tutorial:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete tutorial. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedIds.size} tutorial(s)?`)) {
      return;
    }

    setSaving(true);
    try {
      const deletePromises = Array.from(selectedIds).map(id =>
        adminApi.delete(`/api/admin/tutorials/${id}`)
      );

      const results = await Promise.all(deletePromises);
      const failed = results.filter(r => !r.ok);

      if (failed.length > 0) {
        throw new Error(`Failed to delete ${failed.length} tutorial(s)`);
      }

      toast({
        title: 'Success',
        description: `${selectedIds.size} tutorial(s) deleted successfully.`,
      });

      setSelectedIds(new Set());
      loadTutorials();
    } catch (error) {
      console.error('Error deleting tutorials:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete some tutorials. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleSelection = (tutorialId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(tutorialId)) {
        next.delete(tutorialId);
      } else {
        next.add(tutorialId);
      }
      return next;
    });
  };

  const _toggleSelectAll = () => {
    if (selectedIds.size === tutorials.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tutorials.map(t => t.id).filter(Boolean)));
    }
  };

  const addTutorial = () => {
    const newTutorial: Partial<Tutorial> = {
      title: '',
      title_es: '',
      title_en: '',
      description: '',
      description_es: '',
      description_en: '',
      content: [{ title: '', title_es: '', title_en: '', description: '', description_es: '', description_en: '' }],
      is_active: true,
      show_on_all_pages: false,
      target_pages: [],
    };
    setTutorials(prev => [...prev, newTutorial as Tutorial]);
  };

  const updateTutorial = (index: number, updates: Partial<Tutorial>) => {
    setTutorials(prev => prev.map((tutorial, i) =>
      i === index ? { ...tutorial, ...updates } : tutorial
    ));
  };

  const addStep = (tutorialIndex: number) => {
    setTutorials(prev => prev.map((tutorial, i) =>
      i === tutorialIndex
        ? { ...tutorial, content: [...tutorial.content, { title: '', title_es: '', title_en: '', description: '', description_es: '', description_en: '' }] }
        : tutorial
    ));
  };

  const updateStep = (tutorialIndex: number, stepIndex: number, updates: Partial<TutorialStep>) => {
    setTutorials(prev => prev.map((tutorial, i) =>
      i === tutorialIndex
        ? {
          ...tutorial,
          content: tutorial.content.map((step, j) =>
            j === stepIndex ? { ...step, ...updates } : step
          )
        }
        : tutorial
    ));
  };

  const removeStep = (tutorialIndex: number, stepIndex: number) => {
    setTutorials(prev => prev.map((tutorial, i) =>
      i === tutorialIndex
        ? { ...tutorial, content: tutorial.content.filter((_, j) => j !== stepIndex) }
        : tutorial
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const _isAllSelected = tutorials.length > 0 && selectedIds.size === tutorials.length;
  const isSomeSelected = selectedIds.size > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Tutorials</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage onboarding tutorials for new users.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSomeSelected && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={saving}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected ({selectedIds.size})
            </Button>
          )}
          <Button onClick={addTutorial} disabled={saving}>
            <Plus className="h-4 w-4 mr-2" />
            Add Tutorial
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {tutorials.map((tutorial, tutorialIndex) => (
          <Card key={tutorial.id || `new-${tutorialIndex}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  {tutorial.id && (
                    <Checkbox
                      checked={selectedIds.has(tutorial.id)}
                      onCheckedChange={() => toggleSelection(tutorial.id)}
                    />
                  )}
                  <div className="space-y-1">
                    <CardTitle className="text-base">
                      {tutorial.title || 'New Tutorial'}
                    </CardTitle>
                    <CardDescription>
                      {tutorial.description || 'No description'}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={tutorial.is_active}
                      onCheckedChange={(checked) =>
                        updateTutorial(tutorialIndex, { is_active: checked })
                      }
                    />
                    <Label className="text-sm">Active</Label>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => saveTutorial(tutorial)}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                  </Button>
                  {tutorial.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteTutorial(tutorial.id)}
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Language Tabs */}
              <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                  <button
                    type="button"
                    onClick={() => setActiveTab('es')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'es'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    Español
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('en')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'en'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                  >
                    English
                  </button>
                </nav>
              </div>

              {/* Spanish Fields */}
              {activeTab === 'es' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`title-es-${tutorialIndex}`}>Título (ES)</Label>
                    <Input
                      id={`title-es-${tutorialIndex}`}
                      value={tutorial.title_es || ''}
                      onChange={(e) => updateTutorial(tutorialIndex, { title_es: e.target.value, title: e.target.value })}
                      placeholder="Título del tutorial"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`description-es-${tutorialIndex}`}>Descripción (ES)</Label>
                    <Input
                      id={`description-es-${tutorialIndex}`}
                      value={tutorial.description_es || ''}
                      onChange={(e) => updateTutorial(tutorialIndex, { description_es: e.target.value, description: e.target.value })}
                      placeholder="Descripción breve"
                    />
                  </div>
                </div>
              )}

              {/* English Fields */}
              {activeTab === 'en' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`title-en-${tutorialIndex}`}>Title (EN)</Label>
                    <Input
                      id={`title-en-${tutorialIndex}`}
                      value={tutorial.title_en || ''}
                      onChange={(e) => updateTutorial(tutorialIndex, { title_en: e.target.value })}
                      placeholder="Tutorial title"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`description-en-${tutorialIndex}`}>Description (EN)</Label>
                    <Input
                      id={`description-en-${tutorialIndex}`}
                      value={tutorial.description_en || ''}
                      onChange={(e) => updateTutorial(tutorialIndex, { description_en: e.target.value })}
                      placeholder="Brief description"
                    />
                  </div>
                </div>
              )}

              <Separator />

              {/* Page Targeting Section */}
              <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
                <h4 className="text-sm font-medium">
                  {activeTab === 'es' ? 'Dónde mostrar este tutorial' : 'Where to show this tutorial'}
                </h4>

                <div className="flex items-center space-x-2">
                  <Switch
                    checked={tutorial.show_on_all_pages}
                    onCheckedChange={(checked) =>
                      updateTutorial(tutorialIndex, {
                        show_on_all_pages: checked,
                        target_pages: checked ? [] : tutorial.target_pages
                      })
                    }
                  />
                  <Label className="text-sm">
                    {activeTab === 'es' ? 'Mostrar en todas las páginas' : 'Show on all pages'}
                  </Label>
                </div>

                {!tutorial.show_on_all_pages && (
                  <div className="space-y-2">
                    <Label className="text-sm">
                      {activeTab === 'es' ? 'Páginas específicas (una por línea)' : 'Specific pages (one per line)'}
                    </Label>
                    <Textarea
                      value={(tutorial.target_pages || []).join('\n')}
                      onChange={(e) => {
                        const pages = e.target.value
                          .split('\n')
                          .map(p => p.trim())
                          .filter(p => p.length > 0);
                        updateTutorial(tutorialIndex, { target_pages: pages });
                      }}
                      placeholder={activeTab === 'es'
                        ? '/dashboard\n/products\n/team\n/orders'
                        : '/dashboard\n/products\n/team\n/orders'
                      }
                      rows={5}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500">
                      {activeTab === 'es'
                        ? 'Ingresa las rutas de las páginas donde quieres que aparezca este tutorial. Ejemplo: /dashboard, /products, /team'
                        : 'Enter the page paths where you want this tutorial to appear. Example: /dashboard, /products, /team'
                      }
                    </p>
                    {tutorial.target_pages && tutorial.target_pages.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {tutorial.target_pages.map((page, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {page}
                            <button
                              type="button"
                              onClick={() => {
                                const newPages = tutorial.target_pages.filter((_, i) => i !== idx);
                                updateTutorial(tutorialIndex, { target_pages: newPages });
                              }}
                              className="ml-1 hover:text-blue-900"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">
                    {activeTab === 'es' ? 'Pasos del Tutorial' : 'Tutorial Steps'}
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addStep(tutorialIndex)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {activeTab === 'es' ? 'Agregar Paso' : 'Add Step'}
                  </Button>
                </div>

                {tutorial.content.map((step, stepIndex) => (
                  <div key={stepIndex} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-medium">
                        {activeTab === 'es' ? `Paso ${stepIndex + 1}` : `Step ${stepIndex + 1}`}
                      </h5>
                      {tutorial.content.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeStep(tutorialIndex, stepIndex)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {activeTab === 'es' ? (
                      <>
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label>Título del Paso (ES)</Label>
                            <Input
                              value={step.title_es || ''}
                              onChange={(e) =>
                                updateStep(tutorialIndex, stepIndex, { title_es: e.target.value, title: e.target.value })
                              }
                              placeholder="Título del paso"
                            />
                          </div>
                          <ImageUploader
                            label="Imagen (opcional)"
                            value={step.image_url || ''}
                            onChange={(url) => updateStep(tutorialIndex, stepIndex, { image_url: url })}
                            filePrefix={`tutorial-${tutorialIndex}-step-${stepIndex}`}
                            placeholder="https://ejemplo.com/imagen.jpg"
                            showPreview={true}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Descripción (ES)</Label>
                          <Textarea
                            value={step.description_es || ''}
                            onChange={(e) =>
                              updateStep(tutorialIndex, stepIndex, { description_es: e.target.value, description: e.target.value })
                            }
                            placeholder="Descripción e instrucciones del paso"
                            rows={3}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label>Step Title (EN)</Label>
                            <Input
                              value={step.title_en || ''}
                              onChange={(e) =>
                                updateStep(tutorialIndex, stepIndex, { title_en: e.target.value })
                              }
                              placeholder="Step title"
                            />
                          </div>
                          <ImageUploader
                            label="Image (optional)"
                            value={step.image_url || ''}
                            onChange={(url) => updateStep(tutorialIndex, stepIndex, { image_url: url })}
                            filePrefix={`tutorial-${tutorialIndex}-step-${stepIndex}`}
                            placeholder="https://example.com/image.jpg"
                            showPreview={true}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Description (EN)</Label>
                          <Textarea
                            value={step.description_en || ''}
                            onChange={(e) =>
                              updateStep(tutorialIndex, stepIndex, { description_en: e.target.value })
                            }
                            placeholder="Step description and instructions"
                            rows={3}
                          />
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {tutorials.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground text-center">
                No tutorials created yet. Click &quot;Add Tutorial&quot; to get started.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

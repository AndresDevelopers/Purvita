import type { Locale } from '@/i18n/config';
import type { PullToRefreshState } from '../hooks/use-pull-to-refresh';
import type { AdminDashboardViewModel, AdminDashboardStatusTone } from '../view-models/admin-dashboard-view-model';
import { useState, useRef, useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Calendar, Search } from 'lucide-react';
import { AdminConfigStatus } from '@/modules/admin/layout/views/admin-config-status';
import { sanitizeUserInput } from '@/lib/security/frontend-sanitization';

export type DatePeriod = 'daily' | 'weekly' | 'monthly' | 'all';

interface Attachment {
  type: 'image' | 'video' | 'audio';
  url: string;
  name: string;
  size: number;
}

interface AdminNote {
  id: string;
  content: string;
  attachments: Attachment[];
  created_at: string;
  profiles: { name: string; email: string } | null;
}

interface AdminDashboardViewProps {
  lang: Locale;
  viewModel: AdminDashboardViewModel;
  pullState: PullToRefreshState;
  isRefreshing: boolean;
  activityLoadMoreRef: (node: HTMLDivElement | null) => void;
  canLoadMoreActivities: boolean;
  isLoadingMoreActivities: boolean;
  onManualRefresh: () => Promise<void> | void;
  onLoadMoreActivities: () => void;
  notes: AdminNote[];
  onAddNote: (content: string, attachments: Attachment[]) => Promise<void>;
  onUpdateNote: (id: string, content: string, attachments: Attachment[]) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
  onUploadFile: (file: File) => Promise<Attachment>;
  onDeleteFile: (url: string) => Promise<void>;
  isAddingNote: boolean;
  productsPeriod: DatePeriod;
  onProductsPeriodChange: (period: DatePeriod) => void;
  activityPeriod: DatePeriod;
  onActivityPeriodChange: (period: DatePeriod) => void;
}

const statusToneClasses: Record<AdminDashboardStatusTone, string> = {
  success: 'text-green-800 bg-green-100 rounded-full dark:bg-green-700 dark:text-green-100 border border-green-200 dark:border-green-900/40',
  warning: 'text-yellow-800 bg-yellow-100 rounded-full dark:bg-yellow-700 dark:text-yellow-100 border border-yellow-200 dark:border-yellow-900/40',
  info: 'text-blue-800 bg-blue-100 rounded-full dark:bg-blue-700 dark:text-blue-100 border border-blue-200 dark:border-blue-900/40',
};

export const AdminDashboardView = ({
  lang,
  viewModel,
  pullState,
  isRefreshing: _isRefreshing,
  activityLoadMoreRef,
  canLoadMoreActivities,
  isLoadingMoreActivities,
  onManualRefresh: _onManualRefresh,
  onLoadMoreActivities,
  notes,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onUploadFile,
  onDeleteFile,
  isAddingNote,
  productsPeriod,
  onProductsPeriodChange,
  activityPeriod,
  onActivityPeriodChange,
}: AdminDashboardViewProps) => {
  const { statCards, activityRows, topProductRows, inventoryRows, copy } = viewModel;
  const hasProducts = topProductRows.length > 0;
  const hasInventory = inventoryRows.length > 0;

  const [noteContent, setNoteContent] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [activitySearchQuery, setActivitySearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter activity rows based on search query
  const filteredActivityRows = useMemo(() => {
    if (!activitySearchQuery.trim()) {
      return activityRows;
    }

    const query = activitySearchQuery.toLowerCase();
    return activityRows.filter((row) => {
      const userName = row.user?.toLowerCase() || '';
      const product = row.product?.toLowerCase() || '';
      const entityType = row.entityType?.toLowerCase() || '';

      return userName.includes(query) || product.includes(query) || entityType.includes(query);
    });
  }, [activityRows, activitySearchQuery]);

  const hasActivity = filteredActivityRows.length > 0;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadPromises = Array.from(files).map((file) => onUploadFile(file));
      const uploadedAttachments = await Promise.all(uploadPromises);
      setAttachments((prev) => [...prev, ...uploadedAttachments]);
    } catch (error) {
      console.error('Error uploading files:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAttachment = async (url: string) => {
    try {
      await onDeleteFile(url);
      setAttachments((prev) => prev.filter((att) => att.url !== url));
    } catch (error) {
      console.error('Error removing attachment:', error);
    }
  };

  const handleAddNote = async () => {
    if (noteContent.trim()) {
      await onAddNote(noteContent.trim(), attachments);
      setNoteContent('');
      setAttachments([]);
    }
  };

  const handleEditNote = (note: AdminNote) => {
    setEditingNoteId(note.id);
    setNoteContent(note.content);
    setAttachments(note.attachments || []);
  };

  const handleUpdateNote = async () => {
    if (editingNoteId && noteContent.trim()) {
      await onUpdateNote(editingNoteId, noteContent.trim(), attachments);
      setEditingNoteId(null);
      setNoteContent('');
      setAttachments([]);
    }
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setNoteContent('');
    setAttachments([]);
  };

  const pullCopy = lang === 'es'
    ? { idle: 'Desliza hacia abajo para actualizar', armed: 'Suelta para actualizar', triggered: 'Actualizando...' }
    : { idle: 'Pull down to refresh', armed: 'Release to refresh', triggered: 'Refreshing...' };

  const pullMessage = pullState.status === 'idle' ? pullCopy.idle : pullState.status === 'armed' ? pullCopy.armed : pullCopy.triggered;

  return (
    <main className="flex-1 px-4 py-6 md:p-8">
      <div className="mb-6 flex flex-col gap-2 md:mb-8">
        <h2 className="text-3xl font-bold text-background-dark dark:text-background-light">{copy.heading}</h2>
        <p className="text-sm text-background-dark/60 dark:text-background-light/60 md:hidden" aria-live="polite">
          {pullMessage}
        </p>
      </div>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <div
            key={card.title}
            className="bg-primary/10 dark:bg-primary/20 p-6 rounded-lg"
          >
            <p className="text-background-dark/80 dark:text-background-light/80 text-sm font-medium">{card.title}</p>
            <p className="text-3xl font-bold text-background-dark dark:text-background-light mt-2">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Configuration Status */}
      <div className="mb-8">
        <AdminConfigStatus lang={lang} />
      </div>

      <section className="mb-8 space-y-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-xl font-bold text-background-dark dark:text-background-light">{copy.recentActivityHeading}</h3>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-background-dark/60 dark:text-background-light/60" />
              <Select value={activityPeriod} onValueChange={(value) => onActivityPeriodChange(value as DatePeriod)}>
                <SelectTrigger className="w-full sm:w-[180px] bg-background-light dark:bg-background-dark border-primary/20 dark:border-primary/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {lang === 'en' ? 'All time' : 'Todo el tiempo'}
                  </SelectItem>
                  <SelectItem value="daily">
                    {lang === 'en' ? 'Today' : 'Hoy'}
                  </SelectItem>
                  <SelectItem value="weekly">
                    {lang === 'en' ? 'Last 7 days' : 'Últimos 7 días'}
                  </SelectItem>
                  <SelectItem value="monthly">
                    {lang === 'en' ? 'Last 31 days' : 'Últimos 31 días'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-background-dark/60 dark:text-background-light/60" />
            <Input
              type="text"
              placeholder={lang === 'en' ? 'Search by name, email or entity...' : 'Buscar por nombre, correo o entidad...'}
              value={activitySearchQuery}
              onChange={(e) => setActivitySearchQuery(e.target.value)}
              className="pl-10 bg-background-light dark:bg-background-dark border-primary/20 dark:border-primary/30 text-background-dark dark:text-background-light placeholder:text-background-dark/50 dark:placeholder:text-background-light/50"
            />
          </div>
        </div>
        {hasActivity ? (
          <div className="space-y-3 md:hidden">
            {filteredActivityRows.map((row, index) => {
              const isLast = index === filteredActivityRows.length - 1;
              return (
                <div
                  key={row.id}
                  ref={isLast ? activityLoadMoreRef : undefined}
                  className="rounded-lg border border-primary/20 bg-background-light/80 p-4 shadow-sm dark:border-primary/40 dark:bg-background-dark"
                >
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="flex flex-col">
                      <span className="font-semibold text-background-dark dark:text-background-light">{row.user}</span>
                    <span className="text-xs text-background-dark/70 dark:text-background-light/70">{row.product}</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-background-dark/70 dark:text-background-light/70">
                    <span>{row.date}</span>
                    <span className={`px-2 py-1 font-semibold ${statusToneClasses[row.statusTone]}`}>{row.statusLabel}</span>
                  </div>
                </div>
                </div>
              );
            })}
            {canLoadMoreActivities ? (
              <button
                type="button"
                onClick={onLoadMoreActivities}
                className="w-full rounded-md border border-dashed border-primary/30 px-4 py-2 text-sm font-medium text-primary"
              >
                {isLoadingMoreActivities ? (lang === 'es' ? 'Cargando más…' : 'Loading more…') : lang === 'es' ? 'Cargar más' : 'Load more'}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-primary/30 px-4 py-8 text-center text-sm text-background-dark/60 dark:text-background-light/70 md:hidden">
            {copy.emptyMessages.activity}
          </div>
        )}
        <div className="hidden md:block">
          <div className="overflow-hidden rounded-lg border border-primary/20 dark:border-primary/30">
            {hasActivity ? (
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="bg-primary/5 uppercase text-background-dark/60 dark:bg-primary/10 dark:text-background-light/60">
                  <tr>
                    <th className="px-6 py-3 font-medium" scope="col">{copy.columns.activity.user}</th>
                    <th className="px-6 py-3 font-medium" scope="col">{copy.columns.activity.product}</th>
                    <th className="px-6 py-3 font-medium" scope="col">{copy.columns.activity.date}</th>
                    <th className="px-6 py-3 font-medium" scope="col">{copy.columns.activity.status}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActivityRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-primary/20 dark:border-primary/30"
                    >
                        <td className="px-6 py-4 font-medium text-background-dark dark:text-background-light">{row.user}</td>
                        <td className="px-6 py-4 text-background-dark/80 dark:text-background-light/80">{row.product}</td>
                        <td className="px-6 py-4 text-background-dark/80 dark:text-background-light/80">{row.date}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-semibold leading-5 ${statusToneClasses[row.statusTone]}`}>{row.statusLabel}</span>
                        </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-10 text-center text-sm text-background-dark/60 dark:text-background-light/70">
                {copy.emptyMessages.activity}
              </div>
            )}
            {hasActivity ? <div ref={activityLoadMoreRef} className="h-2 w-full" /> : null}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-xl font-bold text-background-dark dark:text-background-light">{copy.topProductsHeading}</h3>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-background-dark/60 dark:text-background-light/60" />
            <Select value={productsPeriod} onValueChange={(value) => onProductsPeriodChange(value as DatePeriod)}>
              <SelectTrigger className="w-full sm:w-[180px] bg-background-light dark:bg-background-dark border-primary/20 dark:border-primary/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {lang === 'en' ? 'All time' : 'Todo el tiempo'}
                </SelectItem>
                <SelectItem value="daily">
                  {lang === 'en' ? 'Today' : 'Hoy'}
                </SelectItem>
                <SelectItem value="weekly">
                  {lang === 'en' ? 'Last 7 days' : 'Últimos 7 días'}
                </SelectItem>
                <SelectItem value="monthly">
                  {lang === 'en' ? 'Last 31 days' : 'Últimos 31 días'}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {hasProducts ? (
          <div className="space-y-3 md:hidden">
            {topProductRows.map((row) => (
              <div key={row.id} className="rounded-lg border border-primary/20 bg-background-light/80 p-4 shadow-sm dark:border-primary/40 dark:bg-background-dark">
                <p className="text-sm font-semibold text-background-dark dark:text-background-light">{row.name}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-background-dark/70 dark:text-background-light/70">
                  <span>{row.salesLabel}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">{row.revenueLabel}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-primary/30 px-4 py-8 text-center text-sm text-background-dark/60 dark:text-background-light/70 md:hidden">
            {copy.emptyMessages.products}
          </div>
        )}
        <div className="hidden md:block">
          <div className="overflow-hidden rounded-lg border border-primary/20 dark:border-primary/30">
            {hasProducts ? (
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-primary/5 uppercase text-background-dark/60 dark:bg-primary/10 dark:text-background-light/60">
                  <tr>
                    <th className="px-6 py-3 font-medium" scope="col">{copy.columns.products.product}</th>
                    <th className="px-6 py-3 font-medium" scope="col">{copy.columns.products.sales}</th>
                    <th className="px-6 py-3 font-medium" scope="col">{copy.columns.products.revenue}</th>
                  </tr>
                </thead>
                <tbody>
                  {topProductRows.map((row) => (
                    <tr key={row.id} className="border-b border-primary/20 dark:border-primary/30">
                      <td className="px-6 py-4 font-medium text-background-dark dark:text-background-light">{row.name}</td>
                      <td className="px-6 py-4 text-background-dark/80 dark:text-background-light/80">{row.salesLabel}</td>
                      <td className="px-6 py-4 text-background-dark/80 dark:text-background-light/80">{row.revenueLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-10 text-center text-sm text-background-dark/60 dark:text-background-light/70">
                {copy.emptyMessages.products}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-8 space-y-4">
        <div>
          <h3 className="text-xl font-bold text-background-dark dark:text-background-light">{copy.inventoryHeading}</h3>
          <p className="mt-1 text-sm text-background-dark/70 dark:text-background-light/70">{copy.inventorySummary}</p>
        </div>
        {hasInventory ? (
          <div className="space-y-3 md:hidden">
            {inventoryRows.map((row) => (
              <div key={row.id} className="rounded-lg border border-primary/20 bg-background-light/80 p-4 text-sm shadow-sm dark:border-primary/40 dark:bg-background-dark">
                <p className="font-semibold text-background-dark dark:text-background-light">{row.name}</p>
                <p className="mt-1 text-xs text-background-dark/70 dark:text-background-light/70">{row.stockLabel}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-primary/30 px-4 py-8 text-center text-sm text-background-dark/60 dark:text-background-light/70 md:hidden">
            {copy.emptyMessages.inventory}
          </div>
        )}
        <div className="hidden md:block">
          <div className="overflow-hidden rounded-lg border border-primary/20 dark:border-primary/30">
            {hasInventory ? (
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="bg-primary/5 uppercase text-background-dark/60 dark:bg-primary/10 dark:text-background-light/60">
                  <tr>
                    <th className="px-6 py-3 font-medium" scope="col">{copy.columns.inventory.product}</th>
                    <th className="px-6 py-3 font-medium" scope="col">{copy.columns.inventory.stock}</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryRows.map((row) => (
                    <tr key={row.id} className="border-b border-primary/20 dark:border-primary/30">
                      <td className="px-6 py-4 font-medium text-background-dark dark:text-background-light">{row.name}</td>
                      <td className="px-6 py-4 text-background-dark/80 dark:text-background-light/80">{row.stockLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-10 text-center text-sm text-background-dark/60 dark:text-background-light/70">
                {copy.emptyMessages.inventory}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mt-8 space-y-4">
        <h3 className="text-xl font-bold text-background-dark dark:text-background-light">
          {lang === 'es' ? 'Notas del Administrador' : 'Admin Notes'}
        </h3>

        {/* Add/Edit Note Form */}
        <div className="rounded-lg border border-primary/20 bg-background-light/80 p-4 dark:border-primary/40 dark:bg-background-dark">
          <div className="space-y-3">
            {editingNoteId && (
              <div className="flex items-center justify-between rounded-md bg-blue-50 px-3 py-2 dark:bg-blue-900/20">
                <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  {lang === 'es' ? 'Editando nota' : 'Editing note'}
                </span>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
                >
                  {lang === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
              </div>
            )}
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder={lang === 'es' ? 'Escribe una nota...' : 'Write a note...'}
              className="w-full rounded-md border border-primary/20 bg-background-light px-3 py-2 text-sm text-background-dark placeholder:text-background-dark/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-primary/30 dark:bg-background-dark/50 dark:text-background-light dark:placeholder:text-background-light/50"
              rows={3}
              disabled={isAddingNote || isUploading}
            />

            {/* Attachments Preview */}
            {attachments.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {attachments.map((att, index) => (
                  <div key={index} className="group relative rounded-md border border-primary/20 p-2">
                    {att.type === 'image' && (
                      <Image src={att.url} alt={att.name} width={320} height={80} className="h-20 w-full rounded object-cover" />
                    )}
                    {att.type === 'video' && (
                      <video src={att.url} className="h-20 w-full rounded object-cover" />
                    )}
                    {att.type === 'audio' && (
                      <div className="flex h-20 items-center justify-center rounded bg-primary/10">
                        <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                        </svg>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.url)}
                      className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white opacity-0 transition group-hover:opacity-100"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <p className="mt-1 truncate text-xs text-background-dark/60 dark:text-background-light/60">{att.name}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isAddingNote}
                className="rounded-md border border-primary/30 px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isUploading
                  ? (lang === 'es' ? 'Subiendo...' : 'Uploading...')
                  : (lang === 'es' ? '📎 Adjuntar Archivos' : '📎 Attach Files')}
              </button>
              <button
                type="button"
                onClick={editingNoteId ? handleUpdateNote : handleAddNote}
                disabled={!noteContent.trim() || isAddingNote || isUploading}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAddingNote
                  ? (lang === 'es' ? 'Guardando...' : 'Saving...')
                  : editingNoteId
                    ? (lang === 'es' ? 'Actualizar Nota' : 'Update Note')
                    : (lang === 'es' ? 'Agregar Nota' : 'Add Note')}
              </button>
            </div>
          </div>
        </div>

        {/* Notes List */}
        <div className="space-y-3">
          {notes.length > 0 ? (
            notes.map((note) => (
              <div
                key={note.id}
                className="rounded-lg border border-primary/20 bg-background-light/80 p-4 shadow-sm dark:border-primary/40 dark:bg-background-dark"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <p className="text-sm text-background-dark dark:text-background-light whitespace-pre-wrap">
                        {sanitizeUserInput(note.content)}
                      </p>

                      {/* Attachments */}
                      {note.attachments && note.attachments.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {note.attachments.map((att, index) => (
                            <div key={index} className="rounded-md border border-primary/10 p-2">
                              {att.type === 'image' && (
                                <a href={att.url} target="_blank" rel="noopener noreferrer">
                                  <Image src={att.url} alt={att.name} width={360} height={96} className="h-24 w-full rounded object-cover" />
                                </a>
                              )}
                              {att.type === 'video' && (
                                <video src={att.url} controls className="h-24 w-full rounded object-cover" />
                              )}
                              {att.type === 'audio' && (
                                <div className="space-y-2">
                                  <div className="flex h-16 items-center justify-center rounded bg-primary/10">
                                    <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                    </svg>
                                  </div>
                                  <audio src={att.url} controls className="w-full" />
                                </div>
                              )}
                              <p className="mt-1 truncate text-xs text-background-dark/60 dark:text-background-light/60">{att.name}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 text-xs text-background-dark/60 dark:text-background-light/60">
                        <span>
                          {lang === 'es' ? 'Por' : 'By'} {note.profiles?.name || 'Unknown'}
                        </span>
                        <span>•</span>
                        <span>
                          {new Date(note.created_at).toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleEditNote(note)}
                        className="rounded-md p-1.5 text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                        title={lang === 'es' ? 'Editar nota' : 'Edit note'}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteNote(note.id)}
                        className="rounded-md p-1.5 text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                        title={lang === 'es' ? 'Eliminar nota' : 'Delete note'}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-primary/30 px-4 py-8 text-center text-sm text-background-dark/60 dark:text-background-light/70">
              {lang === 'es' ? 'No hay notas todavía' : 'No notes yet'}
            </div>
          )}
        </div>
      </section>
    </main>
  );
};
import Image from 'next/image';

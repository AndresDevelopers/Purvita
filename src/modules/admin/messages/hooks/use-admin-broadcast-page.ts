'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { Locale } from '@/i18n/config';
import { useToast } from '@/hooks/use-toast';
import { useSiteBranding } from '@/contexts/site-branding-context';
import { usePullToRefresh } from '@/modules/admin/dashboard/hooks/use-pull-to-refresh';
import type { PullToRefreshState } from '@/modules/admin/dashboard/hooks/use-pull-to-refresh';
import type {
  AdminBroadcastAudience,
  AdminBroadcastOverview,
  BroadcastRecipient,
} from '../domain/models/admin-broadcast';
import { AdminBroadcastAudienceTypeSchema } from '../domain/models/admin-broadcast';
import type { AdminBroadcastEventBus } from '../domain/events/admin-broadcast-event-bus';
import { adminApi } from '@/lib/utils/admin-csrf-helpers';

interface AdminBroadcastPageCopy {
  title: string;
  description: string;
  segments: Record<AdminBroadcastAudience['type'], { title: string; description: string }>;
  form: {
    subjectLabel: string;
    subjectPlaceholder: string;
    bodyLabel: string;
    bodyPlaceholder: string;
    sendLabel: string;
    sendingLabel: string;
    successTitle: string;
    successDescription: (count: number) => string;
    previewHeading: string;
    previewEmpty: string;
    previewCountLabel: (count: number) => string;
    environmentWarning: string;
    missingSenderWarning: string;
    productLabel: string;
    productPlaceholder: string;
    userLabel: string;
    userPlaceholder: string;
    userEmpty: string;
    userSearchHint: string;
    pullToRefreshIdle: string;
    pullToRefreshArmed: string;
    pullToRefreshTriggered: string;
    validation: {
      subject: string;
      body: string;
      selection: string;
    };
  };
  errors: {
    overview: string;
    send: string;
    preview: string;
  };
  previewSampleLabel: string;
}

export interface AdminBroadcastPageState {
  copy: AdminBroadcastPageCopy;
  overview: AdminBroadcastOverview | null;
  loading: boolean;
  error: string | null;
  audience: AdminBroadcastAudience['type'];
  subject: string;
  body: string;
  productId: string | null;
  user: BroadcastRecipient | null;
  preview: {
    loading: boolean;
    count: number | null;
    sample: BroadcastRecipient[];
    error: string | null;
  };
  sending: boolean;
  success: { delivered: number; message: string } | null;
  alerts: string[];
  userQuery: string;
  userLoading: boolean;
  userResults: BroadcastRecipient[];
  disabled: boolean;
  disabledReason: string | null;
  pullState: PullToRefreshState;
  actions: {
    refresh: () => Promise<void>;
    changeAudience: (audience: AdminBroadcastAudience['type']) => void;
    changeSubject: (value: string) => void;
    changeBody: (value: string) => void;
    changeProduct: (value: string | null) => void;
    searchUser: (value: string) => void;
    selectUser: (recipient: BroadcastRecipient | null) => void;
    send: () => Promise<void>;
    dismissSuccess: () => void;
  };
}

type PreviewState = {
  loading: boolean;
  count: number | null;
  sample: BroadcastRecipient[];
  error: string | null;
};

const defaultPreviewState: PreviewState = {
  loading: false,
  count: null,
  sample: [],
  error: null,
};

const buildCopy = (dictionary: any, _brandingName: string): AdminBroadcastPageCopy => {
  const broadcastDict = dictionary?.admin?.broadcasts ?? {};

  const formatCount = (count: number) =>
    broadcastDict.previewCountLabel
      ? broadcastDict.previewCountLabel.replace('{count}', String(count))
      : `${count} recipients ready`;

  return {
    title: broadcastDict.title ?? 'Broadcast center',
    description:
      broadcastDict.description ??
      'Send targeted announcements to every segment of your community from one place.',
    segments: {
      all_users: {
        title: broadcastDict.segments?.allUsers?.title ?? 'Everyone',
        description:
          broadcastDict.segments?.allUsers?.description ?? 'Deliver an announcement to all registered members.',
      },
      active_subscribers: {
        title: broadcastDict.segments?.activeSubscribers?.title ?? 'Active subscriptions',
        description:
          broadcastDict.segments?.activeSubscribers?.description ??
          'Reach members whose subscription is currently active.',
      },
      lapsed_subscribers: {
        title: broadcastDict.segments?.lapsedSubscribers?.title ?? 'Lapsed subscribers',
        description:
          broadcastDict.segments?.lapsedSubscribers?.description ??
          'Reconnect with members that paid for a subscription but are inactive today.',
      },
      product_purchasers: {
        title: broadcastDict.segments?.productPurchasers?.title ?? 'Specific product buyers',
        description:
          broadcastDict.segments?.productPurchasers?.description ??
          'Notify members who purchased a selected product.',
      },
      specific_user: {
        title: broadcastDict.segments?.specificUser?.title ?? 'Individual member',
        description:
          broadcastDict.segments?.specificUser?.description ??
          'Send a personalised message to one member.',
      },
    },
    form: {
      subjectLabel: broadcastDict.form?.subjectLabel ?? 'Subject',
      subjectPlaceholder: broadcastDict.form?.subjectPlaceholder ?? 'Monthly community update',
      bodyLabel: broadcastDict.form?.bodyLabel ?? 'Message',
      bodyPlaceholder:
        broadcastDict.form?.bodyPlaceholder ??
        'Share detailed context, timelines and next steps for your community.',
      sendLabel: broadcastDict.form?.sendLabel ?? 'Send broadcast',
      sendingLabel: broadcastDict.form?.sendingLabel ?? 'Sending...',
      successTitle: broadcastDict.form?.successTitle ?? 'Broadcast sent',
      successDescription: broadcastDict.form?.successDescription
        ? (count: number) => broadcastDict.form.successDescription.replace('{count}', String(count))
        : (count: number) => `${count} members received your message.`,
      previewHeading: broadcastDict.form?.previewHeading ?? 'Audience preview',
      previewEmpty: broadcastDict.form?.previewEmpty ?? 'Choose an audience to preview recipients.',
      previewCountLabel: broadcastDict.form?.previewCountLabel
        ? (count: number) => broadcastDict.form.previewCountLabel.replace('{count}', String(count))
        : formatCount,
      environmentWarning:
        broadcastDict.form?.environmentWarning ??
        'Configure the email provider in Settings → Contact before sending a broadcast.',
      missingSenderWarning:
        broadcastDict.form?.missingSenderWarning ??
        'Set CONTACT_FROM_EMAIL and CONTACT_FROM_NAME to enable email sending.',
      productLabel: broadcastDict.form?.productLabel ?? 'Product filter',
      productPlaceholder: broadcastDict.form?.productPlaceholder ?? 'Choose a product',
      userLabel: broadcastDict.form?.userLabel ?? 'Member',
      userPlaceholder: broadcastDict.form?.userPlaceholder ?? 'Search by name or email',
      userEmpty: broadcastDict.form?.userEmpty ?? 'Start typing to search for a member.',
      userSearchHint:
        broadcastDict.form?.userSearchHint ?? 'Enter at least two characters to search across members.',
      pullToRefreshIdle:
        broadcastDict.form?.pullToRefresh?.idle ?? 'Pull down to refresh segment counts',
      pullToRefreshArmed:
        broadcastDict.form?.pullToRefresh?.armed ?? 'Release to refresh',
      pullToRefreshTriggered:
        broadcastDict.form?.pullToRefresh?.triggered ?? 'Refreshing segment data…',
      validation: {
        subject: broadcastDict.form?.validation?.subject ?? 'Please provide a subject with at least 3 characters.',
        body: broadcastDict.form?.validation?.body ?? 'Share at least 20 characters before sending your broadcast.',
        selection:
          broadcastDict.form?.validation?.selection ??
          'Select a product or member before sending to this audience.',
      },
    },
    errors: {
      overview: broadcastDict.errors?.overview ?? 'Unable to load broadcast data.',
      send: broadcastDict.errors?.send ?? 'We could not send the broadcast. Please try again.',
      preview: broadcastDict.errors?.preview ?? 'We could not preview the audience.',
    },
    previewSampleLabel:
      broadcastDict.previewSampleLabel ?? 'First recipients ready for delivery',
  };
};

const buildAudiencePayload = (
  audience: AdminBroadcastAudience['type'],
  productId: string | null,
  user: BroadcastRecipient | null,
): AdminBroadcastAudience => {
  switch (audience) {
    case 'product_purchasers':
      if (!productId) {
        throw new Error('Product is required for product audience.');
      }
      return { type: 'product_purchasers', productId };
    case 'specific_user':
      if (!user || !user.id) {
        throw new Error('User is required for single recipient audience.');
      }
      return { type: 'specific_user', userId: user.id };
    default:
      return { type: audience } as AdminBroadcastAudience;
  }
};

export const useAdminBroadcastPage = (
  lang: Locale,
  dictionary: any,
  eventBus: AdminBroadcastEventBus,
): AdminBroadcastPageState => {
  const { branding } = useSiteBranding();
  const copy = useMemo(() => buildCopy(dictionary, branding.appName), [dictionary, branding.appName]);
  const { toast } = useToast();

  const [overview, setOverview] = useState<AdminBroadcastOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [audience, setAudience] = useState<AdminBroadcastAudience['type']>('all_users');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [productId, setProductId] = useState<string | null>(null);
  const [user, setUser] = useState<BroadcastRecipient | null>(null);
  const [preview, setPreview] = useState(defaultPreviewState);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<{ delivered: number; message: string } | null>(null);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [userLoading, setUserLoading] = useState(false);
  const [userResults, setUserResults] = useState<BroadcastRecipient[]>([]);

  const disabledReason = useMemo(() => {
    if (!overview) {
      return null;
    }

    if (!overview.environment.hasEmailProvider) {
      return copy.form.environmentWarning;
    }

    if (!overview.environment.fromEmailConfigured) {
      return copy.form.missingSenderWarning;
    }

    return null;
  }, [overview, copy.form.environmentWarning, copy.form.missingSenderWarning]);

  const disabled = Boolean(disabledReason);

  const fetchOverview = useCallback(async () => {
    eventBus.emit({ type: 'overview_loading' });
    setLoading(true);
    setError(null);
    try {
      // Using adminApi.get() for consistency (GET requests don't need CSRF token)
      const response = await adminApi.get(`/api/admin/broadcasts?lang=${lang}`, { cache: 'no-store' });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? copy.errors.overview);
      }
      const data = (await response.json()) as AdminBroadcastOverview;
      setOverview(data);
      setLoading(false);
      eventBus.emit({ type: 'overview_loaded', totalSegments: 5 });
    } catch (overviewError) {
      const message = overviewError instanceof Error ? overviewError.message : copy.errors.overview;
      setError(message);
      setLoading(false);
      eventBus.emit({
        type: 'overview_failed',
        error: overviewError instanceof Error ? overviewError : new Error(copy.errors.overview),
      });
    }
  }, [copy.errors.overview, eventBus, lang]);

  const refresh = useCallback(async () => {
    await fetchOverview();
  }, [fetchOverview]);

  const pullState = usePullToRefresh(refresh, { threshold: 80 });

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    const controller = new AbortController();
    const audienceValidation = AdminBroadcastAudienceTypeSchema.safeParse(audience);

    if (!audienceValidation.success) {
      return () => controller.abort();
    }

    const requiresProduct = audience === 'product_purchasers';
    const requiresUser = audience === 'specific_user';

    if ((requiresProduct && !productId) || (requiresUser && !user)) {
      setPreview(defaultPreviewState);
      return () => controller.abort();
    }

    const timer = setTimeout(async () => {
      eventBus.emit({ type: 'preview_loading' });
      setPreview((state) => ({ ...state, loading: true, error: null }));
      try {
        const payload = buildAudiencePayload(audience, productId, user);
        // ✅ SECURITY: Use adminApi.post() to automatically include CSRF token
        const response = await adminApi.post('/api/admin/broadcasts/preview', payload, {
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error ?? copy.errors.preview);
        }

        const data = (await response.json()) as { count: number; sample: BroadcastRecipient[] };
        setPreview({ loading: false, count: data.count, sample: data.sample, error: null });
        eventBus.emit({ type: 'preview_ready', recipients: data.count });
      } catch (previewError) {
        if (controller.signal.aborted) {
          return;
        }
        const message = previewError instanceof Error ? previewError.message : copy.errors.preview;
        setPreview({ loading: false, count: null, sample: [], error: message });
        eventBus.emit({
          type: 'preview_failed',
          error: previewError instanceof Error ? previewError : new Error(copy.errors.preview),
        });
      }
    }, 400);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [audience, copy.errors.preview, eventBus, productId, user]);

  useEffect(() => {
    if (audience !== 'specific_user') {
      return;
    }

    if (userQuery.trim().length < 2) {
      setUserResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setUserLoading(true);
      try {
        // Using adminApi.get() for consistency (GET requests don't need CSRF token)
        const response = await adminApi.get(`/api/admin/broadcasts/users?query=${encodeURIComponent(userQuery)}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(copy.errors.preview);
        }

        const data = (await response.json()) as BroadcastRecipient[];
        setUserResults(data);
      } catch (searchError) {
        if (!controller.signal.aborted) {
          console.error('User search failed', searchError);
        }
      } finally {
        if (!controller.signal.aborted) {
          setUserLoading(false);
        }
      }
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [audience, copy.errors.preview, userQuery]);

  const changeAudience = useCallback(
    (value: AdminBroadcastAudience['type']) => {
      setAudience(value);
      setPreview(defaultPreviewState);
      setProductId(null);
      setUser(null);
      setAlerts([]);
    },
    [],
  );

  const changeProduct = useCallback((value: string | null) => {
    setProductId(value);
    setAlerts([]);
  }, []);

  const searchUser = useCallback((value: string) => {
    setUserQuery(value);
    setAlerts([]);
  }, []);

  const selectUser = useCallback((value: BroadcastRecipient | null) => {
    setUser(value);
    setAlerts([]);
  }, []);

  const validate = useCallback(() => {
    const issues: string[] = [];

    if (subject.trim().length < 3) {
      issues.push(copy.form.validation.subject);
    }

    if (body.trim().length < 20) {
      issues.push(copy.form.validation.body);
    }

    if (audience === 'product_purchasers' && !productId) {
      issues.push(copy.form.validation.selection);
    }

    if (audience === 'specific_user' && !user) {
      issues.push(copy.form.validation.selection);
    }

    setAlerts(issues);
    return issues.length === 0;
  }, [audience, body, copy.form.validation.body, copy.form.validation.selection, copy.form.validation.subject, productId, subject, user]);

  const send = useCallback(async () => {
    if (!validate()) {
      return;
    }

    let payload: AdminBroadcastAudience;

    try {
      payload = buildAudiencePayload(audience, productId, user);
    } catch (_errorPayload) {
      setAlerts([copy.form.validation.selection]);
      return;
    }

    if (disabled) {
      if (disabledReason) {
        toast({ title: copy.form.environmentWarning, description: disabledReason, variant: 'destructive' });
      }
      return;
    }

    setSending(true);
    setAlerts([]);
    eventBus.emit({ type: 'broadcast_sending', audience: audience });

    try {
      // ✅ SECURITY: Use adminApi.post() to automatically include CSRF token
      const response = await adminApi.post('/api/admin/broadcasts', {
        ...payload,
        subject: subject.trim(),
        body: body.trim(),
      });

      if (!response.ok) {
        const bodyData = await response.json().catch(() => null);
        const message = bodyData?.error ?? copy.errors.send;
        throw new Error(message);
      }

      const data = (await response.json()) as { deliveredCount: number; intendedCount: number };
      const message = copy.form.successDescription(data.deliveredCount);
      setSuccess({ delivered: data.deliveredCount, message });
      toast({ title: copy.form.successTitle, description: message });
      eventBus.emit({ type: 'broadcast_sent', delivered: data.deliveredCount });
      setSubject('');
      setBody('');
      setProductId(null);
      setUser(null);
      setUserQuery('');
      setUserResults([]);
      refresh();
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : copy.errors.send;
      setAlerts([message]);
      toast({ title: copy.errors.send, description: message, variant: 'destructive' });
      eventBus.emit({
        type: 'broadcast_failed',
        error: sendError instanceof Error ? sendError : new Error(copy.errors.send),
      });
    } finally {
      setSending(false);
    }
  }, [audience, body, copy.errors.send, copy.form, disabled, disabledReason, eventBus, productId, refresh, subject, toast, user, validate]);

  const dismissSuccess = useCallback(() => {
    setSuccess(null);
  }, []);

  return {
    copy,
    overview,
    loading,
    error,
    audience,
    subject,
    body,
    productId,
    user,
    preview,
    sending,
    success,
    alerts,
    userQuery,
    userLoading,
    userResults,
    disabled,
    disabledReason,
    pullState,
    actions: {
      refresh,
      changeAudience,
      changeSubject: setSubject,
      changeBody: setBody,
      changeProduct,
      searchUser,
      selectUser,
      send,
      dismissSuccess,
    },
  };
};

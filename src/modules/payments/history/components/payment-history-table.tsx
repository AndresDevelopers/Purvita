'use client';

import { format } from 'date-fns';
import type { Locale as DateFnsLocale } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Locale as AppLocale } from '@/i18n/config';
import type { PaymentHistoryEntry, PaymentStatus } from '../domain/models/payment-history-entry';

const dateLocaleMap: Record<AppLocale, DateFnsLocale> = {
  en: enUS,
  es,
};

const formatCurrency = (amount: number, currency: string, lang: AppLocale) =>
  new Intl.NumberFormat(lang, {
    style: 'currency',
    currency,
  }).format(amount / 100);

const formatDate = (value: string | null, lang: AppLocale) => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return format(date, 'PPP', { locale: dateLocaleMap[lang] });
};

export interface PaymentHistoryTableCopy {
  user: string;
  amount: string;
  dueDate: string;
  status: string;
  nextCharge: string;
  method: string;
  actions: string;
  manualLabel: string;
  statusLabels: Record<PaymentStatus, string>;
  markPaid: string;
  markPending: string;
  markOverdue: string;
  approvePayout: string;
  rejectPayout: string;
  empty: string;
}

interface PaymentHistoryTableProps {
  lang: AppLocale;
  entries: PaymentHistoryEntry[];
  loading: boolean;
  copy: PaymentHistoryTableCopy;
  isManualMode?: boolean;
  onMarkPaid: (id: string) => void;
  onMarkPending: (id: string) => void;
  onMarkOverdue: (id: string) => void;
}

const statusVariant: Record<PaymentStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  paid: 'default',
  pending: 'secondary',
  overdue: 'destructive',
  upcoming: 'outline',
};

export const PaymentHistoryTable = ({
  lang,
  entries,
  loading,
  copy,
  isManualMode = false,
  onMarkPaid,
  onMarkPending,
  onMarkOverdue,
}: PaymentHistoryTableProps) => (
  <div className="overflow-hidden rounded-xl border border-primary/10 bg-background-light/80 shadow-sm backdrop-blur-md dark:border-primary/20 dark:bg-background-dark/80">
    <Table>
      <TableHeader>
        <TableRow className="bg-primary/5 text-xs uppercase tracking-wide text-muted-foreground">
          <TableHead>{copy.user}</TableHead>
          <TableHead>{copy.amount}</TableHead>
          <TableHead>{copy.dueDate}</TableHead>
          <TableHead>{copy.status}</TableHead>
          <TableHead>{copy.nextCharge}</TableHead>
          <TableHead>{copy.method}</TableHead>
          <TableHead>{copy.actions}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.length === 0 && !loading ? (
          <TableRow>
            <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
              {copy.empty}
            </TableCell>
          </TableRow>
        ) : null}
        {entries.map((entry) => (
          <TableRow key={entry.id} className="text-sm">
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium text-foreground">{entry.userName}</span>
                <span className="text-xs text-muted-foreground">{entry.userEmail}</span>
                {entry.manual ? (
                  <span className="mt-1 inline-flex w-fit items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
                    {copy.manualLabel}
                  </span>
                ) : null}
              </div>
            </TableCell>
            <TableCell>{formatCurrency(entry.amountCents, entry.currency, lang)}</TableCell>
            <TableCell>{formatDate(entry.dueDate, lang)}</TableCell>
            <TableCell>
              <Badge variant={statusVariant[entry.status]}>{copy.statusLabels[entry.status]}</Badge>
            </TableCell>
            <TableCell>{formatDate(entry.nextDueDate, lang)}</TableCell>
            <TableCell className="capitalize">{entry.method.replace('_', ' ')}</TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-2">
                {isManualMode && entry.status === 'pending' ? (
                  <>
                    <Button
                      size="sm"
                      variant="default"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => onMarkPaid(entry.id)}
                    >
                      {copy.approvePayout}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onMarkOverdue(entry.id)}
                    >
                      {copy.rejectPayout}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => onMarkPaid(entry.id)}>
                      {copy.markPaid}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onMarkPending(entry.id)}>
                      {copy.markPending}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onMarkOverdue(entry.id)}>
                      {copy.markOverdue}
                    </Button>
                  </>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

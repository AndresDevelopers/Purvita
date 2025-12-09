'use client';
import React, { type ReactNode } from 'react';
import { Loader2, MailCheck, Users, UserRound, PackageSearch, BadgeCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AdminBroadcastPageState } from '../hooks/use-admin-broadcast-page';

interface AdminBroadcastPageViewProps {
  state: AdminBroadcastPageState;
}

const icons: Record<string, ReactNode> = {
  all_users: <Users className="h-4 w-4" />,
  active_subscribers: <BadgeCheck className="h-4 w-4" />,
  lapsed_subscribers: <UserRound className="h-4 w-4" />,
  product_purchasers: <PackageSearch className="h-4 w-4" />,
  specific_user: <UserRound className="h-4 w-4" />,
};

export const AdminBroadcastPageView = ({ state }: AdminBroadcastPageViewProps) => {
  const {
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
    actions,
  } = state;

  const counts = overview?.counts ?? { allUsers: 0, activeSubscribers: 0, lapsedSubscribers: 0 };

  const renderSegmentOption = (
    value: AdminBroadcastPageState['audience'],
    countLabel: string,
  ) => (
    <Label
      key={value}
      htmlFor={`audience-${value}`}
      className={`group flex w-full cursor-pointer flex-col gap-2 rounded-2xl border p-4 text-left transition-colors ${audience === value ? 'border-primary bg-primary/5 dark:border-primary/50 dark:bg-primary/10' : 'border-border/60 hover:border-primary/40 dark:border-border/40 dark:hover:border-primary/40'}`}
    >
      <div className="flex items-center gap-3">
        <RadioGroupItem id={`audience-${value}`} value={value} />
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="rounded-full bg-primary/10 p-2 text-primary">{icons[value]}</span>
          <span>{copy.segments[value].title}</span>
        </div>
        <div className="ml-auto text-xs text-muted-foreground">{countLabel}</div>
      </div>
      <p className="text-sm text-muted-foreground">{copy.segments[value].description}</p>
    </Label>
  );

  const renderUserSearch = () => (
    <div className="mt-4 space-y-3">
      <div>
        <Label htmlFor="user-search" className="text-sm font-medium">
          {copy.form.userLabel}
        </Label>
        <Input
          id="user-search"
          value={userQuery}
          placeholder={copy.form.userPlaceholder}
          onChange={(event) => actions.searchUser(event.target.value)}
          className="mt-2"
        />
        <p className="mt-2 text-xs text-muted-foreground">{copy.form.userSearchHint}</p>
      </div>
      <ScrollArea className="max-h-48 rounded-lg border border-border/60">
        <div className="divide-y divide-border/50">
          {userLoading ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {copy.form.sendingLabel}
            </div>
          ) : userResults.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">{copy.form.userEmpty}</div>
          ) : (
            userResults.map((candidate) => (
              <button
                type="button"
                key={candidate.id ?? candidate.email}
                onClick={() => actions.selectUser(candidate)}
                className={`flex w-full flex-col gap-1 px-4 py-3 text-left text-sm transition-colors ${user?.id === candidate.id ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}
              >
                <span className="font-medium">{candidate.name ?? candidate.email}</span>
                <span className="text-xs text-muted-foreground">{candidate.email}</span>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
      {user && (
        <Alert className="border border-primary/40 bg-primary/5">
          <AlertTitle>{user.name ?? user.email}</AlertTitle>
          <AlertDescription>{user.email}</AlertDescription>
        </Alert>
      )}
    </div>
  );

  const renderProductSelect = () => (
    <div className="mt-4 space-y-2">
      <Label htmlFor="product-select" className="text-sm font-medium">
        {copy.form.productLabel}
      </Label>
      <Select value={productId ?? ''} onValueChange={(value) => actions.changeProduct(value || null)}>
        <SelectTrigger id="product-select" className="h-11">
          <SelectValue placeholder={copy.form.productPlaceholder} />
        </SelectTrigger>
        <SelectContent className="max-h-64">
          {(overview?.products ?? []).map((product) => (
            <SelectItem key={product.id} value={product.id}>
              {product.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{copy.title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">{copy.description}</p>
          </div>
          <Badge variant="outline" className="self-start">
            {pullState.status === 'triggered'
              ? copy.form.pullToRefreshTriggered
              : pullState.status === 'armed'
                ? copy.form.pullToRefreshArmed
                : copy.form.pullToRefreshIdle}
          </Badge>
        </div>
        {error && (
          <Alert variant="destructive" className="border-destructive/60">
            <AlertTitle>{copy.errors.overview}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{copy.form.previewHeading}</CardTitle>
          <CardDescription>{copy.form.previewEmpty}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-24 rounded-2xl" />
              ))}
            </div>
          ) : (
            <RadioGroup
              value={audience}
              onValueChange={(value) => actions.changeAudience(value as AdminBroadcastPageState['audience'])}
              className="grid gap-3 sm:grid-cols-2"
            >
              {renderSegmentOption('all_users', copy.form.previewCountLabel(counts.allUsers ?? 0))}
              {renderSegmentOption('active_subscribers', copy.form.previewCountLabel(counts.activeSubscribers ?? 0))}
              {renderSegmentOption('lapsed_subscribers', copy.form.previewCountLabel(counts.lapsedSubscribers ?? 0))}
              {renderSegmentOption('product_purchasers', copy.form.productLabel)}
              {renderSegmentOption('specific_user', copy.form.userLabel)}
            </RadioGroup>
          )}

          {audience === 'product_purchasers' && renderProductSelect()}
          {audience === 'specific_user' && renderUserSearch()}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{copy.form.bodyLabel}</CardTitle>
          <CardDescription>{copy.form.bodyPlaceholder}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {disabled && disabledReason && (
            <Alert className="border-amber-500/40 bg-amber-100/40 dark:border-amber-200/40 dark:bg-amber-400/10">
              <AlertTitle>{copy.form.environmentWarning}</AlertTitle>
              <AlertDescription>{disabledReason}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-emerald-400/40 bg-emerald-100/40 dark:border-emerald-400/60 dark:bg-emerald-400/10">
              <AlertTitle>
                <div className="flex items-center gap-2">
                  <MailCheck className="h-4 w-4" />
                  {copy.form.successTitle}
                </div>
              </AlertTitle>
              <AlertDescription>
                <div className="flex items-center justify-between gap-4">
                  <span>{success.message}</span>
                  <Button variant="outline" size="sm" onClick={actions.dismissSuccess}>
                    OK
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {alerts.map((message) => (
            <Alert key={message} variant="destructive">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ))}

          <div className="space-y-2">
            <Label htmlFor="broadcast-subject" className="text-sm font-medium">
              {copy.form.subjectLabel}
            </Label>
            <Input
              id="broadcast-subject"
              value={subject}
              placeholder={copy.form.subjectPlaceholder}
              onChange={(event) => actions.changeSubject(event.target.value)}
              maxLength={160}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="broadcast-body" className="text-sm font-medium">
              {copy.form.bodyLabel}
            </Label>
            <Textarea
              id="broadcast-body"
              value={body}
              placeholder={copy.form.bodyPlaceholder}
              onChange={(event) => actions.changeBody(event.target.value)}
              rows={10}
              className="resize-y"
            />
            <div className="flex justify-end text-xs text-muted-foreground">{body.length}/6000</div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {audience === 'product_purchasers'
                ? copy.form.validation.selection
                : audience === 'specific_user'
                  ? copy.form.userSearchHint
                  : ''}
            </p>
            <Button onClick={actions.send} disabled={sending || disabled} size="lg">
              {sending ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> {copy.form.sendingLabel}
                </span>
              ) : (
                copy.form.sendLabel
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{copy.form.previewHeading}</CardTitle>
          <CardDescription>
            {preview.count !== null ? copy.form.previewCountLabel(preview.count) : copy.form.previewEmpty}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {preview.loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {copy.form.sendingLabel}
            </div>
          ) : preview.error ? (
            <Alert variant="destructive">
              <AlertDescription>{preview.error}</AlertDescription>
            </Alert>
          ) : preview.count === 0 || preview.count === null ? (
            <div className="rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
              {copy.form.previewEmpty}
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">{copy.previewSampleLabel}</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {preview.sample.map((recipient) => (
                  <div
                    key={recipient.id ?? recipient.email}
                    className="rounded-xl border border-border/60 bg-muted/40 p-3 text-sm"
                  >
                    <p className="font-medium">{recipient.name ?? recipient.email}</p>
                    <p className="text-xs text-muted-foreground">{recipient.email}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};


"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";
import type { ProfileSummaryPayload } from "@/modules/profile/domain/types";

const REFERRAL_CODE_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const REFERRAL_AVAILABILITY_TONE_CLASSES = {
  muted: "text-slate-500 dark:text-slate-300",
  success: "text-emerald-600 dark:text-emerald-300",
  error: "text-rose-600 dark:text-rose-300",
  warning: "text-amber-600 dark:text-amber-300",
} satisfies Record<"muted" | "success" | "error" | "warning", string>;

const APPEARANCE_PRESETS = {
  dashboard: {
    formClassName: "mt-4 space-y-4",
    helperClassName: "text-xs text-slate-500 dark:text-slate-300",
    actionsWrapperClassName: "flex flex-col gap-3 sm:flex-row sm:items-center",
    submitButtonClassName: "min-h-[44px] min-w-[160px] sm:min-w-[160px]",
    resetButtonClassName: "min-h-[44px] min-w-[160px] sm:min-w-[160px]",
    codeInputClassName:
      "h-11 rounded-xl border-slate-200 bg-white pr-11 text-sm text-slate-900 focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-100",
    linkSectionClassName: "mt-6 space-y-2",
    linkInputClassName:
      "h-11 rounded-xl border-slate-200 bg-slate-50 text-sm text-slate-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-200",
    copyButtonClassName:
      "min-h-[44px] min-w-[160px] bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400",
  },
  profile: {
    formClassName: "space-y-3",
    helperClassName: "text-xs text-neutral-500 dark:text-neutral-400",
    actionsWrapperClassName: "flex flex-col gap-3 sm:flex-row sm:items-center",
    submitButtonClassName: "min-h-[44px] sm:min-w-[160px]",
    resetButtonClassName: "min-h-[44px] sm:min-w-[160px]",
    codeInputClassName: "",
    linkSectionClassName:
      "space-y-2 rounded-xl border border-neutral-200 bg-neutral-50 p-4 dark:border-white/10 dark:bg-white/5",
    linkInputClassName: "bg-white text-sm dark:bg-neutral-900/60",
    copyButtonClassName: "min-h-[44px] sm:min-w-[160px]",
  },
} as const;

type ReferralAvailabilityStatus =
  | "idle"
  | "checking"
  | "available"
  | "current"
  | "unavailable"
  | "invalid"
  | "error";

type ReferralAvailabilityTone = "muted" | "success" | "error" | "warning";

type ReferralAvailabilityFeedback = {
  tone: ReferralAvailabilityTone;
  message: string;
} | null;

type ReferralSettingsDict = {
  title?: string;
  description?: string;
  codeLabel?: string;
  placeholder?: string;
  helper?: string;
  linkLabel?: string;
  copy?: string;
  copied?: string;
  saving?: string;
  save?: string;
  reset?: string;
  success?: string;
  copyErrorTitle?: string;
  copyErrorDescription?: string;
  availability?: Partial<Record<string, string>> & {
    checking?: string;
    available?: string;
    unavailable?: string;
    current?: string;
    invalid?: string;
    error?: string;
  };
  errors?: Partial<Record<string, string>> & {
    pattern?: string;
    minLength?: string;
    maxLength?: string;
    conflict?: string;
    generic?: string;
  };
};

type AffiliateDict = {
  title?: string;
  description?: string;
  copy?: string;
  copied?: string;
};

type ReferralSettingsFormProps = {
  lang: Locale;
  userId: string | null;
  initialReferralCode: string | null;
  shareCodeFallback: string | null;
  referralSettingsDict?: ReferralSettingsDict | null;
  affiliateDict?: AffiliateDict | null;
  inputId?: string;
  appearance?: keyof typeof APPEARANCE_PRESETS;
  className?: string;
  onReferralCodeChange?: (code: string | null) => void;
  onProfileUpdate?: (
    payload:
      | (Partial<Pick<ProfileSummaryPayload, "profile" | "membership">> & {
          profile?: ProfileSummaryPayload["profile"];
          membership?: ProfileSummaryPayload["membership"];
        })
      | null,
  ) => void;
  onCopyError?: (params: { title: string; description: string }) => void;
};

export function ReferralSettingsForm({
  lang,
  userId,
  initialReferralCode,
  shareCodeFallback,
  referralSettingsDict,
  affiliateDict,
  inputId = "referral-code",
  appearance = "dashboard",
  className,
  onReferralCodeChange,
  onProfileUpdate,
  onCopyError,
}: ReferralSettingsFormProps) {
  const [referralCode, setReferralCode] = useState<string | null>(initialReferralCode);
  const [referralInput, setReferralInput] = useState(initialReferralCode ?? "");
  const [referralSaving, setReferralSaving] = useState(false);
  const [referralServerErrorCode, setReferralServerErrorCode] = useState<string | null>(null);
  const [referralSuccess, setReferralSuccess] = useState(false);
  const [referralAvailabilityStatus, setReferralAvailabilityStatus] =
    useState<ReferralAvailabilityStatus>("idle");
  const [referralAvailabilityReason, setReferralAvailabilityReason] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const styles = APPEARANCE_PRESETS[appearance] ?? APPEARANCE_PRESETS.dashboard;

  useEffect(() => {
    setReferralCode(initialReferralCode ?? null);
    setReferralInput(initialReferralCode ?? "");
    setReferralSuccess(false);
    setReferralServerErrorCode(null);
    if (initialReferralCode) {
      setReferralAvailabilityStatus("current");
      setReferralAvailabilityReason("ok");
    } else {
      setReferralAvailabilityStatus("idle");
      setReferralAvailabilityReason(null);
    }
  }, [initialReferralCode]);

  const normalizedReferralInput = referralInput.trim().toLowerCase();
  const referralBaseline = referralCode ?? "";
  const referralUnchanged = normalizedReferralInput === referralBaseline;

  const clientReferralErrorCode = useMemo(() => {
    if (normalizedReferralInput.length === 0) {
      return null;
    }

    if (!REFERRAL_CODE_REGEX.test(normalizedReferralInput)) {
      return "referral_code_pattern";
    }

    if (normalizedReferralInput.length < 4) {
      return "referral_code_min_length";
    }

    if (normalizedReferralInput.length > 32) {
      return "referral_code_max_length";
    }

    return null;
  }, [normalizedReferralInput]);

  const mapReferralError = useCallback(
    (code: string | null): string | null => {
      if (!code) return null;
      const errorsDict = referralSettingsDict?.errors ?? {};

      if (code === "referral_code_pattern") {
        return errorsDict.pattern ?? "Use letters, numbers, or hyphens only.";
      }

      if (code === "referral_code_min_length") {
        return errorsDict.minLength ?? "Referral codes must include at least 4 characters.";
      }

      if (code === "referral_code_max_length") {
        return errorsDict.maxLength ?? "Referral codes must be 32 characters or fewer.";
      }

      if (code === "referral_code_conflict") {
        return errorsDict.conflict ?? "That referral code is already in use.";
      }

      return errorsDict.generic ?? "We could not update your referral code. Please try again.";
    },
    [referralSettingsDict?.errors],
  );

  const referralErrorCode =
    referralServerErrorCode && referralServerErrorCode !== "referral_code_conflict"
      ? referralServerErrorCode
      : null;
  const referralErrorMessage = mapReferralError(referralErrorCode);

  const mapReferralAvailability = useCallback(
    (
      status: ReferralAvailabilityStatus,
      reason: string | null,
    ): ReferralAvailabilityFeedback => {
      if (status === "idle") {
        return null;
      }

      const availabilityDict = referralSettingsDict?.availability ?? {};

      if (status === "checking") {
        return {
          tone: "muted",
          message: availabilityDict.checking ?? "Checking availability...",
        };
      }

      if (status === "available") {
        return {
          tone: "success",
          message: availabilityDict.available ?? "This referral code is available!",
        };
      }

      if (status === "current") {
        return {
          tone: "muted",
          message: availabilityDict.current ?? "This is your current referral code.",
        };
      }

      if (status === "unavailable") {
        return {
          tone: "error",
          message:
            availabilityDict.unavailable ??
            mapReferralError("referral_code_conflict") ??
            "That referral code is already in use.",
        };
      }

      if (status === "invalid") {
        return {
          tone: "warning",
          message: mapReferralError(reason) ?? "Enter a valid referral code to continue.",
        };
      }

      return {
        tone: "error",
        message:
          availabilityDict.error ??
          mapReferralError(reason) ??
          "We could not verify this referral code. Please try again.",
      };
    },
    [mapReferralError, referralSettingsDict?.availability],
  );

  const referralAvailabilityFeedback = mapReferralAvailability(
    referralAvailabilityStatus,
    referralAvailabilityReason,
  );

  const referralAvailabilityIcon = useMemo(() => {
    switch (referralAvailabilityStatus) {
      case "available":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden />;
      case "current":
        return <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden />;
      case "unavailable":
        return <XCircle className="h-5 w-5 text-rose-500" aria-hidden />;
      case "invalid":
        return <AlertCircle className="h-5 w-5 text-amber-500" aria-hidden />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-amber-500" aria-hidden />;
      case "checking":
        return <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-hidden />;
      default:
        return null;
    }
  }, [referralAvailabilityStatus]);

  const referralIsChecking = referralAvailabilityStatus === "checking";
  const referralIsUnavailable = referralAvailabilityStatus === "unavailable";
  const referralHasClientError = clientReferralErrorCode !== null;

  useEffect(() => {
    if (!userId) {
      setReferralAvailabilityStatus("idle");
      setReferralAvailabilityReason(null);
      return;
    }

    if (normalizedReferralInput.length === 0) {
      setReferralAvailabilityStatus("idle");
      setReferralAvailabilityReason(null);
      return;
    }

    if (normalizedReferralInput === referralBaseline) {
      setReferralAvailabilityStatus(referralBaseline ? "current" : "idle");
      setReferralAvailabilityReason(referralBaseline ? "ok" : null);
      return;
    }

    if (clientReferralErrorCode) {
      setReferralAvailabilityStatus("invalid");
      setReferralAvailabilityReason(clientReferralErrorCode);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    setReferralAvailabilityStatus("checking");
    setReferralAvailabilityReason("checking");

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/profile/referral/availability", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": userId,
          },
          body: JSON.stringify({ referral_code: normalizedReferralInput }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Availability check failed with status ${response.status}`);
        }

        const result = (await response.json()) as {
          available: boolean;
          reason?: string | null;
        };

        if (cancelled) {
          return;
        }

        if (result.available) {
          setReferralAvailabilityStatus("available");
        } else {
          setReferralAvailabilityStatus("unavailable");
        }

        setReferralAvailabilityReason(
          result.reason ?? (result.available ? "ok" : "referral_code_conflict"),
        );
      } catch (error) {
        if (controller.signal.aborted || cancelled) {
          return;
        }

        console.error("Failed to verify referral code availability", error);
        setReferralAvailabilityStatus("error");
        setReferralAvailabilityReason("error");
      }
    }, 350);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [
    clientReferralErrorCode,
    normalizedReferralInput,
    referralBaseline,
    userId,
  ]);

  const handleReferralSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId || referralSaving) {
      return;
    }

    if (clientReferralErrorCode) {
      setReferralServerErrorCode(null);
      setReferralSuccess(false);
      return;
    }

    if (referralIsUnavailable) {
      setReferralServerErrorCode("referral_code_conflict");
      setReferralAvailabilityReason("referral_code_conflict");
      setReferralSuccess(false);
      return;
    }

    if (normalizedReferralInput === referralBaseline) {
      setReferralServerErrorCode(null);
      setReferralSuccess(false);
      setReferralAvailabilityStatus(referralBaseline ? "current" : "idle");
      setReferralAvailabilityReason(referralBaseline ? "ok" : null);
      return;
    }

    setReferralSaving(true);
    setReferralServerErrorCode(null);
    setReferralSuccess(false);

    try {
      const response = await fetch("/api/profile/summary", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          referral_code: normalizedReferralInput.length === 0 ? "" : normalizedReferralInput,
        }),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        setReferralServerErrorCode(result?.error ?? "generic");
        if (result?.error === "referral_code_conflict") {
          setReferralAvailabilityStatus("unavailable");
          setReferralAvailabilityReason("referral_code_conflict");
        } else {
          setReferralAvailabilityStatus("error");
          setReferralAvailabilityReason(result?.error ?? "error");
        }
        setReferralSuccess(false);
        return;
      }

      const payload = (await response.json().catch(() => null)) as
        | (Partial<Pick<ProfileSummaryPayload, "profile" | "membership">> & {
            profile?: ProfileSummaryPayload["profile"];
            membership?: ProfileSummaryPayload["membership"];
          })
        | null;
      const nextCode = payload?.profile?.referral_code ?? null;
      setReferralCode(nextCode);
      setReferralInput(nextCode ?? "");
      setReferralSuccess(true);
      setReferralAvailabilityStatus(nextCode ? "current" : "idle");
      setReferralAvailabilityReason(nextCode ? "ok" : null);
      onReferralCodeChange?.(nextCode);
      onProfileUpdate?.(payload);
      window.setTimeout(() => setReferralSuccess(false), 4000);
    } catch (err) {
      console.error("Failed to update referral code", err);
      setReferralServerErrorCode("generic");
      setReferralAvailabilityStatus("error");
      setReferralAvailabilityReason("error");
      setReferralSuccess(false);
    } finally {
      setReferralSaving(false);
    }
  };

  const handleReferralReset = () => {
    setReferralInput("");
    setReferralServerErrorCode(null);
    setReferralSuccess(false);
    setReferralAvailabilityStatus("idle");
    setReferralAvailabilityReason(null);
  };

  const affiliateLink = useMemo(() => {
    const shareCode = referralCode ?? shareCodeFallback;
    if (!shareCode) return "";
    if (typeof window === "undefined") return "";
    const baseUrl = window.location.origin;
    // Use the new affiliate page route
    return `${baseUrl}/${lang}/affiliate/${encodeURIComponent(shareCode)}`;
  }, [lang, referralCode, shareCodeFallback]);

  const referralCodeLabel = referralSettingsDict?.codeLabel ?? "Referral code";
  const referralHelperText =
    referralSettingsDict?.helper ??
    "Use 4-32 lowercase letters, numbers, or hyphens to personalize your referral link.";
  const referralPlaceholder = referralSettingsDict?.placeholder ?? "your-team-code";
  const referralSaveLabel = referralSaving
    ? referralSettingsDict?.saving ?? "Saving..."
    : referralSettingsDict?.save ?? "Save code";
  const referralResetLabel = referralSettingsDict?.reset ?? "Use generated code";
  const referralSuccessLabel =
    referralSettingsDict?.success ?? "Referral code updated successfully.";
  const referralLinkLabel =
    referralSettingsDict?.linkLabel ?? affiliateDict?.title ?? "Affiliate link";
  const referralCopyLabel = copied
    ? referralSettingsDict?.copied ?? affiliateDict?.copied ?? "Copied!"
    : referralSettingsDict?.copy ?? affiliateDict?.copy ?? "Copy link";

  return (
    <div className={className}>
      <form className={styles.formClassName} onSubmit={handleReferralSubmit}>
        <div className="space-y-2">
          <Label htmlFor={inputId} className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {referralCodeLabel}
          </Label>
          <div className="relative">
            <Input
              id={inputId}
              name={inputId}
              value={referralInput}
              onChange={(event) => {
                setReferralInput(event.target.value);
                setReferralServerErrorCode(null);
                setReferralSuccess(false);
                setReferralAvailabilityStatus("idle");
                setReferralAvailabilityReason(null);
              }}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={referralPlaceholder}
              disabled={referralSaving}
              className={cn(styles.codeInputClassName)}
            />
            {referralAvailabilityIcon ? (
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                {referralAvailabilityIcon}
              </span>
            ) : null}
          </div>
          <p className={styles.helperClassName}>{referralHelperText}</p>
          {referralAvailabilityFeedback ? (
            <p
              className={cn(
                "text-xs",
                referralAvailabilityFeedback.tone !== "muted" ? "font-medium" : undefined,
                REFERRAL_AVAILABILITY_TONE_CLASSES[referralAvailabilityFeedback.tone],
              )}
              aria-live="polite"
            >
              {referralAvailabilityFeedback.message}
            </p>
          ) : null}
        </div>
        {referralErrorMessage ? (
          <p className="text-xs font-medium text-rose-600 dark:text-rose-300">{referralErrorMessage}</p>
        ) : null}
        {referralSuccess ? (
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-300">{referralSuccessLabel}</p>
        ) : null}
        <div className={styles.actionsWrapperClassName}>
          <Button
            type="submit"
            disabled={
              referralSaving || referralUnchanged || referralHasClientError || referralIsChecking || referralIsUnavailable
            }
            className={styles.submitButtonClassName}
          >
            {referralSaveLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={referralSaving || referralInput.length === 0}
            onClick={handleReferralReset}
            className={styles.resetButtonClassName}
          >
            {referralResetLabel}
          </Button>
        </div>
      </form>
      <div className={styles.linkSectionClassName}>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{referralLinkLabel}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input readOnly value={affiliateLink} className={styles.linkInputClassName} />
          <Button
            type="button"
            disabled={!affiliateLink}
            onClick={async () => {
              if (!affiliateLink) return;
              try {
                await navigator.clipboard.writeText(affiliateLink);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              } catch (copyError) {
                console.error("Failed to copy affiliate link", copyError);
                setCopied(false);
                const title =
                  referralSettingsDict?.copyErrorTitle ?? "Unable to copy link";
                const description =
                  referralSettingsDict?.copyErrorDescription ??
                  "Try again or copy the link manually.";
                onCopyError?.({ title, description });
              }
            }}
            className={styles.copyButtonClassName}
          >
            {referralCopyLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

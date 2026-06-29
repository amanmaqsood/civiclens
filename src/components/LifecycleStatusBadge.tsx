import React from "react";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, ClipboardCheck, FileClock, Wrench } from "lucide-react";
import {
  IssueStatusKey,
  issueStatusDescription,
  issueStatusLabel,
  issueStatusToneClass,
  normalizeIssueStatus,
} from "../constants/status";

const STATUS_ICONS: Record<IssueStatusKey, LucideIcon> = {
  submitted: FileClock,
  verified: ClipboardCheck,
  in_progress: Wrench,
  resolved: CheckCircle2,
};

type LifecycleStatusBadgeSize = "sm" | "md" | "lg";

interface LifecycleStatusBadgeProps {
  status: unknown;
  size?: LifecycleStatusBadgeSize;
  showDescription?: boolean;
  className?: string;
}

const sizeClasses: Record<LifecycleStatusBadgeSize, string> = {
  sm: "min-h-[30px] px-2 py-1 text-sm",
  md: "min-h-[34px] px-2.5 py-1.5 text-sm",
  lg: "min-h-[40px] px-3 py-2 text-base",
};

const iconSizeClasses: Record<LifecycleStatusBadgeSize, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

export function LifecycleStatusIcon({ status, className = "h-4 w-4" }: { status: unknown; className?: string }) {
  const normalized = normalizeIssueStatus(status);
  const Icon = STATUS_ICONS[normalized];
  return <Icon className={className} aria-hidden="true" />;
}

export default function LifecycleStatusBadge({
  status,
  size = "md",
  showDescription = false,
  className = "",
}: LifecycleStatusBadgeProps) {
  const normalized = normalizeIssueStatus(status);
  const label = issueStatusLabel(normalized);
  const description = issueStatusDescription(normalized);

  return (
    <span
      data-lifecycle-status={normalized}
      aria-label={`Lifecycle status: ${label}. ${description}.`}
      title={`${label}: ${description}`}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-lg border font-bold leading-tight ${sizeClasses[size]} ${issueStatusToneClass(normalized)} ${className}`}
    >
      <LifecycleStatusIcon status={normalized} className={`${iconSizeClasses[size]} shrink-0`} />
      <span className="truncate">{label}</span>
      {showDescription && (
        <span className="hidden font-semibold sm:inline">
          {description}
        </span>
      )}
    </span>
  );
}

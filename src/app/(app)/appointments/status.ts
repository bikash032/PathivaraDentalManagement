import type { AppointmentStatus } from "@/generated/prisma/client";

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  SCHEDULED: "Scheduled",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked in",
  IN_CONSULTATION: "In consultation",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
};

export const STATUS_COLORS: Record<AppointmentStatus, string> = {
  SCHEDULED: "bg-line-soft text-ink-secondary",
  CONFIRMED: "bg-info-soft text-info-ink",
  CHECKED_IN: "bg-warning-soft text-warning-ink",
  IN_CONSULTATION: "bg-primary-soft text-primary",
  COMPLETED: "bg-success-soft text-success-ink",
  CANCELLED: "bg-danger-soft text-danger-ink",
  NO_SHOW: "bg-danger-soft text-danger-ink",
};

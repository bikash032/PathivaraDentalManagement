import type { AppointmentStatus } from "@/generated/prisma/client";
import { updateAppointmentStatusAction } from "./actions";

const NEXT_STATUS: Partial<Record<AppointmentStatus, { label: string; status: AppointmentStatus }[]>> = {
  SCHEDULED: [
    { label: "Confirm", status: "CONFIRMED" },
    { label: "Cancel", status: "CANCELLED" },
  ],
  CONFIRMED: [
    { label: "Check in", status: "CHECKED_IN" },
    { label: "No show", status: "NO_SHOW" },
    { label: "Cancel", status: "CANCELLED" },
  ],
  CHECKED_IN: [{ label: "Start consultation", status: "IN_CONSULTATION" }],
  IN_CONSULTATION: [{ label: "Complete", status: "COMPLETED" }],
};

export function StatusButtons({ appointmentId, status }: { appointmentId: string; status: AppointmentStatus }) {
  const actions = NEXT_STATUS[status];
  if (!actions || actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((a) => (
        <form key={a.status} action={updateAppointmentStatusAction.bind(null, appointmentId, a.status)}>
          <button
            type="submit"
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {a.label}
          </button>
        </form>
      ))}
    </div>
  );
}

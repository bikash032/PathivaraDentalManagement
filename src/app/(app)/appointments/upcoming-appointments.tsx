import Link from "next/link";
import { db } from "@/lib/db";
import { addADDays, getDayRangeNepal, toNepalDateInputValue } from "@/lib/date";
import { formatBSDateLong, formatNepalTime } from "@/lib/bs-date";
import { STATUS_COLORS, STATUS_LABELS } from "./status";

const UPCOMING_DAYS = 30;

// One stripe colour per doctor so their bookings are easy to tell apart.
const DOCTOR_STRIPES = [
  "border-l-primary",
  "border-l-secondary",
  "border-l-warning",
  "border-l-danger",
  "border-l-success",
  "border-l-accent",
];
const DOCTOR_DOTS = ["bg-primary", "bg-secondary", "bg-warning", "bg-danger", "bg-success", "bg-accent"];

/**
 * Bookings from now through the next month, grouped by Nepal day, shown beside
 * the booking form so staff can see who is already booked with which doctor.
 * Cancelled, no-show and completed appointments no longer occupy a slot.
 */
export async function UpcomingAppointments({
  doctors,
  timezone,
}: {
  doctors: { id: string; name: string }[];
  timezone: string;
}) {
  const now = new Date();
  const lastDay = addADDays(toNepalDateInputValue(now), UPCOMING_DAYS);

  const appointments = await db.appointment.findMany({
    where: {
      scheduledAt: { gte: now, lt: getDayRangeNepal(lastDay).end },
      status: { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED"] },
    },
    orderBy: { scheduledAt: "asc" },
    select: {
      id: true,
      scheduledAt: true,
      durationMinutes: true,
      status: true,
      reason: true,
      doctorId: true,
      patient: { select: { fullName: true, patientCode: true } },
      doctor: { select: { name: true } },
    },
  });

  // Colour index by doctor; doctors no longer active still get a stable colour.
  const colourIndex = new Map(doctors.map((d, i) => [d.id, i]));
  for (const a of appointments) {
    if (!colourIndex.has(a.doctorId)) colourIndex.set(a.doctorId, colourIndex.size);
  }
  const stripe = (doctorId: string) => DOCTOR_STRIPES[(colourIndex.get(doctorId) ?? 0) % DOCTOR_STRIPES.length];
  const dot = (doctorId: string) => DOCTOR_DOTS[(colourIndex.get(doctorId) ?? 0) % DOCTOR_DOTS.length];

  const perDoctor = new Map<string, { name: string; count: number }>();
  const days = new Map<string, typeof appointments>();
  for (const a of appointments) {
    const entry = perDoctor.get(a.doctorId) ?? { name: a.doctor.name, count: 0 };
    entry.count += 1;
    perDoctor.set(a.doctorId, entry);

    const day = toNepalDateInputValue(a.scheduledAt);
    const list = days.get(day) ?? [];
    list.push(a);
    days.set(day, list);
  }

  return (
    <aside className="rounded-lg border border-line bg-surface">
      <div className="border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">Upcoming appointments</h2>
        <p className="text-xs text-ink-muted">
          Next {UPCOMING_DAYS} days · {appointments.length} booked
        </p>
        {perDoctor.size > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-secondary">
            {[...perDoctor.entries()].map(([doctorId, d]) => (
              <li key={doctorId} className="flex items-center gap-1.5">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${dot(doctorId)}`} aria-hidden="true" />
                {d.name} ({d.count})
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {appointments.length === 0 ? (
        <p className="px-4 py-6 text-sm text-ink-muted">No appointments booked for the next {UPCOMING_DAYS} days.</p>
      ) : (
        <div className="max-h-[70vh] overflow-y-auto">
          {[...days.entries()].map(([day, list]) => (
            <section key={day} className="border-b border-line-soft last:border-b-0">
              <h3 className="sticky top-0 flex items-center justify-between bg-page px-4 py-1.5 text-xs font-semibold text-ink-secondary">
                <span>{formatBSDateLong(dayToDate(day))}</span>
                <span className="font-normal text-ink-muted">{list.length}</span>
              </h3>
              <ul>
                {list.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/appointments/${a.id}`}
                      className={`block border-l-4 px-4 py-2 hover:bg-page ${stripe(a.doctorId)}`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-ink">
                          {formatNepalTime(a.scheduledAt, timezone)}
                          <span className="ml-1 text-xs font-normal text-ink-muted">· {a.durationMinutes} min</span>
                        </span>
                        <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${STATUS_COLORS[a.status]}`}>
                          {STATUS_LABELS[a.status]}
                        </span>
                      </div>
                      <p className="text-sm text-ink">
                        {a.patient.fullName} <span className="text-xs text-ink-muted">({a.patient.patientCode})</span>
                      </p>
                      <p className="text-xs text-ink-secondary">
                        {a.doctor.name}
                        {a.reason ? ` · ${a.reason}` : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </aside>
  );
}

/** Noon on a Nepal calendar day — safely inside that day for BS formatting. */
function dayToDate(day: string): Date {
  return new Date(getDayRangeNepal(day).start.getTime() + 12 * 60 * 60 * 1000);
}

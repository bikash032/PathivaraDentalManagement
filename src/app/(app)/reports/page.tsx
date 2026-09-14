import Link from "next/link";
import { requirePermission } from "@/lib/auth/current-user";
import { db } from "@/lib/db";
import { getDayRangeNepal, toNepalDateInputValue, currentMonthStartNepal, formatDateNepal } from "@/lib/date";
import { formatNPR } from "@/lib/currency";
import { StatCard } from "@/components/stat-card";

const REPORT_TYPES = [
  { key: "collection", label: "Collection" },
  { key: "outstanding", label: "Outstanding" },
  { key: "patients", label: "Patient registrations" },
  { key: "appointments", label: "Appointments" },
  { key: "treatments", label: "Treatments" },
  { key: "doctors", label: "Doctor-wise" },
] as const;

type ReportType = (typeof REPORT_TYPES)[number]["key"];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; from?: string; to?: string }>;
}) {
  await requirePermission("report.view");
  const params = await searchParams;

  const type = (REPORT_TYPES.find((r) => r.key === params.type)?.key ?? "collection") as ReportType;
  const from = params.from || currentMonthStartNepal();
  const to = params.to || toNepalDateInputValue(new Date());

  // Inclusive range: start of `from` day to end of `to` day, in Nepal Time.
  const start = getDayRangeNepal(from).start;
  const end = getDayRangeNepal(to).end;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Reports</h1>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {REPORT_TYPES.map((r) => (
          <Link
            key={r.key}
            href={`/reports?type=${r.key}&from=${from}&to=${to}`}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              r.key === type ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="type" value={type} />
        <div className="space-y-1">
          <label htmlFor="from" className="block text-xs font-medium text-slate-500">
            From
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={from}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="to" className="block text-xs font-medium text-slate-500">
            To
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={to}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Apply
        </button>
      </form>

      <p className="text-sm text-slate-500">
        {formatDateNepal(start)} — {formatDateNepal(getDayRangeNepal(to).start)}
      </p>

      {type === "collection" ? <CollectionReport start={start} end={end} /> : null}
      {type === "outstanding" ? <OutstandingReport /> : null}
      {type === "patients" ? <PatientRegistrationReport start={start} end={end} /> : null}
      {type === "appointments" ? <AppointmentReport start={start} end={end} /> : null}
      {type === "treatments" ? <TreatmentReport start={start} end={end} /> : null}
      {type === "doctors" ? <DoctorReport start={start} end={end} /> : null}
    </div>
  );
}

async function CollectionReport({ start, end }: { start: Date; end: Date }) {
  const payments = await db.payment.findMany({
    where: { paymentDate: { gte: start, lt: end }, voidedAt: null },
    include: {
      paymentMethod: { select: { name: true } },
      invoice: { include: { patient: { select: { fullName: true, patientCode: true } } } },
    },
    orderBy: { paymentDate: "desc" },
  });

  const total = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const byMethod = new Map<string, number>();
  for (const p of payments) {
    byMethod.set(p.paymentMethod.name, (byMethod.get(p.paymentMethod.name) ?? 0) + Number(p.amount));
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total collected" value={formatNPR(total)} />
        <StatCard label="Payments" value={String(payments.length)} />
        {Array.from(byMethod.entries()).map(([method, amount]) => (
          <StatCard key={method} label={method} value={formatNPR(amount)} />
        ))}
      </div>

      <Table
        headers={["Date", "Patient", "Invoice", "Method", "Amount"]}
        rows={payments.map((p) => [
          formatDateNepal(p.paymentDate),
          p.invoice.patient.fullName,
          p.invoice.invoiceNumber,
          p.paymentMethod.name,
          formatNPR(p.amount),
        ])}
        emptyMessage="No payments in this period."
      />
    </div>
  );
}

async function OutstandingReport() {
  const invoices = await db.invoice.findMany({
    where: { status: { in: ["UNPAID", "PARTIALLY_PAID"] }, cancelledAt: null },
    include: { patient: { select: { fullName: true, patientCode: true, phone: true } } },
    orderBy: { createdAt: "asc" },
  });

  const totalOutstanding = invoices.reduce(
    (sum, inv) => sum + (Number(inv.totalAmount) - Number(inv.paidAmount)),
    0
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total outstanding" value={formatNPR(totalOutstanding)} />
        <StatCard label="Invoices" value={String(invoices.length)} />
      </div>

      <Table
        headers={["Invoice", "Date", "Patient", "Phone", "Total", "Paid", "Remaining"]}
        rows={invoices.map((inv) => [
          inv.invoiceNumber,
          formatDateNepal(inv.createdAt),
          inv.patient.fullName,
          inv.patient.phone,
          formatNPR(inv.totalAmount),
          formatNPR(inv.paidAmount),
          formatNPR(Number(inv.totalAmount) - Number(inv.paidAmount)),
        ])}
        emptyMessage="No outstanding invoices."
      />
    </div>
  );
}

async function PatientRegistrationReport({ start, end }: { start: Date; end: Date }) {
  const patients = await db.patient.findMany({
    where: { createdAt: { gte: start, lt: end } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="New patients" value={String(patients.length)} />
      </div>
      <Table
        headers={["Registered", "Patient ID", "Name", "Phone", "Gender"]}
        rows={patients.map((p) => [
          formatDateNepal(p.createdAt),
          p.patientCode,
          p.fullName,
          p.phone,
          p.gender,
        ])}
        emptyMessage="No patients registered in this period."
      />
    </div>
  );
}

async function AppointmentReport({ start, end }: { start: Date; end: Date }) {
  const appointments = await db.appointment.findMany({
    where: { scheduledAt: { gte: start, lt: end } },
    include: {
      patient: { select: { fullName: true, patientCode: true } },
      doctor: { select: { name: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  const counts = new Map<string, number>();
  for (const a of appointments) counts.set(a.status, (counts.get(a.status) ?? 0) + 1);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total appointments" value={String(appointments.length)} />
        {Array.from(counts.entries()).map(([status, count]) => (
          <StatCard key={status} label={status.replace("_", " ")} value={String(count)} />
        ))}
      </div>
      <Table
        headers={["Date", "Patient", "Doctor", "Status"]}
        rows={appointments.map((a) => [
          formatDateNepal(a.scheduledAt),
          a.patient.fullName,
          a.doctor.name,
          a.status.replace("_", " "),
        ])}
        emptyMessage="No appointments in this period."
      />
    </div>
  );
}

async function TreatmentReport({ start, end }: { start: Date; end: Date }) {
  const items = await db.invoiceItem.findMany({
    where: { invoice: { createdAt: { gte: start, lt: end }, cancelledAt: null } },
    include: { treatment: { select: { name: true } } },
  });

  const byTreatment = new Map<string, { quantity: number; revenue: number }>();
  for (const item of items) {
    const label = item.treatment?.name ?? item.description;
    const current = byTreatment.get(label) ?? { quantity: 0, revenue: 0 };
    byTreatment.set(label, {
      quantity: current.quantity + item.quantity,
      revenue: current.revenue + Number(item.lineTotal),
    });
  }

  const rows = Array.from(byTreatment.entries()).sort((a, b) => b[1].revenue - a[1].revenue);
  const totalRevenue = rows.reduce((sum, [, v]) => sum + v.revenue, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Billed (excl. cancelled)" value={formatNPR(totalRevenue)} />
        <StatCard label="Distinct services" value={String(rows.length)} />
      </div>
      <Table
        headers={["Treatment / item", "Quantity", "Billed amount"]}
        rows={rows.map(([label, v]) => [label, String(v.quantity), formatNPR(v.revenue)])}
        emptyMessage="No billed items in this period."
      />
    </div>
  );
}

async function DoctorReport({ start, end }: { start: Date; end: Date }) {
  const doctors = await db.user.findMany({
    where: { role: { key: "DOCTOR" } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const rows = await Promise.all(
    doctors.map(async (doctor) => {
      const [appointmentCount, completedCount, visitCount] = await Promise.all([
        db.appointment.count({ where: { doctorId: doctor.id, scheduledAt: { gte: start, lt: end } } }),
        db.appointment.count({
          where: { doctorId: doctor.id, scheduledAt: { gte: start, lt: end }, status: "COMPLETED" },
        }),
        db.visit.count({ where: { doctorId: doctor.id, visitDate: { gte: start, lt: end } } }),
      ]);
      return [doctor.name, String(appointmentCount), String(completedCount), String(visitCount)];
    })
  );

  return (
    <div className="space-y-4">
      <Table
        headers={["Doctor", "Appointments", "Completed", "Visits recorded"]}
        rows={rows}
        emptyMessage="No doctors found."
      />
    </div>
  );
}

function Table({
  headers,
  rows,
  emptyMessage,
}: {
  headers: string[];
  rows: string[][];
  emptyMessage: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-2 text-left font-medium text-slate-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-6 text-center text-slate-400">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2 text-slate-700">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

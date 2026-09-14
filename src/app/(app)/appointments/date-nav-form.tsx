"use client";

export function DateNavForm({ date, doctorId, status }: { date: string; doctorId?: string; status?: string }) {
  return (
    <form action="/appointments">
      <input type="hidden" name="doctorId" value={doctorId ?? ""} />
      <input type="hidden" name="status" value={status ?? ""} />
      <input
        type="date"
        name="date"
        defaultValue={date}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
    </form>
  );
}

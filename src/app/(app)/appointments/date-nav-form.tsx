"use client";

import { useRef } from "react";
import { BSDatePicker } from "@/components/bs-date-picker";

export function DateNavForm({ date, doctorId, status }: { date: string; doctorId?: string; status?: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action="/appointments">
      <input type="hidden" name="doctorId" value={doctorId ?? ""} />
      <input type="hidden" name="status" value={status ?? ""} />
      <div className="w-48">
        <BSDatePicker
          name="date"
          defaultValue={date}
          onChangeValue={() => {
            // let the hidden input commit its new value before submitting
            requestAnimationFrame(() => formRef.current?.requestSubmit());
          }}
        />
      </div>
    </form>
  );
}

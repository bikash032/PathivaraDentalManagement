import { db } from "@/lib/db";
import { getClinicTimezone } from "@/lib/clinic-settings";
import { ClinicProfileForm } from "./clinic-profile-form";
import { TimezoneForm } from "./timezone-form";
import { updateClinicProfileAction, updateTimezoneAction } from "./actions";

export default async function ClinicProfileSettingsPage() {
  const [profile, timezone] = await Promise.all([db.clinicProfile.findFirst(), getClinicTimezone()]);

  return (
    <div className="space-y-8">
      <ClinicProfileForm
        action={updateClinicProfileAction}
        initialValues={{
          clinicName: profile?.clinicName ?? "Pathivara Dental Clinic",
          address: profile?.address ?? "",
          phone: profile?.phone ?? "",
          email: profile?.email ?? "",
          panNumber: profile?.panNumber ?? "",
          receiptFooterNote: profile?.receiptFooterNote ?? "",
        }}
      />

      <div className="max-w-xl border-t border-slate-200 pt-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Date &amp; time</h2>
        <TimezoneForm action={updateTimezoneAction} currentTimezone={timezone} />
      </div>
    </div>
  );
}

import { db } from "@/lib/db";
import { ClinicProfileForm } from "./clinic-profile-form";
import { updateClinicProfileAction } from "./actions";

export default async function ClinicProfileSettingsPage() {
  const profile = await db.clinicProfile.findFirst();

  return (
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
  );
}

/**
 * The clinic's official identity. These are the defaults every screen and
 * printed document falls back to; the editable copy lives in Settings
 * (ClinicProfile) and is read through `getClinicProfile()`.
 */
export const OFFICIAL_CLINIC_NAME = "पाथिभरा डेण्टल क्लिनिक प्रा. लि";
export const OFFICIAL_CLINIC_ADDRESS = "चौदण्डिगडी नगरपालिका-६, बेल्टार, बसपार्क";

/** The English name seeded before the official Nepali identity was adopted. */
export const LEGACY_CLINIC_NAME = "Pathivara Dental Clinic";

/**
 * Footer slogan on patient-facing printouts: primary slogan, supporting
 * message, thank-you. Emoji are kept separate from the text so they can use an
 * emoji font without affecting the Devanagari.
 */
export const CLINIC_SLOGAN: readonly { lead: string; text: string; trail?: string }[] = [
  { lead: "🦷", text: "स्वस्थ मुस्कान, सुखी जीवन!", trail: "😊" },
  { lead: "💙", text: "तपाईंको मुस्कान, हाम्रो प्राथमिकता।" },
  { lead: "🙏", text: "हाम्रो सेवा रोज्नुभएकोमा धन्यवाद!" },
];

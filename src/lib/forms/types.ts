/** Custom forms shared types. */

export type FormType =
  | "waiver"
  | "application"
  | "contract"
  | "medical_intake"
  | "custom";

export type FormFieldType =
  | "text"
  | "textarea"
  | "email"
  | "tel"
  | "date"
  | "select"
  | "radio"
  | "checkbox"
  | "signature"
  | "acknowledgement";

export type FormField = {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  help_text?: string;
  options?: string[]; // for select / radio / checkbox
  sensitive?: boolean; // medical etc. — hidden by default in submissions list
  // For acknowledgement fields: the text the user must agree to.
  acknowledgement_text?: string;
};

export type CustomForm = {
  id: string;
  studio_id: string;
  form_type: FormType;
  name: string;
  description: string | null;
  intro_text: string | null;
  success_message: string | null;
  fields: FormField[];
  requires_signature: boolean;
  is_active: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export const FORM_TYPE_LABEL: Record<FormType, string> = {
  waiver: "Waiver",
  application: "Application",
  contract: "Contract",
  medical_intake: "Medical intake",
  custom: "Custom",
};

/**
 * Short two-letter label for each form type. Used as a compact color-coded
 * badge in the forms list. No emojis — matches the rest of the app.
 */
export const FORM_TYPE_BADGE: Record<FormType, string> = {
  waiver: "WV",
  application: "AP",
  contract: "CT",
  medical_intake: "MI",
  custom: "CU",
};

export const DEFAULT_FIELDS_BY_TYPE: Record<FormType, FormField[]> = {
  waiver: [
    { id: "full_name", label: "Full name", type: "text", required: true },
    { id: "email", label: "Email", type: "email", required: true },
    { id: "dob", label: "Date of birth", type: "date", required: true },
    {
      id: "waiver_body",
      label: "I have read and agree to the liability waiver",
      type: "acknowledgement",
      required: true,
      acknowledgement_text:
        "I acknowledge the inherent risks of yoga and movement practice and release the studio from liability.",
    },
  ],
  application: [
    { id: "full_name", label: "Full name", type: "text", required: true },
    { id: "email", label: "Email", type: "email", required: true },
    { id: "phone", label: "Phone", type: "tel", required: false },
    {
      id: "experience",
      label: "Years of teaching experience",
      type: "text",
      required: true,
    },
    {
      id: "certifications",
      label: "Certifications",
      type: "textarea",
      required: true,
    },
    {
      id: "availability",
      label: "Which days could you teach?",
      type: "checkbox",
      required: false,
      options: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    },
    { id: "about", label: "Tell us about yourself", type: "textarea", required: true },
  ],
  contract: [
    { id: "full_name", label: "Full name", type: "text", required: true },
    { id: "email", label: "Email", type: "email", required: true },
    { id: "start_date", label: "Start date", type: "date", required: true },
  ],
  medical_intake: [
    { id: "full_name", label: "Full name", type: "text", required: true },
    { id: "dob", label: "Date of birth", type: "date", required: true },
    {
      id: "conditions",
      label: "Current medical conditions",
      type: "textarea",
      required: false,
      sensitive: true,
    },
    {
      id: "injuries",
      label: "Recent injuries",
      type: "textarea",
      required: false,
      sensitive: true,
    },
    {
      id: "pregnant",
      label: "Are you pregnant?",
      type: "radio",
      required: false,
      options: ["Yes", "No", "Prefer not to say"],
      sensitive: true,
    },
    {
      id: "medications",
      label: "Medications",
      type: "textarea",
      required: false,
      sensitive: true,
    },
    {
      id: "emergency_contact",
      label: "Emergency contact name & phone",
      type: "text",
      required: true,
    },
  ],
  custom: [
    { id: "full_name", label: "Full name", type: "text", required: true },
    { id: "email", label: "Email", type: "email", required: true },
  ],
};

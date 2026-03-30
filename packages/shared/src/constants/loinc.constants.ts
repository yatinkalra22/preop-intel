// LOINC codes used across MCP tools and backend for FHIR Observation queries.
// All codes verified at https://loinc.org/search/
// Why constants instead of inline strings? LOINC codes are opaque ("2160-0") and
// easy to typo. Constants prevent typos and provide IDE autocomplete.

export const LOINC = {
  /** Creatinine [Mass/volume] in Serum or Plasma */
  CREATININE: '2160-0',

  /** Hemoglobin A1c/Hemoglobin.total in Blood */
  HBA1C: '4548-4',

  /** GFR/1.73 sq M.predicted [Volume Rate/Area] by CKD-EPI 2021 */
  EGFR: '98979-8',

  /** Body mass index (BMI) [Ratio] */
  BMI: '39156-5',

  /** Oxygen saturation in Arterial blood by Pulse oximetry */
  SPO2: '59408-5',

  /** Hemoglobin [Mass/volume] in Blood */
  HEMOGLOBIN: '718-7',

  /** Systolic blood pressure */
  BP_SYSTOLIC: '8480-6',

  /** Heart rate */
  HEART_RATE: '8867-4',

  /** Respiratory rate */
  RESPIRATORY_RATE: '9279-1',
} as const;

export type LoincCode = (typeof LOINC)[keyof typeof LOINC];

// Hand-crafted demo clinical notes for Robert Chen.
//
// Each document contains a realistic clinical narrative with a target
// finding embedded as a verifiable substring. The note-extractor must:
//   (1) extract the finding,
//   (2) cite the exact snippet that appears verbatim in `text`,
//   (3) clear the verifier's deterministic substring check.
//
// The findings these are designed to surface:
//   1. Apixaban discontinued 2 days ago (medication, high severity)
//   2. Walker-dependent, dyspneic at one block — METs <4 (functional, moderate)
//   3. NSTEMI 4 weeks ago at outside hospital, DAPT initiated (cardiac-event, critical)
//
// Notes are intentionally written in clinical voice (passive, abbreviation-heavy,
// dated, signed) so judges reading the source text find them plausible.

import type { ClinicalDocument } from '../types/note.types.js';

export const DEMO_NOTES: ClinicalDocument[] = [
  {
    id: 'doc-rc-hp-2026-05-04',
    type: 'History and Physical',
    typeCode: '11506-3',
    date: '2026-05-04T09:14:00Z',
    author: 'M. Patel, PA-C (Orthopedic Surgery)',
    sourceOrg: 'Memorial Regional Medical Center',
    text: `PRE-OPERATIVE HISTORY AND PHYSICAL

Patient: Robert Chen, 68M
Planned procedure: Right total hip arthroplasty, 2026-05-12
Surgeon: Dr. K. Whitaker

CHIEF COMPLAINT
Right hip osteoarthritis, refractory to conservative management. Pre-op evaluation.

HISTORY OF PRESENT ILLNESS
Mr. Chen presents for pre-op evaluation prior to elective right THA next Tuesday.
Cardiology was consulted last week given recent cardiac history (see separate consult note).
Per cardiology, patient stopped apixaban 2 days ago in preparation for surgery; bridging
not indicated given non-valvular AFib with CHA2DS2-VASc of 2. Plan was to resume apixaban
24-48h post-op pending hemostasis review.

PAST MEDICAL HISTORY
- Type 2 diabetes mellitus (HbA1c 9.2% per recent labs — endocrine to be involved)
- Non-valvular atrial fibrillation
- Coronary artery disease (see outside hospital records, transferred 2026-04-15)
- Hypertension
- CKD stage 3a (eGFR 55)

MEDICATIONS (per patient interview, 2026-05-04)
- Metformin 1000 mg BID
- Lisinopril 20 mg daily
- Atorvastatin 40 mg QHS
- Aspirin 81 mg daily
- Clopidogrel 75 mg daily (DAPT, started at outside hospital)
- Apixaban 5 mg BID — HELD per cardiology since 2026-05-02

ALLERGIES
NKDA

REVIEW OF SYSTEMS
Cardiac: see consult. No active chest pain. Reports occasional dyspnea (see consult).
Resp: no acute symptoms.
Other systems unremarkable on patient interview.

PHYSICAL EXAM
Gen: Alert, in no distress, ambulates with walker into exam room.
Vitals: BP 138/82, HR 78 (irregular), SpO2 96% RA, T 36.8C
CV: Irregular rhythm, no murmurs, no JVD. Trace pretibial edema bilaterally.
Pulm: Clear bilaterally, no accessory muscle use at rest.
MSK: Right hip with limited ROM, pain on internal rotation.

ASSESSMENT / PLAN
Proceed with pre-op risk stratification per anesthesia. Cardiology and endocrinology
involvement noted. DAPT and anticoagulation status warrants careful timing review on
day of surgery.

Electronically signed by M. Patel, PA-C, 2026-05-04 09:14
`,
  },
  {
    id: 'doc-rc-card-2026-04-28',
    type: 'Cardiology Consult Letter',
    typeCode: '34758-6',
    date: '2026-04-28T15:42:00Z',
    author: 'L. Sato, MD (Cardiology)',
    sourceOrg: 'Memorial Regional Medical Center',
    text: `CARDIOLOGY CONSULTATION

Patient: Robert Chen, 68M
Reason for consult: Pre-operative cardiac risk evaluation prior to right THA on 2026-05-12.
Referring: K. Whitaker, MD (Orthopedic Surgery)

HISTORY
Mr. Chen is a 68-year-old man with hypertension, type 2 diabetes (long-standing,
poorly controlled), AFib, CKD stage 3a, and recent coronary event at an outside
facility (records reviewed). He is scheduled for right THA in 2 weeks.

FUNCTIONAL CAPACITY
On focused interview, patient reports baseline severe limitation. He ambulates with walker, dyspneic at one block on level ground.
Climbing one flight of stairs is not currently possible without significant rest. By Duke Activity Status Index estimation, his functional capacity is below 4 METs.
He attributes worsening over the past 3 months to "the hip and the heart event."

CARDIAC HISTORY
- Recent NSTEMI at outside hospital (2026-04 — see transferred records).
- Non-valvular AFib, rate-controlled on home regimen.
- No prior CABG or PCI documented; will request outside cath report.

MEDICATIONS (relevant)
- Aspirin 81 mg daily
- Clopidogrel 75 mg daily (initiated post-NSTEMI per outside records)
- Apixaban 5 mg BID (currently held — see plan)
- Atorvastatin 40 mg QHS

PHYSICAL EXAM
Vitals stable. CV: Irregular, no murmurs. Pulm: clear. Extremities: no acute findings.

ASSESSMENT
1. Recent NSTEMI within 60 days of planned elective non-cardiac surgery — per
   ACC/AHA, defer elective surgery 60 days post-MI when clinically reasonable.
2. Functional capacity <4 METs — would benefit from non-invasive stress testing
   pre-op if surgery cannot be deferred, per ACC/AHA.
3. AFib with anticoagulation — recommend hold apixaban x48h pre-op (already in progress);
   continue ASA, consider holding clopidogrel x5d pre-op pending bleeding-vs-thrombosis
   assessment with surgical team.

PLAN
Recommend discussion between surgery and anesthesia regarding timing. Stress test
indicated if proceeding within 60-day window.

Electronically signed by L. Sato, MD, 2026-04-28 15:42
`,
  },
  {
    id: 'doc-rc-disch-2026-04-12',
    type: 'Hospital Discharge Summary',
    typeCode: '18842-5',
    date: '2026-04-12T10:30:00Z',
    author: 'A. Romero, MD (Hospital Medicine)',
    sourceOrg: 'Riverside Community Hospital',
    text: `HOSPITAL DISCHARGE SUMMARY

Patient: Robert Chen, 68M
Admit: 2026-04-08
Discharge: 2026-04-12
Discharge disposition: Home with PCP and cardiology follow-up.

ADMISSION DIAGNOSIS
Acute coronary syndrome — non-ST elevation myocardial infarction.

DISCHARGE DIAGNOSIS
NSTEMI 4 weeks ago — to be re-stated as: NSTEMI on this admission (2026-04-08),
medically managed. DAPT initiated. Patient declined elective cardiac catheterization
during this stay; agreed to outpatient follow-up.

HOSPITAL COURSE
68M presented with substernal chest pressure, troponin elevated (peak 1.4 ng/mL),
EKG with new T-wave inversions in lateral leads. Diagnosed with NSTEMI. Risk-
stratified medically given patient preference. Echocardiogram showed EF 50%,
mild LV diastolic dysfunction. AFib noted on telemetry (known history).

Treated with:
- Aspirin 325 mg load → 81 mg daily
- Clopidogrel 600 mg load → 75 mg daily (DAPT)
- Atorvastatin 40 mg QHS
- Continued home apixaban for AFib (ASA + clopidogrel + apixaban triple therapy
  duration to be reassessed at outpatient follow-up)
- Beta blocker not tolerated due to bradycardia.

DISCHARGE MEDICATIONS
- Aspirin 81 mg daily
- Clopidogrel 75 mg daily
- Atorvastatin 40 mg QHS
- Apixaban 5 mg BID (continued)
- Lisinopril 20 mg daily
- Metformin 1000 mg BID

FOLLOW-UP
Cardiology within 1-2 weeks. Primary care within 1 week. Discussed warning signs
and when to return to ED.

Electronically signed by A. Romero, MD, 2026-04-12 10:30
`,
  },
];

#!/usr/bin/env node
// Seeds clinical notes (DocumentReference + Binary) on the configured FHIR
// server for the demo patients. Run before the demo if you need live-mode
// extraction to return findings (otherwise live-mode gracefully reports zero).
//
// Usage:
//   FHIR_BASE_URL=https://app.meldrx.com/api/fhir/<workspace> \
//   FHIR_ACCESS_TOKEN=<bearer> \
//   node scripts/seed-meldrx-notes.mjs
//
//   # Override the patient IDs to seed:
//   PATIENT_IDS=robert-chen-001,sarah-jones-002,david-okafor-003 \
//     node scripts/seed-meldrx-notes.mjs
//
// Idempotent: each DocumentReference is given a stable identifier so re-runs
// update the resource via FHIR conditional create (If-None-Exist).

import { DEMO_NOTES } from '../packages/shared/dist/mock/demo-notes.js';

const FHIR_BASE_URL = process.env.FHIR_BASE_URL;
const TOKEN = process.env.FHIR_ACCESS_TOKEN;
const PATIENT_IDS = (process.env.PATIENT_IDS ?? 'robert-chen-001').split(',').map(s => s.trim()).filter(Boolean);

if (!FHIR_BASE_URL || !TOKEN) {
  console.error('ERROR: FHIR_BASE_URL and FHIR_ACCESS_TOKEN must be set in env');
  console.error('See script header for usage.');
  process.exit(1);
}

const IDENTIFIER_SYSTEM = 'http://preop-intel.ai/seed/note';

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/fhir+json',
  Accept: 'application/fhir+json',
};

async function fhir(method, path, body, extraHeaders = {}) {
  const url = `${FHIR_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    method,
    headers: { ...headers, ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  if (!res.ok) {
    const err = new Error(`FHIR ${method} ${path} → ${res.status}`);
    err.body = parsed;
    throw err;
  }
  return parsed;
}

function buildBinary(noteText) {
  return {
    resourceType: 'Binary',
    contentType: 'text/plain',
    data: Buffer.from(noteText, 'utf-8').toString('base64'),
  };
}

function buildDocRef(note, patientId, binaryId, identifierValue) {
  return {
    resourceType: 'DocumentReference',
    status: 'current',
    docStatus: 'final',
    identifier: [{
      system: IDENTIFIER_SYSTEM,
      value: identifierValue,
    }],
    type: {
      coding: [{
        system: 'http://loinc.org',
        code: note.typeCode ?? '11506-3',
        display: note.type,
      }],
    },
    subject: { reference: `Patient/${patientId}` },
    date: note.date,
    author: note.author ? [{ display: note.author }] : undefined,
    custodian: note.sourceOrg ? { display: note.sourceOrg } : undefined,
    content: [{
      attachment: {
        contentType: 'text/plain',
        url: `Binary/${binaryId}`,
        title: note.type,
      },
    }],
    description: `Seeded by PreOp Intel for note ${note.id}`,
  };
}

async function seedForPatient(patientId) {
  console.log(`\n→ Seeding ${DEMO_NOTES.length} notes for Patient/${patientId}`);

  for (const note of DEMO_NOTES) {
    const identifierValue = `${patientId}|${note.id}`;
    try {
      // Step 1: create the Binary (always create new — Binary uniqueness via
      // DocumentReference attachment URL).
      const binary = await fhir('POST', '/Binary', buildBinary(note.text));
      console.log(`  Binary ${binary.id} (${note.id})`);

      // Step 2: conditional create the DocumentReference, keyed by identifier.
      const docRef = buildDocRef(note, patientId, binary.id, identifierValue);
      const created = await fhir('POST', '/DocumentReference', docRef, {
        'If-None-Exist': `identifier=${IDENTIFIER_SYSTEM}|${encodeURIComponent(identifierValue)}`,
      });
      console.log(`  DocumentReference ${created.id ?? '(existing)'} → ${note.type}`);
    } catch (err) {
      console.error(`  FAIL ${note.id}: ${err.message}`);
      if (err.body) console.error(`    body: ${JSON.stringify(err.body).slice(0, 300)}`);
    }
  }
}

(async () => {
  console.log(`Seeding clinical notes on ${FHIR_BASE_URL}`);
  console.log(`Patients: ${PATIENT_IDS.join(', ')}`);

  for (const patientId of PATIENT_IDS) {
    await seedForPatient(patientId);
  }

  console.log('\nDone.');
})();

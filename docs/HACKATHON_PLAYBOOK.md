# PreOp Intel - Hackathon Playbook (Agents Assemble)

## 1) Submission Positioning

PreOp Intel is a multi-agent perioperative risk copilot that:
- Reads FHIR R4 data in real time.
- Computes validated risk scores (RCRI, ARISCAT, metabolic flags).
- Uses an orchestrator LLM to synthesize actionable recommendations.
- Writes structured outputs back as FHIR resources (RiskAssessment, CarePlan, Flag, ServiceRequest).

This maps tightly to the challenge's MCP + A2A + FHIR vision and "last-mile" clinical actionability.

## 2) Judging Criteria Mapping

### The AI Factor
- AI is used for cross-domain synthesis and rationale generation, not simple if/else rules.
- Claude orchestrator produces clinician-readable narrative + urgency-tagged recommendations.

### Potential Impact
- Targets pre-op complications, cancellation risk, and optimization delays.
- Produces machine-readable outputs that can trigger downstream workflows.
- Demonstrates a clear pathway to improved outcomes and reduced day-of-surgery surprises.

### Feasibility
- Uses FHIR R4 standards and SMART-style context assumptions.
- Persists only metadata and computed risk payloads in app DB.
- Keeps source-of-truth PHI in the FHIR server.

## 3) 3-Minute Demo Storyboard

### 0:00-0:30 - Problem + Context
- Show surgeon dashboard and patient summary.
- State the pain point: fragmented pre-op risk review.

### 0:30-1:40 - Agentic Workflow
- Start assessment.
- Show live agent status stream (cardiac, pulmonary, metabolic, orchestrator).
- Call out parallel specialist analysis and orchestration.

### 1:40-2:30 - Clinical Decision Support
- Show risk gauges and overall risk banner.
- Highlight urgent concerns and recommendations with urgency levels.

### 2:30-3:00 - Interoperability Win
- Show generated FHIR resources section.
- Emphasize write-back for continuity and multi-agent reuse.

## 4) Judge-Facing Talking Points

- "We are not replacing clinicians; we are reducing cognitive load and surfacing unsafe signals early."
- "Our key innovation is end-to-end loop closure: FHIR in, AI synthesis, FHIR out."
- "The architecture is standards-first: MCP tooling, agent orchestration, and FHIR-native outputs."

## 5) Final Checklist Before Submission

- Confirm assessment flow works in both demo and live data modes.
- Verify SSE agent updates are visible during demo run.
- Verify final result and recommendations persist and reload correctly.
- Ensure README includes architecture diagram and setup commands.
- Record a clean <= 3 minute demo with no dead time.
- Include repository link, video link, and clear installation notes on Devpost.

# PreOp Intel

PreOp Intel is a multi-agent perioperative risk intelligence system that reads FHIR data, computes validated risk scores, synthesizes recommendations with an orchestrator LLM, and writes actionable outputs back as FHIR resources.

## Architecture

```mermaid
flowchart LR
    subgraph Frontend[Next.js Frontend]
      UI[Dashboard + Patient + Assessment UI]
      SSE[SSE Listener]
    end

    subgraph Backend[NestJS API]
      AC[Assessment Controller]
      AS[Assessment Service]
      AG[Agents Service]
      AI[AI Service]
      FH[FHIR Service]
      DB[(PostgreSQL)]
      RD[(Redis Cache)]
    end

    subgraph MCP[MCP Server]
      RT[FHIR Read Tools]
      CT[Risk Calculator Tools]
      WT[FHIR Write Tools]
    end

    subgraph External[External Systems]
      FS[(FHIR R4 Server)]
      AN[Anthropic Claude]
    end

    UI -->|POST /assessments/start| AC
    UI -->|GET /assessments/:id/stream| SSE
    SSE -->|agent updates| AC

    AC --> AS
    AS --> DB
    AC --> AG

    AG --> FH
    FH --> RD
    FH --> FS

    AG --> AI
    AI --> AN

    AG --> DB
    AG --> RT
    AG --> CT
    AG --> WT

    RT --> FS
    WT --> FS
```

## Why This Is Different

- Multi-agent workflow: cardiac, pulmonary, metabolic, then orchestrator synthesis.
- Standards-first interoperability: FHIR-native inputs and outputs.
- Last-mile utility: recommendations plus structured write-back (RiskAssessment, CarePlan, Flag, ServiceRequest).

## Quick Start

```bash
npm install
npm run build
npm run dev
```

## Demo And Submission Docs

- Playbook: [docs/HACKATHON_PLAYBOOK.md](docs/HACKATHON_PLAYBOOK.md)

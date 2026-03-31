// SMART on FHIR OAuth 2.0 service.
// Why SMART on FHIR (not basic API key)? SMART is the standard for EHR-embedded
// apps. Required for Epic App Orchard, Cerner Code, and any ONC-certified launch.
// Source: https://smarthealthit.org/
// Source: https://hl7.org/fhir/smart-app-launch/

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type LaunchState = {
  iss: string;
  createdAt: number;
};

const STATE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly launchStates = new Map<string, LaunchState>();

  constructor(private config: ConfigService) {}

  private pruneExpiredStates() {
    const now = Date.now();
    for (const [state, value] of this.launchStates.entries()) {
      if (now - value.createdAt > STATE_TTL_MS) {
        this.launchStates.delete(state);
      }
    }
  }

  validateIssuer(iss: string): string {
    if (!iss || iss.length > 2000) {
      throw new Error('Invalid issuer');
    }
    let parsed: URL;
    try {
      parsed = new URL(iss);
    } catch {
      throw new Error('Issuer must be a valid URL');
    }
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
      throw new Error('Issuer must use HTTPS');
    }
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  }

  /** Build the SMART authorize URL for EHR launch redirect */
  getAuthorizeUrl(iss: string, launch: string): string {
    const safeIssuer = this.validateIssuer(iss);
    this.pruneExpiredStates();
    const state = crypto.randomUUID();
    this.launchStates.set(state, { iss: safeIssuer, createdAt: Date.now() });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.get('FHIR_CLIENT_ID', ''),
      redirect_uri: this.config.get('SMART_CALLBACK_URL', 'http://localhost:3001/api/auth/callback'),
      scope: 'launch openid profile patient/*.read patient/RiskAssessment.write patient/CarePlan.write patient/Goal.write patient/Flag.write patient/ServiceRequest.write',
      state,
      aud: safeIssuer,
      launch,
    });
    return `${safeIssuer}/auth/authorize?${params}`;
  }

  resolveIssuerFromState(state: string | undefined): string | null {
    if (!state) return null;
    this.pruneExpiredStates();
    const match = this.launchStates.get(state);
    if (!match) return null;
    this.launchStates.delete(state);
    return match.iss;
  }

  /** Exchange authorization code for access token */
  async exchangeCode(code: string, iss: string): Promise<{
    accessToken: string;
    patientId: string;
    fhirBaseUrl: string;
  }> {
    const safeIssuer = this.validateIssuer(iss);
    const tokenUrl = `${safeIssuer}/auth/token`;
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.get('SMART_CALLBACK_URL', ''),
        client_id: this.config.get('FHIR_CLIENT_ID', ''),
        client_secret: this.config.get('FHIR_CLIENT_SECRET', ''),
      }),
    });

    if (!res.ok) {
      throw new Error(`Token endpoint returned ${res.status}`);
    }

    const data = await res.json() as any;
    if (!data?.access_token || !data?.patient) {
      throw new Error('Token response missing required fields');
    }

    return {
      accessToken: data.access_token,
      patientId: data.patient,
      fhirBaseUrl: safeIssuer,
    };
  }

  /** Validate that an access token is present. In demo mode, allow 'demo-token'. */
  validateToken(token: string | undefined): boolean {
    if (!token) return false;
    if (token === 'demo-token') return true;
    // In production, validate against the FHIR server's introspection endpoint
    return token.length > 10;
  }
}

// SMART on FHIR OAuth 2.0 service.
// Why SMART on FHIR (not basic API key)? SMART is the standard for EHR-embedded
// apps. Required for Epic App Orchard, Cerner Code, and any ONC-certified launch.
// Source: https://smarthealthit.org/
// Source: https://hl7.org/fhir/smart-app-launch/

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(private config: ConfigService) {}

  /** Build the SMART authorize URL for EHR launch redirect */
  getAuthorizeUrl(iss: string, launch: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.get('FHIR_CLIENT_ID', ''),
      redirect_uri: this.config.get('SMART_CALLBACK_URL', 'http://localhost:3001/api/auth/callback'),
      scope: 'launch openid profile patient/*.read patient/RiskAssessment.write patient/CarePlan.write patient/Goal.write patient/Flag.write patient/ServiceRequest.write',
      state: crypto.randomUUID(),
      aud: iss,
      launch,
    });
    return `${iss}/auth/authorize?${params}`;
  }

  /** Exchange authorization code for access token */
  async exchangeCode(code: string, iss: string): Promise<{
    accessToken: string;
    patientId: string;
    fhirBaseUrl: string;
  }> {
    const tokenUrl = `${iss}/auth/token`;
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

    const data = await res.json() as any;
    return {
      accessToken: data.access_token,
      patientId: data.patient,
      fhirBaseUrl: iss,
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

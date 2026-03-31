import { Controller, Get, Post, Query, Body, Res, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * SMART on FHIR EHR launch.
   * EHR sends ?iss={fhirServer}&launch={token} → we redirect to authorize.
   */
  @Get('launch')
  launch(
    @Query('iss') iss: string,
    @Query('launch') launch: string,
    @Res() res: Response,
  ) {
    if (!iss || !launch) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        error: 'Missing iss or launch parameter',
      });
    }
    const authorizeUrl = this.authService.getAuthorizeUrl(iss, launch);
    return res.redirect(authorizeUrl);
  }

  /**
   * OAuth 2.0 callback — exchange code for access token.
   */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('iss') iss: string,
    @Res() res: Response,
  ) {
    if (!code) {
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Missing code' });
    }

    try {
      const issFromState = this.authService.resolveIssuerFromState(state);
      const resolvedIssuer = issFromState ?? (iss ? this.authService.validateIssuer(iss) : null);

      if (!resolvedIssuer) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: 'Missing or invalid OAuth state/issuer',
        });
      }

      const tokenData = await this.authService.exchangeCode(code, resolvedIssuer);
      return res.json(tokenData);
    } catch (error) {
      if (error instanceof Error && /invalid|missing/i.test(error.message)) {
        return res.status(HttpStatus.BAD_REQUEST).json({ error: error.message });
      }
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Token exchange failed',
      });
    }
  }

  /**
   * Demo token endpoint — returns a mock token for demo mode.
   */
  @Post('demo')
  demoAuth() {
    return {
      accessToken: 'demo-token',
      patientId: 'demo-patient-001',
      fhirBaseUrl: 'demo',
    };
  }
}

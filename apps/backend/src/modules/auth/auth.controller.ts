import { Controller, Get, Post, Query, Body, Res, HttpStatus, Req } from '@nestjs/common';
import type { Response } from 'express';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AuditService } from '../security/audit.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * SMART on FHIR EHR launch.
   * EHR sends ?iss={fhirServer}&launch={token} → we redirect to authorize.
   */
  @Get('launch')
  launch(
    @Query('iss') iss: string,
    @Query('launch') launch: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!iss || !launch) {
      this.auditService.log({
        action: 'auth.launch',
        outcome: 'failure',
        requestId: (req as any).requestId,
        ip: req.ip,
        details: { reason: 'missing_iss_or_launch' },
      });
      return res.status(HttpStatus.BAD_REQUEST).json({
        error: 'Missing iss or launch parameter',
      });
    }

    try {
      const authorizeUrl = this.authService.getAuthorizeUrl(iss, launch);
      this.auditService.log({
        action: 'auth.launch',
        outcome: 'success',
        requestId: (req as any).requestId,
        ip: req.ip,
        details: { issuer: new URL(iss).host },
      });
      return res.redirect(authorizeUrl);
    } catch (error) {
      this.auditService.log({
        action: 'auth.launch',
        outcome: 'failure',
        requestId: (req as any).requestId,
        ip: req.ip,
        details: { reason: error instanceof Error ? error.message : 'invalid_request' },
      });
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Invalid issuer' });
    }
  }

  /**
   * OAuth 2.0 callback — exchange code for access token.
   */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('iss') iss: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!code) {
      this.auditService.log({
        action: 'auth.callback',
        outcome: 'failure',
        requestId: (req as any).requestId,
        ip: req.ip,
        details: { reason: 'missing_code' },
      });
      return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Missing code' });
    }

    try {
      const issFromState = this.authService.resolveIssuerFromState(state);
      const resolvedIssuer = issFromState ?? (iss ? this.authService.validateIssuer(iss) : null);

      if (!resolvedIssuer) {
        this.auditService.log({
          action: 'auth.callback',
          outcome: 'failure',
          requestId: (req as any).requestId,
          ip: req.ip,
          details: { reason: 'missing_or_invalid_state_issuer' },
        });
        return res.status(HttpStatus.BAD_REQUEST).json({
          error: 'Missing or invalid OAuth state/issuer',
        });
      }

      const tokenData = await this.authService.exchangeCode(code, resolvedIssuer);
      this.auditService.log({
        action: 'auth.callback',
        outcome: 'success',
        requestId: (req as any).requestId,
        ip: req.ip,
        patientId: tokenData.patientId,
        details: { issuer: new URL(resolvedIssuer).host },
      });
      return res.json(tokenData);
    } catch (error) {
      this.auditService.log({
        action: 'auth.callback',
        outcome: 'failure',
        requestId: (req as any).requestId,
        ip: req.ip,
        details: { reason: error instanceof Error ? error.message : 'callback_error' },
      });
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
  demoAuth(@Req() req: Request) {
    this.auditService.log({
      action: 'auth.demo',
      outcome: 'success',
      requestId: (req as any).requestId,
      ip: req.ip,
      patientId: 'demo-patient-001',
    });
    return {
      accessToken: 'demo-token',
      patientId: 'demo-patient-001',
      fhirBaseUrl: 'demo',
    };
  }
}

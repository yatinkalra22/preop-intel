import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * Guard that validates SMART on FHIR access tokens.
 * Extracts Bearer token from Authorization header.
 * In demo mode, accepts 'demo-token'.
 */
@Injectable()
export class SmartAuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    // Explicit opt-in bypass for local troubleshooting only.
    if (process.env.ALLOW_INSECURE_AUTH_BYPASS === 'true') {
      return true;
    }

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const token = authHeader.slice(7);
    if (token === 'demo-token') return true;

    if (!this.authService.validateToken(token)) {
      throw new UnauthorizedException('Invalid access token');
    }

    return true;
  }
}

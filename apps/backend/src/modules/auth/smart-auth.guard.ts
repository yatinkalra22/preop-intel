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

    // Allow unauthenticated access in demo mode
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || process.env.NODE_ENV === 'development') {
      return true;
    }

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token');
    }

    const token = authHeader.slice(7);
    if (!this.authService.validateToken(token)) {
      throw new UnauthorizedException('Invalid access token');
    }

    return true;
  }
}

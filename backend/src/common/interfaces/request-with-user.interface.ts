// File: src/common/interfaces/request-with-user.interface.ts
// NestJS 11: Shared typed Request interfaces (replaces scattered `req: any` patterns)

import { Request } from 'express';
import { User } from '../../modules/user/entities/user.entity';

/**
 * Request object after JwtAuthGuard has validated the token.
 * Passport attaches the User entity returned by JwtStrategy.validate() to `req.user`.
 */
export interface RequestWithUser extends Request {
  user: User;
}

/**
 * Payload shape returned by JwtRefreshStrategy.validate().
 * Contains JWT claims + the raw refresh token for rotation.
 */
export interface JwtRefreshPayload {
  sub: number;
  username: string;
  refreshToken: string;
}

/**
 * Request object after JwtRefreshGuard has validated the refresh token.
 */
export interface RequestWithRefreshUser extends Request {
  user: JwtRefreshPayload;
}

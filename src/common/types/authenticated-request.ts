import type { Request as ExpressRequest } from 'express';

import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

// Dùng chung cho mọi controller có route bắt buộc đăng nhập (JwtAuthGuard)
export interface RequestWithUser extends ExpressRequest {
  user: AuthenticatedUser;
}

// Dùng chung cho route đăng nhập hay không đều vào được (OptionalJwtAuthGuard)
// — req.user có thể undefined nếu là khách vãng lai
export interface RequestWithOptionalUser extends ExpressRequest {
  user?: AuthenticatedUser;
}

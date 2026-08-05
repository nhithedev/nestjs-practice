import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable } from 'rxjs';
const CACHE_CONTROL_HEADER = 'Cache-Control';
const PRAGMA_HEADER = 'Pragma';
const EXPIRES_HEADER = 'Expires';

const CACHE_CONTROL_NO_STORE = 'no-store, no-cache, must-revalidate';
const PRAGMA_NO_CACHE = 'no-cache';
const EXPIRES_IMMEDIATELY = '0';
@Injectable()
export class NoCacheHeaderInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const response = context.switchToHttp().getResponse<Response>();

    response.setHeader(CACHE_CONTROL_HEADER, CACHE_CONTROL_NO_STORE);
    response.setHeader(PRAGMA_HEADER, PRAGMA_NO_CACHE);
    response.setHeader(EXPIRES_HEADER, EXPIRES_IMMEDIATELY);

    return next.handle();
  }
}

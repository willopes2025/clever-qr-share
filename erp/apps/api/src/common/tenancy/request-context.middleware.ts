import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { runWithContextScope } from './request-context';

/** Abre o escopo do contexto antes de qualquer guard, e o mantém até a resposta. */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(_request: Request, _response: Response, next: NextFunction): void {
    runWithContextScope(() => next());
  }
}

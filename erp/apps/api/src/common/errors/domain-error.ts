/**
 * Erro de negócio com código estável, consumido por código no PDV.
 * A mensagem é para humano e pode mudar; o código, não.
 */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly httpStatus = 422,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id?: string) {
    super(`${entity.toUpperCase()}_NOT_FOUND`, `${entity} não encontrado`, id ? { id } : undefined, 404);
  }
}

export class ForbiddenError extends DomainError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, details, 403);
  }
}

export class ConflictError extends DomainError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, details, 409);
  }
}

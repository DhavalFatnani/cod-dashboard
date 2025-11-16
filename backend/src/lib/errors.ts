export class DomainError extends Error { constructor(message: string, public code: string = "domain_error") { super(message); this.name = "DomainError"; } }
export class AuthError extends Error { constructor(message: string, public code: string = "auth_error") { super(message); this.name = "AuthError"; } }
export class ValidationError extends Error { constructor(message: string, public code: string = "validation_error") { super(message); this.name = "ValidationError"; } }
export class ConflictError extends Error { constructor(message: string, public code: string = "conflict_error") { super(message); this.name = "ConflictError"; } }
export class NotFoundError extends Error { constructor(message: string, public code: string = "not_found_error") { super(message); this.name = "NotFoundError"; } }
export class PreconditionFailedError extends Error { constructor(message: string, public code: string = "precondition_failed") { super(message); this.name = "PreconditionFailedError"; } }

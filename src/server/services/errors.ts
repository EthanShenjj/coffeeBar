export class ServiceNotFoundError extends Error {
  readonly code = "NOT_FOUND";

  constructor(message = "资源不存在") {
    super(message);
    this.name = "ServiceNotFoundError";
  }
}

export class ServiceConflictError extends Error {
  readonly code = "CONFLICT";

  constructor(message = "资源状态已变化") {
    super(message);
    this.name = "ServiceConflictError";
  }
}

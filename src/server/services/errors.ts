export class ServiceNotFoundError extends Error {
  readonly code = "NOT_FOUND";

  constructor(message = "资源不存在") {
    super(message);
    this.name = "ServiceNotFoundError";
  }
}

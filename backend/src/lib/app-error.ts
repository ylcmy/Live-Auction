export class AppError extends Error {
  statusCode: number;
  code: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.code = statusCode >= 500 ? 50000 : statusCode * 100;
  }
}

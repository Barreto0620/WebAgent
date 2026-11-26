export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
export const badRequest = (m: string) => new HttpError(400, m);
export const unauthorized = (m = "Sessão inválida. Entre novamente.") => new HttpError(401, m);
export const forbidden = (m = "Você não tem permissão para esta ação.") => new HttpError(403, m);
export const notFound = (m = "Não encontrado.") => new HttpError(404, m);

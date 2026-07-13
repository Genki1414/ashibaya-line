export interface AppError {
  readonly code: string;
  readonly message: string;
}

/** Server Action の戻り値として画面に渡す正規化済み結果。 */
export type AppResult<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: AppError };

export function appOk<T>(data: T): AppResult<T> {
  return { ok: true, data };
}

export function appErr(error: AppError): AppResult<never> {
  return { ok: false, error };
}

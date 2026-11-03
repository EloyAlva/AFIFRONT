export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"
).replace(/\/+$/, "");

/** All browser requests go to AFIBACK; Supabase and AI credentials are server-only. */
export async function publicRequest<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
  token?: string,
  key?: string,
): Promise<T> {
  const response = await fetch(API_URL + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Object.assign(
      new Error(result.error?.message ?? "No se pudo completar la operación"),
      { status: response.status, code: result.error?.code },
    );
  return result;
}

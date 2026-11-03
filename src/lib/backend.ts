import { normalizeBackendUrl } from "./backend-url";
export const API_URL = normalizeBackendUrl(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
);
const financialMessages: Record<string, string> = {
  "Insufficient account balance":
    "La cuenta elegida no tiene saldo suficiente. Revisa su saldo inicial y los ingresos registrados, elige otra cuenta o selecciona Tarjeta de crédito en Pagar con si fue una compra a crédito.",
  "Credit limit or refund exceeded":
    "La compra supera el crédito disponible de la tarjeta o la devolución supera su deuda. Revisa el importe y el límite de crédito.",
  "Card unavailable":
    "La tarjeta no está disponible. Elige una tarjeta de crédito activa.",
};

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
      new Error(
        financialMessages[result.error?.message] ??
          result.error?.message ??
          "No se pudo completar la operación",
      ),
      { status: response.status, code: result.error?.code },
    );
  return result;
}

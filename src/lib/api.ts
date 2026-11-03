import { createClient, type SupabaseClient } from "@supabase/supabase-js";
let client: SupabaseClient | undefined;
export const configured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export function auth() {
  if (!configured)
    throw new Error("Configura las variables de Supabase en .env.local");
  return (client ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  ));
}
export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
  key?: string,
): Promise<T> {
  const { data } = await auth().auth.getSession();
  if (!data.session) throw new Error("Inicia sesión para continuar");
  const response = await fetch(
    (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1") + path,
    {
      method,
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw Object.assign(
      new Error(result.error?.message ?? "No se pudo completar la operación"),
      { status: response.status, code: result.error?.code },
    );
  }
  return response.json();
}
export async function exportTransactions() {
  const { data } = await auth().auth.getSession();
  const response = await fetch(
    (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1") +
      "/export/transactions.csv",
    { headers: { Authorization: `Bearer ${data.session?.access_token}` } },
  );
  if (!response.ok) throw new Error("No se pudo exportar");
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = "afi-movimientos.csv";
  a.click();
  URL.revokeObjectURL(url);
}
export function formatMoney(value: number, currency = "PEN") {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

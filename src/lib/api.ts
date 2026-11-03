import { auth } from "./auth";
import { API_URL, publicRequest } from "./backend";
export { auth, configured } from "./auth";
export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
  key?: string,
): Promise<T> {
  const { data } = await auth().auth.getSession();
  if (!data.session) throw new Error("Inicia sesión para continuar");
  return publicRequest<T>(path, method, body, data.session.access_token, key);
}
export async function exportTransactions() {
  const { data } = await auth().auth.getSession();
  const response = await fetch(API_URL + "/export/transactions.csv", {
    headers: { Authorization: `Bearer ${data.session?.access_token}` },
  });
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

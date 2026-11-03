export function normalizeBackendUrl(value: string) {
  let address = value.trim();
  if (!address) address = "http://localhost:4000/api/v1";
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(address)) {
    const local = /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(
      address,
    );
    address = (local ? "http://" : "https://") + address;
  }
  const url = new URL(address);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw Error(
      "NEXT_PUBLIC_API_URL debe ser una URL HTTP(S) del backend, sin credenciales, parámetros ni fragmentos.",
    );
  }
  const path = url.pathname.replace(/\/+$/, "");
  if (path && !path.endsWith("/api/v1"))
    throw Error(
      "NEXT_PUBLIC_API_URL debe apuntar al dominio del backend o terminar en /api/v1.",
    );
  return url.origin + (path || "/api/v1");
}

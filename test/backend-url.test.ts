import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBackendUrl } from "../src/lib/backend-url";

test("El dominio del backend siempre produce una URL absoluta con el prefijo de API", () => {
  assert.equal(
    normalizeBackendUrl("afiback.vercel.app"),
    "https://afiback.vercel.app/api/v1",
  );
  assert.equal(
    normalizeBackendUrl(" https://afiback.vercel.app/ "),
    "https://afiback.vercel.app/api/v1",
  );
  assert.equal(
    normalizeBackendUrl("https://afiback.vercel.app/api/v1/"),
    "https://afiback.vercel.app/api/v1",
  );
  assert.equal(
    normalizeBackendUrl("localhost:4000"),
    "http://localhost:4000/api/v1",
  );
  assert.equal(
    normalizeBackendUrl("http://localhost:4000/api/v1"),
    "http://localhost:4000/api/v1",
  );
});

test("La URL no admite el panel de Vercel, secretos ni rutas o protocolos ajenos", () => {
  for (const value of [
    "https://vercel.com/eacode/afiback",
    "ftp://afiback.vercel.app",
    "https://user:password@afiback.vercel.app",
    "https://afiback.vercel.app?token=secret",
    "https://afiback.vercel.app/#secret",
  ]) {
    assert.throws(() => normalizeBackendUrl(value));
  }
});

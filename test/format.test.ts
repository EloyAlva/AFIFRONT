import test from "node:test";
import assert from "node:assert/strict";
import { formatMoney } from "../src/lib/api";
test("Importes conservan su moneda y admiten ahorro cero", () => {
  assert.match(formatMoney(0, "PEN"), /0[.,]00/);
  assert.match(formatMoney(100, "USD"), /100[.,]00/);
  assert.notEqual(formatMoney(100, "USD"), formatMoney(100, "PEN"));
});

import test from "node:test";
import assert from "node:assert/strict";
import { deadlineDistribution } from "../src/lib/savings";

test("Reparte 50/30/20 por fecha y excluye monedas distintas y objetivos completados", () => {
  const goals = [
    {
      id: "late",
      currency: "PEN",
      target_date: "2027-03-01",
      ideal_amount: 100,
    },
    {
      id: "soon",
      currency: "PEN",
      target_date: "2026-12-01",
      ideal_amount: 100,
    },
    {
      id: "middle",
      currency: "PEN",
      target_date: "2027-01-01",
      ideal_amount: 100,
    },
    {
      id: "done",
      currency: "PEN",
      target_date: "2026-11-01",
      ideal_amount: 100,
    },
    {
      id: "usd",
      currency: "USD",
      target_date: "2026-11-01",
      ideal_amount: 100,
    },
  ];
  const result = deadlineDistribution(
    goals,
    [{ goal_id: "done", amount: 100 }],
    "PEN",
  );
  assert.deepEqual(
    result.map((g) => [g.id, g.percentage]),
    [
      ["soon", 50],
      ["middle", 30],
      ["late", 20],
    ],
  );
  assert.equal(goals[0].id, "late");
});

test("Los porcentajes suman exactamente 100 con cualquier cantidad de objetivos", () => {
  for (const count of [1, 2, 4, 7, 23]) {
    const result = deadlineDistribution(
      Array.from({ length: count }, (_, i) => ({
        id: String(i),
        currency: "PEN",
        target_date: "2027-01-01",
        ideal_amount: 100,
      })),
      [],
      "PEN",
    );
    assert.equal(
      result.reduce((s, g) => s + Math.round(g.percentage * 100), 0),
      10000,
    );
  }
  assert.deepEqual(deadlineDistribution([], [], "PEN"), []);
});

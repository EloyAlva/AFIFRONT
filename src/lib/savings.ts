type Goal = Record<string, any>;

export function deadlineDistribution(
  goals: Goal[],
  allocations: Goal[],
  currency: string,
): (Goal & { percentage: number })[] {
  const eligible = goals
    .filter(
      (g) =>
        g.currency === currency &&
        allocations
          .filter((a) => a.goal_id === g.id)
          .reduce((s, a) => s + Number(a.amount), 0) < Number(g.ideal_amount),
    )
    .sort(
      (a, b) =>
        String(a.target_date).localeCompare(String(b.target_date)) ||
        String(a.id).localeCompare(String(b.id)),
    );
  const weights =
    eligible.length === 3
      ? [5, 3, 2]
      : eligible.map((_, i) => eligible.length - i);
  const total = weights.reduce((s, w) => s + w, 0);
  let used = 0;
  return eligible.map((g, i) => {
    const percentage =
      i === eligible.length - 1
        ? (10000 - used) / 100
        : Math.floor((weights[i] / total) * 10000) / 100;
    used += Math.round(percentage * 100);
    return { ...g, percentage };
  });
}

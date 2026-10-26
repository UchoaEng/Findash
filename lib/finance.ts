export type Row = Record<string, any>;
export type FinanceData = {
  accounts: Row[];
  categories: Row[];
  movements: Row[];
  cards: Row[];
  purchases: Row[];
  invoices: Row[];
  installments: Row[];
  payments: Row[];
  goals: Row[];
  contributions: Row[];
  allocations: Row[];
  allocation_usages: Row[];
  audit: Row[];
};
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function dateAt(month: string, day: number) {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(Math.min(day, new Date(Date.UTC(y, m, 0)).getUTCDate())).padStart(2, "0")}`;
}
export function addMonths(month: string, n: number) {
  const [y, m] = month.slice(0, 7).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
}
export function cycleRange(month: string, day = 1) {
  return { start: dateAt(month, day), end: dateAt(addMonths(month, 1), day) };
}
export function currentCycleMonth(asOf: string, day = 1) {
  const month = asOf.slice(0, 7);
  return asOf < dateAt(month, day) ? addMonths(month, -1) : month;
}
export function firstInvoice(date: string, closing: number, due: number) {
  const month = date.slice(0, 7);
  const closingMonth =
    date >= dateAt(month, closing) ? addMonths(month, 1) : month;
  return due <= closing ? addMonths(closingMonth, 1) : closingMonth;
}
export function invoiceDates(month: string, closing: number, due: number) {
  return {
    due_date: dateAt(month, due),
    closing_date: dateAt(
      due <= closing ? addMonths(month, -1) : month,
      closing,
    ),
  };
}
export function splitInstallments(total: number, count: number) {
  const base = Math.floor(total / count),
    rest = total % count;
  return Array.from({ length: count }, (_, i) => base + (i < rest ? 1 : 0));
}
export function goalPlan(target: number, saved: number, monthly: number) {
  const remaining = Math.max(0, target - saved);
  const months =
    remaining === 0 ? 0 : monthly > 0 ? Math.ceil(remaining / monthly) : null;
  return {
    remaining,
    months,
    last:
      months === null
        ? 0
        : months === 0
          ? 0
          : remaining - monthly * (months - 1),
  };
}
export function requiredContribution(
  remaining: number,
  deadline: string,
  asOf: string,
) {
  const a = asOf.split("-").map(Number),
    b = deadline.split("-").map(Number);
  const months = Math.max(1, (b[0] - a[0]) * 12 + b[1] - a[1] + 1);
  return Math.ceil(Math.max(0, remaining) / months);
}
export function enrichInvoices(d: FinanceData): Row[] {
  return d.invoices.map((i) => {
    const total = d.installments
      .filter((x) => x.invoice_id === i.id)
      .reduce((s, x) => s + x.amount_cents, 0);
    const paid = d.payments
      .filter((x) => x.invoice_id === i.id)
      .reduce((s, x) => s + x.amount_cents, 0);
    return { ...i, total, paid, pending: Math.max(0, total - paid) };
  });
}
export function reservationRows(d: FinanceData): Row[] {
  return d.allocations.map((a) => ({
    ...a,
    outstanding: Math.max(
      0,
      a.reserved_cents -
        (d.allocation_usages || [])
          .filter((x) => x.allocation_id === a.id)
          .reduce((s, x) => s + x.amount_cents, 0),
    ),
  }));
}
export function calculate(
  d: FinanceData,
  month: string,
  asOf = today(),
  cycleDay = 1,
  safety = 0,
) {
  const { start, end } = cycleRange(month, cycleDay);
  const inPeriod = (v: string) => v >= start && v < end;
  const inv = enrichInvoices(d);
  const sum = (rows: Row[], f: (x: Row) => number) =>
    rows.reduce((s, x) => s + f(x), 0);
  const opening = sum(d.accounts, (a) =>
    a.opening_date <= asOf ? a.opening_cents : 0,
  );
  const confirmed =
    opening +
    sum(
      d.movements.filter((m) => m.effective_date && m.effective_date <= asOf),
      (m) => (m.kind === "income" ? m.amount_cents : -m.amount_cents),
    ) -
    sum(
      d.payments.filter((p) => p.date <= asOf),
      (p) => p.amount_cents,
    );
  const saved = sum(
    d.contributions.filter((c) => c.date <= asOf),
    (c) => c.amount_cents,
  );
  const reserved = sum(reservationRows(d), (a) => a.outstanding);
  const periodMov = d.movements.filter((m) =>
    inPeriod(m.effective_date || m.date),
  );
  const income = sum(
    periodMov.filter((m) => m.kind === "income"),
    (m) => m.amount_cents,
  );
  const expenses = sum(
    periodMov.filter((m) => m.kind === "expense"),
    (m) => m.amount_cents,
  );
  const periodInv = inv.filter((i) => inPeriod(i.due_date));
  const invoiceTotal = sum(periodInv, (i) => i.total);
  const currentEnd = cycleRange(
    currentCycleMonth(asOf, cycleDay),
    cycleDay,
  ).end;
  const obligationEnd = end > currentEnd ? end : currentEnd;
  const pendingExpenses = sum(
    d.movements.filter(
      (m) =>
        m.kind === "expense" && !m.effective_date && m.date < obligationEnd,
    ),
    (m) => m.amount_cents,
  );
  const pendingInvoices = sum(
    inv.filter((i) => i.due_date < obligationEnd),
    (i) => i.pending,
  );
  const pending = pendingExpenses + pendingInvoices;
  const freeToday = confirmed - pending - saved - reserved - safety;
  const overdueExpenses = sum(
    d.movements.filter(
      (m) => m.kind === "expense" && !m.effective_date && m.date < start,
    ),
    (m) => m.amount_cents,
  );
  const overdueInvoices = sum(
    inv.filter((i) => i.due_date < start),
    (i) => i.pending,
  );
  const actualThroughEnd =
    sum(
      d.accounts.filter((a) => a.opening_date < end),
      (a) => a.opening_cents,
    ) +
    sum(
      d.movements.filter((m) => m.effective_date && m.effective_date < end),
      (m) => (m.kind === "income" ? m.amount_cents : -m.amount_cents),
    ) -
    sum(
      d.payments.filter((p) => p.date < end),
      (p) => p.amount_cents,
    );
  const projectedIncome = sum(
    d.movements.filter(
      (m) => m.kind === "income" && !m.effective_date && inPeriod(m.date),
    ),
    (m) => m.amount_cents,
  );
  const invoiceOutstandingAtEnd = sum(
    inv.filter((i) => i.due_date < end),
    (i) =>
      Math.max(
        0,
        i.total -
          sum(
            d.payments.filter((p) => p.invoice_id === i.id && p.date < end),
            (p) => p.amount_cents,
          ),
      ),
  );
  const projected =
    actualThroughEnd +
    projectedIncome -
    sum(
      d.movements.filter(
        (m) => m.kind === "expense" && !m.effective_date && m.date < end,
      ),
      (m) => m.amount_cents,
    ) -
    invoiceOutstandingAtEnd;
  const goalRows: Row[] = d.goals
    .map((g): Row => {
      const accumulated = sum(
        d.contributions.filter((c) => c.goal_id === g.id && c.date <= asOf),
        (c) => c.amount_cents,
      );
      return {
        ...g,
        saved: accumulated,
        ...goalPlan(g.target_cents, accumulated, g.monthly_cents),
      };
    })
    .sort((a, b) => a.priority - b.priority);
  let capacity = Math.max(0, projected - saved - reserved - safety);
  const suggestions = goalRows.map((g) => {
    const contributed = sum(
      d.contributions.filter(
        (c) => c.goal_id === g.id && c.kind !== "opening" && inPeriod(c.date),
      ),
      (c) => c.amount_cents,
    );
    const earmarked = sum(
      reservationRows(d).filter((a) => a.goal_id === g.id),
      (a) => a.outstanding,
    );
    const periodEarmarked = sum(
      reservationRows(d).filter((a) => a.goal_id === g.id && a.month === month),
      (a) => a.outstanding,
    );
    const amount =
      g.status === "active"
        ? Math.min(
            capacity,
            Math.max(0, g.monthly_cents - contributed - periodEarmarked),
            Math.max(0, g.remaining - earmarked),
          )
        : 0;
    capacity -= amount;
    return { goalId: g.id, amount };
  });
  const planned = sum(suggestions, (s) => s.amount);
  const commitments =
    expenses + invoiceTotal + overdueExpenses + overdueInvoices;
  let cashCapacity = Math.max(0, confirmed - saved - reserved - safety);
  const obligations: Row[] = [
    ...d.movements
      .filter(
        (m) =>
          m.kind === "expense" && !m.effective_date && m.date < obligationEnd,
      )
      .map((m) => ({
        id: m.id,
        name: m.description,
        date: m.date,
        amount: m.amount_cents,
        priority: m.priority || 3,
      })),
    ...inv
      .filter((i) => i.pending > 0 && i.due_date < obligationEnd)
      .map((i) => ({
        id: i.id,
        name:
          (d.cards.find((c) => c.id === i.card_id)?.name || "Cartão") +
          " · Fatura",
        date: i.due_date,
        amount: i.pending,
        priority: 2,
      })),
  ];
  obligations.sort(
    (a, b) => a.priority - b.priority || a.date.localeCompare(b.date),
  );
  const coverage: Row[] = obligations.map((o): Row => {
    const covered = Math.min(cashCapacity, o.amount);
    cashCapacity -= covered;
    return { ...o, covered, shortfall: o.amount - covered };
  });
  return {
    month,
    start,
    end,
    obligationEnd,
    confirmed,
    income,
    expenses,
    invoiceTotal,
    commitments,
    pending,
    pendingExpenses,
    pendingInvoices,
    saved,
    reserved,
    freeToday,
    projected,
    planned,
    projectedFree: projected - saved - reserved - safety - planned,
    suggestions,
    coverage,
    goals: goalRows,
    invoices: inv,
    deficit: Math.max(0, -projected),
    safety,
  };
}

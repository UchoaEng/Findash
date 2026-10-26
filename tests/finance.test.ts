import { describe, it, expect } from "vitest";
import {
  calculate,
  goalPlan,
  splitInstallments,
  dateAt,
  firstInvoice,
  invoiceDates,
  addMonths,
  requiredContribution,
  type FinanceData,
} from "../lib/finance";
const empty = (): FinanceData => ({
  accounts: [],
  categories: [],
  movements: [],
  cards: [],
  purchases: [],
  invoices: [],
  installments: [],
  payments: [],
  goals: [],
  contributions: [],
  allocations: [],
  allocation_usages: [],
  audit: [],
});
describe("Motor financeiro em centavos", () => {
  it("A: 6000 - 2900 - 1100 - 500 = 1500; salário futuro não é caixa", () => {
    const d = empty();
    d.movements = [
      { kind: "income", amount_cents: 600000, date: "2026-10-30" },
      { kind: "expense", amount_cents: 290000, date: "2026-10-28" },
    ];
    d.invoices = [{ id: "i", due_date: "2026-10-29" }];
    d.installments = [{ invoice_id: "i", amount_cents: 110000 }];
    d.goals = [
      {
        id: "g",
        target_cents: 500000,
        monthly_cents: 50000,
        status: "active",
        priority: 1,
      },
    ];
    const s = calculate(d, "2026-10", "2026-10-26");
    expect(s.projectedFree).toBe(150000);
    expect(s.confirmed).toBe(0);
    expect(s.freeToday).toBe(-400000);
  });
  it("B: meta de 5000 com aporte 500: 10 aportes", () =>
    expect(goalPlan(500000, 0, 50000).months).toBe(10));
  it("C: faltam 3000, 4 aportes de até 800, último 600", () =>
    expect(goalPlan(500000, 200000, 80000)).toEqual({
      remaining: 300000,
      months: 4,
      last: 60000,
    }));
  it("D: déficit 500, sem aporte positivo", () => {
    const d = empty();
    d.movements = [
      { kind: "income", amount_cents: 300000, date: "2026-10-30" },
      { kind: "expense", amount_cents: 350000, date: "2026-10-28" },
    ];
    d.goals = [
      {
        id: "g",
        target_cents: 500000,
        monthly_cents: 50000,
        status: "active",
        priority: 1,
      },
    ];
    const s = calculate(d, "2026-10", "2026-10-26");
    expect(s.deficit).toBe(50000);
    expect(s.planned).toBe(0);
  });
  it("E: 3600 em 12 vezes; rateio de centavos preserva o total", () => {
    expect(splitInstallments(360000, 12)).toEqual(Array(12).fill(30000));
    expect(splitInstallments(10000, 3)).toEqual([3334, 3333, 3333]);
  });
  it("F: compra não sai do caixa, pagamento parcial reduz caixa e dívida uma vez", () => {
    const d = empty();
    d.accounts = [{ opening_cents: 100000, opening_date: "2026-10-01" }];
    d.purchases = [{ total_cents: 360000 }];
    d.invoices = [{ id: "i", due_date: "2026-10-27" }];
    d.installments = [{ invoice_id: "i", amount_cents: 30000 }];
    let s = calculate(d, "2026-10", "2026-10-26");
    expect(s.confirmed).toBe(100000);
    expect(s.projected).toBe(70000);
    d.payments = [{ invoice_id: "i", amount_cents: 10000, date: "2026-10-26" }];
    s = calculate(d, "2026-10", "2026-10-26");
    expect(s.confirmed).toBe(90000);
    expect(s.pendingInvoices).toBe(20000);
    expect(s.projected).toBe(70000);
    expect(s.expenses).toBe(0);
  });
  it("J: fevereiro, bissexto, 30/31 e virada de ano", () => {
    expect(dateAt("2025-02", 31)).toBe("2025-02-28");
    expect(dateAt("2024-02", 31)).toBe("2024-02-29");
    expect(dateAt("2026-04", 31)).toBe("2026-04-30");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(firstInvoice("2026-12-25", 25, 5)).toBe("2027-02");
    expect(firstInvoice("2026-12-24", 25, 5)).toBe("2027-01");
    expect(invoiceDates("2024-03", 31, 5).closing_date).toBe("2024-02-29");
  });
  it("aporte zero, meta concluída e prazo não dividem por zero", () => {
    expect(goalPlan(10000, 0, 0).months).toBe(null);
    expect(goalPlan(10000, 10000, 0).months).toBe(0);
    expect(requiredContribution(10000, "2026-12-01", "2026-10-26")).toBe(3334);
  });
  it("reservas são reconciliadas com aportes sem saída duplicada", () => {
    const d = empty();
    d.accounts = [{ opening_cents: 100000, opening_date: "2026-10-01" }];
    d.allocations = [
      { id: "a", goal_id: "g", month: "2026-10", reserved_cents: 30000 },
    ];
    d.contributions = [
      { goal_id: "g", date: "2026-10-26", amount_cents: 10000 },
    ];
    d.allocation_usages = [
      { allocation_id: "a", contribution_id: "c", amount_cents: 10000 },
    ];
    const s = calculate(d, "2026-10", "2026-10-26");
    expect(s.confirmed).toBe(100000);
    expect(s.saved).toBe(10000);
    expect(s.reserved).toBe(20000);
    expect(s.freeToday).toBe(70000);
  });
  it("selecionar mês antigo não libera compromissos atuais do dinheiro livre", () => {
    const d = empty();
    d.accounts = [{ opening_cents: 100000, opening_date: "2026-01-01" }];
    d.movements = [
      { kind: "expense", amount_cents: 80000, date: "2026-10-30" },
    ];
    expect(calculate(d, "2026-01", "2026-10-26").freeToday).toBe(20000);
  });
  it("pagamento posterior não apaga a obrigação da projeção do mês anterior", () => {
    const d = empty();
    d.accounts = [{ opening_cents: 100000, opening_date: "2026-01-01" }];
    d.invoices = [{ id: "i", due_date: "2026-09-05" }];
    d.installments = [{ invoice_id: "i", amount_cents: 30000 }];
    d.payments = [{ invoice_id: "i", amount_cents: 30000, date: "2026-10-01" }];
    expect(calculate(d, "2026-09", "2026-10-26").projected).toBe(70000);
  });
  it("prioridade direciona a cobertura sem antecipar receitas futuras", () => {
    const d = empty();
    d.accounts = [{ opening_cents: 10000, opening_date: "2026-10-01" }];
    d.movements = [
      {
        id: "low",
        kind: "expense",
        amount_cents: 8000,
        date: "2026-10-27",
        priority: 3,
      },
      {
        id: "essential",
        kind: "expense",
        amount_cents: 8000,
        date: "2026-10-28",
        priority: 1,
      },
      { kind: "income", amount_cents: 100000, date: "2026-10-30" },
    ];
    const s = calculate(d, "2026-10", "2026-10-26");
    expect(s.coverage[0].id).toBe("essential");
    expect(s.coverage[0].covered).toBe(8000);
    expect(s.coverage[1].covered).toBe(2000);
  });
  it("ciclo com início 31 não perde dias em fevereiro", () => {
    const d = empty();
    d.movements = [
      { kind: "income", amount_cents: 100, date: "2024-02-29" },
      { kind: "income", amount_cents: 100, date: "2024-03-30" },
      { kind: "income", amount_cents: 100, date: "2024-03-31" },
    ];
    expect(calculate(d, "2024-02", "2024-02-29", 31).income).toBe(200);
  });
});

it("aporte do ciclo e reserva abatem o plano mensal; saldo inicial de meta não é novo aporte", () => {
  const d = empty();
  d.accounts = [{ opening_cents: 1000000, opening_date: "2026-10-01" }];
  d.goals = [
    {
      id: "g",
      target_cents: 500000,
      monthly_cents: 50000,
      status: "active",
      priority: 1,
    },
  ];
  d.contributions = [
    {
      id: "c",
      goal_id: "g",
      date: "2026-10-26",
      amount_cents: 200000,
      kind: "opening",
    },
  ];
  expect(calculate(d, "2026-10", "2026-10-26").planned).toBe(50000);
  d.contributions.push({
    id: "d",
    goal_id: "g",
    date: "2026-10-26",
    amount_cents: 20000,
    kind: "deposit",
  });
  d.allocations = [
    { id: "a", goal_id: "g", month: "2026-10", reserved_cents: 10000 },
  ];
  expect(calculate(d, "2026-10", "2026-10-26").planned).toBe(20000);
});

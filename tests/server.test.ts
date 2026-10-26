import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SQLiteD1 } from "./sqlite";
import { handleRequest } from "../lib/server";
import { today, addMonths } from "../lib/finance";
let db: SQLiteD1,
  dir: string,
  cookieA = "",
  cookieB = "",
  recoveryA = "",
  movementId = "",
  cardId = "",
  purchaseId = "",
  invoiceId = "",
  goalId = "";
const password = "Test-only-passphrase!42";
const now = today();
async function req(path: string, body?: any, cookie = "") {
  const r = await handleRequest(
    new Request("http://localhost/api/" + path, {
      method: body ? "POST" : "GET",
      headers: {
        Origin: "http://localhost",
        Cookie: cookie,
        "Content-Type": "application/json",
        "cf-connecting-ip": "127.0.0.1",
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
    db.asD1(),
  );
  return {
    status: r.status,
    body: (await r.json()) as any,
    cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
  };
}
const cmd = (body: any, cookie = cookieA) => req("command", body, cookie);
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "fluxo-test-"));
  db = new SQLiteD1(join(dir, "finance.sqlite"));
  db.migrate();
});
afterAll(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
describe.sequential("Fluxos reais com banco persistente", () => {
  it("cria contas sem email; hashes não são credenciais em texto", async () => {
    const a = await req("auth/register", { username: "  TEST.A  ", password });
    expect(a.status).toBe(201);
    recoveryA = a.body.recoveryCode;
    expect(recoveryA.replaceAll("-", "")).toHaveLength(40);
    await req("auth/register", { username: "test.b", password });
    const row = db.sql
      .prepare("SELECT * FROM users WHERE username=?")
      .get("test.a") as any;
    expect(row.password_hash).toMatch(/^argon2id\$/);
    expect(row.recovery_hash).not.toContain(recoveryA);
  });
  it("login com sessão HttpOnly persistente", async () => {
    const a = await req("auth/login", { username: "test.a", password });
    expect(a.status).toBe(200);
    cookieA = a.cookie;
    const b = await req("auth/login", { username: "test.b", password });
    cookieB = b.cookie;
    expect((await req("state", undefined, cookieA)).body.user.username).toBe(
      "test.a",
    );
  });
  it("configura saldo, receitas e despesas; confirma e estorna", async () => {
    expect(
      (
        await cmd({
          action: "profile",
          display_name: "Teste",
          cycle_day: 1,
          safety_cents: 0,
          opening_cents: 600000,
          opening_date: now,
          onboarded: true,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await cmd({
          action: "movement/save",
          kind: "expense",
          description: "Despesa real de teste",
          amount_cents: 10000,
          category: "Moradia",
          date: now,
          effective_date: null,
          priority: 1,
          frequency: "none",
        })
      ).status,
    ).toBe(200);
    let st = (await req("state", undefined, cookieA)).body;
    movementId = st.data.movements[0].id;
    expect(st.summary.confirmed).toBe(600000);
    await cmd({ action: "movement/toggle", id: movementId });
    st = (await req("state", undefined, cookieA)).body;
    expect(st.summary.confirmed).toBe(590000);
    await cmd({ action: "movement/toggle", id: movementId });
    expect(
      (await req("state", undefined, cookieA)).body.summary.confirmed,
    ).toBe(600000);
  });
  it("I: usuário B não lê nem modifica registros de A", async () => {
    expect(
      (await req("state", undefined, cookieB)).body.data.movements,
    ).toHaveLength(0);
    expect(
      (await cmd({ action: "movement/delete", id: movementId }, cookieB))
        .status,
    ).toBe(404);
    expect((await req("state")).status).toBe(401);
    const cross = new Request("http://localhost/api/command", {
      method: "POST",
      headers: { Origin: "https://evil.test", Cookie: cookieA },
      body: "{}",
    });
    expect((await handleRequest(cross, db.asD1())).status).toBe(403);
  });
  it("E/F: gera 12 parcelas, faturas e pagamento parcial sem duplicar consumo", async () => {
    await cmd({
      action: "card/save",
      name: "Cartão teste",
      closing_day: 25,
      due_day: 5,
      limit_cents: null,
    });
    cardId = (await req("state", undefined, cookieA)).body.data.cards[0].id;
    expect(
      (
        await cmd({
          action: "purchase/save",
          card_id: cardId,
          description: "Notebook",
          category: "Compras",
          total_cents: 360000,
          date: now,
          count: 12,
          first_month: now.slice(0, 7),
        })
      ).status,
    ).toBe(200);
    let st = (await req("state", undefined, cookieA)).body;
    purchaseId = st.data.purchases[0].id;
    expect(st.data.installments).toHaveLength(12);
    expect(
      st.data.installments.every((i: any) => i.amount_cents === 30000),
    ).toBe(true);
    expect(
      st.data.invoices
        .map((i: any) => i.month)
        .sort()
        .at(-1),
    ).toBe(addMonths(now.slice(0, 7), 11));
    invoiceId = st.data.installments.find(
      (i: any) => i.installment_index === 1,
    ).invoice_id;
    await cmd({
      action: "invoice/pay",
      invoice_id: invoiceId,
      amount_cents: 10000,
      date: now,
    });
    st = (await req("state", undefined, cookieA)).body;
    expect(st.summary.confirmed).toBe(590000);
    expect(st.data.movements).toHaveLength(1);
    expect(
      st.summary.invoices.find((i: any) => i.id === invoiceId).pending,
    ).toBe(20000);
    expect(
      (
        await cmd({
          action: "invoice/pay",
          invoice_id: invoiceId,
          amount_cents: 25000,
          date: now,
        })
      ).status,
    ).toBe(400);
    expect(
      (await cmd({ action: "purchase/delete", id: purchaseId })).status,
    ).toBe(400);
  });
  it("metas: planejamento não aumenta guardado, reservas são reconciliadas", async () => {
    await cmd({
      action: "goal/save",
      name: "Reserva",
      target_cents: 500000,
      monthly_cents: 50000,
      deadline: null,
      priority: 1,
      color: "#315e53",
      icon: "shield",
      status: "active",
      saved_cents: 0,
    });
    let st = (await req("state", undefined, cookieA)).body;
    goalId = st.data.goals[0].id;
    expect(st.summary.saved).toBe(0);
    await cmd({
      action: "allocation/save",
      goal_id: goalId,
      month: now.slice(0, 7),
      reserved_cents: 30000,
    });
    await cmd({
      action: "goal/contribute",
      goal_id: goalId,
      amount_cents: 10000,
      date: now,
    });
    st = (await req("state", undefined, cookieA)).body;
    expect(st.summary.saved).toBe(10000);
    expect(st.summary.reserved).toBe(20000);
    expect(st.summary.confirmed).toBe(590000);
    expect(
      (
        await cmd({
          action: "goal/contribute",
          goal_id: goalId,
          amount_cents: 600000,
          date: now,
        })
      ).status,
    ).toBe(400);
  });
  it("reservas de outros meses são consumidas e estornos restauram os vínculos", async () => {
    const future = addMonths(now.slice(0, 7), 1);
    await cmd({
      action: "allocation/save",
      goal_id: goalId,
      month: future,
      reserved_cents: 20000,
    });
    await cmd({
      action: "goal/contribute",
      goal_id: goalId,
      amount_cents: 20000,
      date: now,
    });
    let st = (await req("state", undefined, cookieA)).body;
    expect(st.summary.saved).toBe(30000);
    expect(st.summary.reserved).toBe(20000);
    expect(st.data.allocation_usages.length).toBe(2);
    const contribution = st.data.contributions.find(
      (c: any) => c.amount_cents === 20000,
    );
    await cmd({
      action: "goal/contribute",
      goal_id: goalId,
      amount_cents: -10000,
      date: now,
    });
    st = (await req("state", undefined, cookieA)).body;
    expect(st.summary.saved).toBe(20000);
    expect(st.summary.reserved).toBe(20000);
    const withdrawal = st.data.contributions.find(
      (c: any) => c.amount_cents < 0,
    );
    await cmd({ action: "contribution/delete", id: withdrawal.id });
    await cmd({ action: "contribution/delete", id: contribution.id });
    await cmd({
      action: "allocation/save",
      goal_id: goalId,
      month: future,
      reserved_cents: 0,
    });
    st = (await req("state", undefined, cookieA)).body;
    expect(st.summary.saved).toBe(10000);
    expect(st.summary.reserved).toBe(20000);
  });
  it("autoriza vínculos de cartão, fatura e meta no servidor", async () => {
    expect(
      (
        await cmd(
          {
            action: "purchase/save",
            card_id: cardId,
            description: "Ataque",
            category: "Compras",
            total_cents: 10000,
            date: now,
            count: 1,
          },
          cookieB,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await cmd(
          {
            action: "invoice/pay",
            invoice_id: invoiceId,
            amount_cents: 1,
            date: now,
          },
          cookieB,
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await cmd(
          {
            action: "goal/contribute",
            goal_id: goalId,
            amount_cents: 1,
            date: now,
          },
          cookieB,
        )
      ).status,
    ).toBe(404);
  });
  it("alterar recorrência futura preserva ocorrência já confirmada", async () => {
    await cmd({
      action: "movement/save",
      kind: "income",
      description: "Renda recorrente",
      amount_cents: 50000,
      category: "Salário",
      date: now,
      effective_date: null,
      priority: 3,
      frequency: "monthly",
    });
    let st = (await req("state", undefined, cookieA)).body;
    const rows = st.data.movements
      .filter((m: any) => m.description === "Renda recorrente")
      .sort((a: any, b: any) => a.date.localeCompare(b.date));
    expect(rows.length).toBe(24);
    await cmd({ action: "movement/toggle", id: rows[1].id });
    await cmd({
      action: "movement/save",
      id: rows[0].id,
      kind: "income",
      description: "Renda alterada",
      amount_cents: 60000,
      category: "Salário",
      date: now,
      effective_date: null,
      priority: 3,
      frequency: "none",
      scope: "future",
    });
    st = (await req("state", undefined, cookieA)).body;
    const preserved = st.data.movements.find((m: any) => m.id === rows[1].id);
    expect(preserved.description).toBe("Renda recorrente");
    expect(preserved.amount_cents).toBe(50000);
    expect(
      st.data.movements.filter(
        (m: any) => m.recurrence_id === rows[0].recurrence_id,
      ),
    ).toHaveLength(2);
    await cmd({ action: "movement/delete", id: rows[0].id });
    await cmd({ action: "movement/delete", id: rows[1].id });
  });
  it("validação rejeita datas impossíveis e valores fracionários", async () => {
    const fields = {
      action: "movement/save",
      kind: "expense",
      description: "Inválida",
      amount_cents: 100,
      category: "Outras",
      date: "2026-13-40",
      effective_date: null,
      priority: 3,
      frequency: "none",
    };
    expect((await cmd(fields)).status).toBe(400);
    expect(
      (await cmd({ ...fields, date: now, amount_cents: 1.1 })).status,
    ).toBe(400);
  });
  it("mutações concorrentes não reservam dinheiro em duplicidade", async () => {
    const future = addMonths(now.slice(0, 7), 1);
    const results = await Promise.all([
      cmd({
        action: "allocation/save",
        goal_id: goalId,
        month: now.slice(0, 7),
        reserved_cents: 400000,
      }),
      cmd({
        action: "allocation/save",
        goal_id: goalId,
        month: future,
        reserved_cents: 400000,
      }),
    ]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.some((r) => [400, 409].includes(r.status))).toBe(true);
    let st = (await req("state", undefined, cookieA)).body;
    expect(st.summary.saved + st.summary.reserved).toBeLessThanOrEqual(
      st.summary.confirmed,
    );
    await cmd({
      action: "allocation/save",
      goal_id: goalId,
      month: future,
      reserved_cents: 0,
    });
    await cmd({
      action: "allocation/save",
      goal_id: goalId,
      month: now.slice(0, 7),
      reserved_cents: 20000,
    });
  });
  it("corpo malformado e payload excessivo são rejeitados", async () => {
    const malformed = new Request("http://localhost/api/command", {
      method: "POST",
      headers: { Origin: "http://localhost", Cookie: cookieA },
      body: "null",
    });
    expect((await handleRequest(malformed, db.asD1())).status).toBe(400);
    const huge = new Request("http://localhost/api/command", {
      method: "POST",
      headers: { Origin: "http://localhost", Cookie: cookieA },
      body: JSON.stringify({ data: "x".repeat(33000) }),
    });
    expect((await handleRequest(huge, db.asD1())).status).toBe(413);
  });
  it("mudança da data inicial não exclui movimentos do histórico", async () => {
    const previous = new Date(now + "T12:00:00Z");
    previous.setUTCDate(previous.getUTCDate() - 1);
    const oldDate = previous.toISOString().slice(0, 10);
    await cmd({
      action: "profile",
      display_name: "Teste",
      cycle_day: 1,
      safety_cents: 0,
      opening_cents: 600000,
      opening_date: oldDate,
      onboarded: true,
    });
    await cmd({
      action: "movement/save",
      kind: "income",
      description: "Histórico anterior",
      amount_cents: 100,
      category: "Outras rendas",
      date: oldDate,
      effective_date: oldDate,
      priority: 3,
      frequency: "none",
    });
    expect(
      (
        await cmd({
          action: "profile",
          display_name: "Teste",
          cycle_day: 1,
          safety_cents: 0,
          opening_cents: 600000,
          opening_date: now,
          onboarded: true,
        })
      ).status,
    ).toBe(400);
    const st = (await req("state", undefined, cookieA)).body;
    await cmd({
      action: "movement/delete",
      id: st.data.movements.find(
        (m: any) => m.description === "Histórico anterior",
      ).id,
    });
  });
  it("G: dados sobrevivem logout, reabertura do banco e novo login", async () => {
    await req("auth/logout", {}, cookieA);
    expect((await req("state", undefined, cookieA)).status).toBe(401);
    db.close();
    db = new SQLiteD1(join(dir, "finance.sqlite"));
    cookieA = (await req("auth/login", { username: "test.a", password }))
      .cookie;
    const st = (await req("state", undefined, cookieA)).body;
    expect(st.data.movements[0].id).toBe(movementId);
    expect(st.data.installments).toHaveLength(12);
    expect(st.summary.saved).toBe(10000);
  });
  it("H: recuperação rotaciona código, revoga sessões e rejeita código anterior", async () => {
    const r = await req("auth/recover", {
      username: "test.a",
      password: "New-test-passphrase!43",
      code: recoveryA,
    });
    expect(r.status).toBe(200);
    expect(r.body.recoveryCode).not.toBe(recoveryA);
    expect((await req("state", undefined, cookieA)).status).toBe(401);
    expect(
      (
        await req("auth/recover", {
          username: "test.a",
          password,
          code: recoveryA,
        })
      ).status,
    ).toBe(401);
    expect(
      (await req("auth/login", { username: "test.a", password })).status,
    ).toBe(401);
    const newLogin = await req("auth/login", {
      username: "test.a",
      password: "New-test-passphrase!43",
    });
    expect(newLogin.status).toBe(200);
    cookieA = newLogin.cookie;
  });
  it("exportação exclui hashes e exclusão de conta remove seus dados", async () => {
    const exp = await req("export", undefined, cookieA);
    expect(JSON.stringify(exp.body)).not.toContain("password_hash");
    expect(exp.body.data.installments).toHaveLength(12);
    expect(
      (
        await req(
          "account/delete",
          { password: "New-test-passphrase!43" },
          cookieA,
        )
      ).status,
    ).toBe(200);
    expect(
      Number(
        (db.sql.prepare("SELECT COUNT(*) n FROM movements").get() as any).n,
      ),
    ).toBe(0);
    expect((await req("state", undefined, cookieB)).status).toBe(200);
  });
  it("rate limiting persiste no banco e bloqueia repetição", async () => {
    let last: any;
    for (let i = 0; i < 9; i++)
      last = await req("auth/login", { username: "unknown.user", password });
    expect(last.status).toBe(429);
    expect(
      Number(
        (db.sql.prepare("SELECT COUNT(*) n FROM attempts").get() as any).n,
      ),
    ).toBeGreaterThan(0);
  });
});

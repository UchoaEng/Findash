import { z } from "zod";
import {
  addMonths,
  calculate,
  currentCycleMonth,
  dateAt,
  firstInvoice,
  invoiceDates,
  splitInstallments,
  reservationRows,
  today,
  type FinanceData,
  type Row,
} from "./finance";
import {
  constantEqual,
  digest,
  hashPassword,
  normalizeRecovery,
  normalizeUsername,
  random,
  recoveryCode,
  verifyPassword,
} from "./security";
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const fail = (m: string, s = 400): never => {
  throw new AppError(m, s);
};
const id = () => crypto.randomUUID();
const tables = [
  "accounts",
  "categories",
  "movements",
  "cards",
  "purchases",
  "invoices",
  "installments",
  "payments",
  "goals",
  "contributions",
  "allocations",
  "allocation_usages",
  "audit",
] as const;
const money = z.number().int().min(0).max(100_000_000_000);
const positive = money.refine((n) => n > 0, "Informe um valor maior que zero.");
const label = z.string().trim().min(1).max(100);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      s >= "2000-01-01" &&
      s <= "2100-12-31" &&
      !Number.isNaN(Date.parse(s + "T12:00:00Z")) &&
      new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s,
    "Data inválida.",
  );
const month = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
const day = z.number().int().min(1).max(31);
const priority = z.number().int().min(1).max(6);
const credentials = z.object({
  username: z
    .string()
    .transform(normalizeUsername)
    .pipe(z.string().regex(/^[a-z0-9_.-]{3,32}$/)),
  password: z.string().min(10).max(128),
});
const generic = "Não foi possível validar os dados informados.";
export async function rateLimit(db: D1Database, key: string, limit = 8) {
  const now = Date.now();
  const k = await digest(key);
  const r = await db
    .prepare(
      "INSERT INTO attempts (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<? THEN 1 ELSE count+1 END, expires_at=CASE WHEN expires_at<? THEN ? ELSE expires_at END RETURNING count",
    )
    .bind(k, now + 900000, now, now, now + 900000)
    .first<Row>();
  if (r!.count > limit)
    fail("Muitas tentativas. Tente novamente em 15 minutos.", 429);
}
const cookie = (token: string, secure: boolean, age = 2592000) =>
  `fluxo_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? "; Secure" : ""}`;
export async function authenticate(db: D1Database, request: Request) {
  const token = request.headers
    .get("cookie")
    ?.match(/(?:^|; )fluxo_session=([a-f0-9]{64})/)?.[1];
  if (!token) fail("Entre para continuar.", 401);
  const u = await db
    .prepare(
      "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.version=u.session_version AND s.expires_at>?",
    )
    .bind(await digest(token!), new Date().toISOString())
    .first<Row>();
  if (!u) fail("Sua sessão expirou. Entre novamente.", 401);
  return u!;
}
export async function readState(db: D1Database, userId: string) {
  const result = await db.batch([
    db.prepare("SELECT * FROM users WHERE id=?").bind(userId),
    ...tables.map((t) =>
      db.prepare(`SELECT * FROM ${t} WHERE user_id=?`).bind(userId),
    ),
  ]);
  const d = Object.fromEntries(
    tables.map((t, i) => [t, result[i + 1].results]),
  ) as FinanceData;
  return { u: result[0].results[0] as Row, d };
}
function publicUser(u: Row) {
  return {
    id: u.id,
    username: u.username,
    display_name: u.display_name,
    cycle_day: u.cycle_day,
    safety_cents: u.safety_cents,
    onboarded: u.onboarded,
  };
}
type Mutation = {
  kind: "insert" | "update" | "delete";
  table: string;
  data?: Row;
  where?: string;
  params?: any[];
};
async function commit(
  db: D1Database,
  u: Row,
  ops: Mutation[],
  description: string,
) {
  const token = random();
  const guard = "EXISTS (SELECT 1 FROM users WHERE id=? AND write_token=?)";
  const gp = [u.id, token];
  ops.push({
    kind: "insert",
    table: "audit",
    data: {
      id: id(),
      user_id: u.id,
      description,
      date: new Date().toISOString(),
    },
  });
  const statements = [
    db
      .prepare(
        "UPDATE users SET revision=revision+1,write_token=? WHERE id=? AND revision=?",
      )
      .bind(token, u.id, u.revision),
  ];
  for (const op of ops) {
    const data = op.data || {};
    const keys = Object.keys(data);
    if (op.kind === "insert") {
      statements.push(
        db
          .prepare(
            `INSERT INTO ${op.table} (${keys.join(",")}) SELECT ${keys.map(() => "?").join(",")} WHERE ${guard}`,
          )
          .bind(...Object.values(data), ...gp),
      );
    } else {
      const owner = op.table === "users" ? "id" : "user_id";
      const where = `${owner}=? AND (${op.where || "1=1"}) AND ${guard}`;
      const params = [u.id, ...(op.params || []), ...gp];
      statements.push(
        db
          .prepare(
            op.kind === "delete"
              ? `DELETE FROM ${op.table} WHERE ${where}`
              : `UPDATE ${op.table} SET ${keys.map((k) => `${k}=?`).join(",")} WHERE ${where}`,
          )
          .bind(
            ...(op.kind === "delete" ? [] : Object.values(data)),
            ...params,
          ),
      );
    }
  }
  const result = await db.batch(statements);
  if (!result[0].meta.changes)
    fail("Os dados mudaram em outra aba. Atualize e tente novamente.", 409);
}
async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return {};
  const decoder = new TextDecoder();
  let text = "",
    size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > 32768) {
      await reader.cancel();
      fail("Solicitação muito grande.", 413);
    }
    text += decoder.decode(part.value, { stream: true });
  }
  text += decoder.decode();
  return z.record(z.unknown()).parse(JSON.parse(text || "{}"));
}
export async function handleRequest(request: Request, db: D1Database) {
  try {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api\/?/, "");
    const secure = url.protocol === "https:";
    const method = request.method;
    if (method !== "GET") {
      if (request.headers.get("origin") !== url.origin)
        fail("Origem da solicitação inválida.", 403);
      if (Number(request.headers.get("content-length") || 0) > 32768)
        fail("Solicitação muito grande.", 413);
    }
    const body: any = method === "GET" ? {} : await readBody(request);
    const json = (
      data: any,
      status = 200,
      headers: Record<string, string> = {},
    ) =>
      Response.json(data, {
        status,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
          ...headers,
        },
      });
    if (path === "auth/register" && method === "POST") {
      await rateLimit(
        db,
        "register:" + request.headers.get("cf-connecting-ip"),
        12,
      );
      const c = credentials.parse(body);
      const code = recoveryCode(),
        uid = id();
      const hash = await hashPassword(c.password);
      try {
        await db.batch([
          db
            .prepare(
              "INSERT INTO users (id,username,password_hash,recovery_hash,display_name,created_at) VALUES (?,?,?,?,?,?)",
            )
            .bind(
              uid,
              c.username,
              hash,
              await digest(normalizeRecovery(code)),
              c.username,
              new Date().toISOString(),
            ),
          db
            .prepare(
              "INSERT INTO accounts (id,user_id,name,opening_cents,opening_date) VALUES (?,?,?,?,?)",
            )
            .bind(id(), uid, "Conta principal", 0, today()),
        ]);
      } catch {
        fail(
          "Não foi possível criar a conta com esses dados. Tente outro usuário.",
          409,
        );
      }
      return json({ recoveryCode: code }, 201);
    }
    if (path === "auth/login" && method === "POST") {
      await rateLimit(
        db,
        "login:ip:" + request.headers.get("cf-connecting-ip"),
        30,
      );
      const c = credentials.parse(body);
      await rateLimit(db, "login:user:" + c.username);
      const u = await db
        .prepare("SELECT * FROM users WHERE username=?")
        .bind(c.username)
        .first<Row>();
      const dummy =
        "argon2id$00000000000000000000000000000000$" + "0".repeat(64);
      const ok = await verifyPassword(c.password, u?.password_hash || dummy);
      if (!u || !ok) throw new AppError(generic, 401);
      const token = random();
      await db
        .prepare(
          "INSERT INTO sessions (token_hash,user_id,version,expires_at) VALUES (?,?,?,?)",
        )
        .bind(
          await digest(token),
          u.id,
          u.session_version,
          new Date(Date.now() + 2592000000).toISOString(),
        )
        .run();
      return json({ user: publicUser(u) }, 200, {
        "Set-Cookie": cookie(token, secure),
      });
    }
    if (path === "auth/recover" && method === "POST") {
      await rateLimit(
        db,
        "recover:ip:" + request.headers.get("cf-connecting-ip"),
        20,
      );
      const c = credentials
        .extend({ code: z.string().min(1).max(100) })
        .parse(body);
      await rateLimit(db, "recover:user:" + c.username, 5);
      const u = await db
        .prepare("SELECT * FROM users WHERE username=?")
        .bind(c.username)
        .first<Row>();
      const verifier = await digest(normalizeRecovery(c.code));
      if (!u || !constantEqual(verifier, u.recovery_hash))
        throw new AppError(generic, 401);
      const code = recoveryCode();
      const nextHash = await hashPassword(c.password);
      const token = random();
      const results = await db.batch([
        db
          .prepare(
            "UPDATE users SET password_hash=?,recovery_hash=?,session_version=session_version+1,write_token=?,revision=revision+1 WHERE id=? AND recovery_hash=?",
          )
          .bind(
            nextHash,
            await digest(normalizeRecovery(code)),
            token,
            u.id,
            verifier,
          ),
        db
          .prepare(
            "DELETE FROM sessions WHERE user_id=? AND EXISTS(SELECT 1 FROM users WHERE id=? AND write_token=?)",
          )
          .bind(u.id, u.id, token),
      ]);
      if (!results[0].meta.changes) fail(generic, 401);
      return json({ recoveryCode: code }, 200, {
        "Set-Cookie": cookie("", secure, 0),
      });
    }
    const authenticated = await authenticate(db, request);
    if (path === "auth/logout" && method === "POST") {
      const token = request.headers
        .get("cookie")!
        .match(/fluxo_session=([a-f0-9]{64})/)![1];
      await db
        .prepare("DELETE FROM sessions WHERE token_hash=?")
        .bind(await digest(token))
        .run();
      return json({ ok: true }, 200, { "Set-Cookie": cookie("", secure, 0) });
    }
    const { u, d } = await readState(db, authenticated.id);
    const selected = month.parse(
      url.searchParams.get("month") || today().slice(0, 7),
    );
    if (path === "state" && method === "GET")
      return json({
        user: publicUser(u),
        data: d,
        summary: calculate(d, selected, today(), u.cycle_day, u.safety_cents),
      });
    if (path === "export" && method === "GET")
      return json(
        {
          version: 1,
          exportedAt: new Date().toISOString(),
          user: publicUser(u),
          data: d,
        },
        200,
        { "Content-Disposition": 'attachment; filename="fluxo-dados.json"' },
      );
    if (path === "account/delete" && method === "POST") {
      const p = z.object({ password: z.string().min(1).max(128) }).parse(body);
      await rateLimit(db, "delete:" + u.id, 5);
      if (!(await verifyPassword(p.password, u.password_hash)))
        fail(generic, 401);
      await db.prepare("DELETE FROM users WHERE id=?").bind(u.id).run();
      return json({ ok: true }, 200, { "Set-Cookie": cookie("", secure, 0) });
    }
    if (path !== "command" || method !== "POST")
      fail("Recurso não encontrado.", 404);
    const ops: Mutation[] = [];
    const ins = (table: string, data: Row) => {
      ops.push({
        kind: "insert",
        table,
        data: { id: id(), user_id: u.id, ...data },
      });
    };
    const upd = (table: string, rowId: string, data: Row) => {
      ops.push({ kind: "update", table, data, where: "id=?", params: [rowId] });
    };
    const del = (table: string, rowId: string) => {
      ops.push({ kind: "delete", table, where: "id=?", params: [rowId] });
    };
    const own = (table: keyof FinanceData, rowId: string) =>
      d[table].find((r) => r.id === rowId) ||
      fail("Registro não encontrado.", 404);
    const s = calculate(
      d,
      currentCycleMonth(today(), u.cycle_day),
      today(),
      u.cycle_day,
      u.safety_cents,
    );
    let message = "Alteração salva";
    let auditDescription = "";
    switch (body.action) {
      case "profile": {
        const p = z
          .object({
            display_name: label,
            cycle_day: day,
            safety_cents: money,
            opening_cents: z
              .number()
              .int()
              .min(-100_000_000_000)
              .max(100_000_000_000),
            opening_date: date,
            onboarded: z.boolean(),
          })
          .parse(body);
        if (p.opening_date > today())
          fail("O saldo inicial deve ter data até hoje.");
        upd("users", u.id, {
          display_name: p.display_name,
          cycle_day: p.cycle_day,
          safety_cents: p.safety_cents,
          onboarded: p.onboarded ? 1 : 0,
        });
        upd("accounts", d.accounts[0].id, {
          opening_cents: p.opening_cents,
          opening_date: p.opening_date,
        });
        break;
      }
      case "movement/save": {
        const p = z
          .object({
            id: z.string().optional(),
            kind: z.enum(["income", "expense"]),
            description: label,
            amount_cents: positive,
            category: label,
            date,
            effective_date: date.nullable(),
            competency_date: date.nullable().optional(),
            payment_method: z
              .enum(["pix", "cash", "debit", "transfer"])
              .default("pix"),
            priority,
            frequency: z.enum(["none", "monthly", "yearly"]),
            scope: z.enum(["one", "future"]).default("one"),
          })
          .parse(body);
        if (p.effective_date && p.effective_date > today())
          fail("Confirmações não podem ter data futura.");
        if (
          p.date < d.accounts[0].opening_date ||
          (p.effective_date && p.effective_date < d.accounts[0].opening_date)
        )
          fail("Use uma data a partir do saldo inicial.");
        const data = {
          kind: p.kind,
          description: p.description,
          amount_cents: p.amount_cents,
          category: p.category,
          date: p.date,
          effective_date: p.effective_date,
          competency_date: p.competency_date || p.date,
          payment_method: p.payment_method,
          priority: p.priority,
          frequency: p.frequency,
        };
        if (p.id) {
          const old = own("movements", p.id);
          const series =
            old.recurrence_id || (p.frequency === "none" ? null : id());
          upd("movements", p.id, {
            ...data,
            recurrence_id: series,
            frequency:
              p.scope === "one" && old.recurrence_id
                ? old.frequency
                : p.frequency,
          });
          if (
            (p.scope === "future" && old.recurrence_id) ||
            (!old.recurrence_id && p.frequency !== "none")
          ) {
            const removed = d.movements.filter(
              (m) =>
                m.recurrence_id === old.recurrence_id &&
                old.recurrence_id &&
                m.date > old.date &&
                !m.effective_date &&
                m.date > today(),
            );
            for (const m of removed) del("movements", m.id);
            const count =
              p.frequency === "none" ? 1 : p.frequency === "monthly" ? 24 : 3;
            for (let n = 1; n < count; n++) {
              const dt = dateAt(
                addMonths(
                  p.date.slice(0, 7),
                  n * (p.frequency === "yearly" ? 12 : 1),
                ),
                Number(p.date.slice(-2)),
              );
              const preserved = d.movements.some(
                (m) =>
                  m.id !== p.id &&
                  m.recurrence_id === series &&
                  m.date === dt &&
                  !removed.some((r) => r.id === m.id),
              );
              if (dt > today() && !preserved)
                ins("movements", {
                  ...data,
                  date: dt,
                  competency_date: dt,
                  effective_date: null,
                  recurrence_id: series,
                  created_at: new Date().toISOString(),
                });
            }
          }
        } else {
          const series = p.frequency === "none" ? null : id();
          const count =
            p.frequency === "none" ? 1 : p.frequency === "monthly" ? 24 : 3;
          for (let n = 0; n < count; n++) {
            const dt = dateAt(
              addMonths(
                p.date.slice(0, 7),
                n * (p.frequency === "yearly" ? 12 : 1),
              ),
              Number(p.date.slice(-2)),
            );
            ins("movements", {
              ...data,
              date: dt,
              effective_date: n === 0 ? p.effective_date : null,
              competency_date: n === 0 ? p.competency_date || p.date : dt,
              recurrence_id: series,
              created_at: new Date().toISOString(),
            });
          }
        }
        message = "Lançamento salvo";
        break;
      }
      case "movement/toggle": {
        const m = own("movements", z.string().parse(body.id));
        upd("movements", m.id, {
          effective_date: m.effective_date ? null : today(),
        });
        break;
      }
      case "movement/delete": {
        const m = own("movements", z.string().parse(body.id));
        del("movements", m.id);
        if (body.scope === "future" && m.recurrence_id)
          for (const r of d.movements.filter(
            (r) =>
              r.recurrence_id === m.recurrence_id &&
              r.date > m.date &&
              r.date > today() &&
              !r.effective_date,
          ))
            del("movements", r.id);
        break;
      }
      case "category/save": {
        const p = z
          .object({
            id: z.string().optional(),
            name: label,
            priority,
            limit_cents: money.nullable(),
          })
          .parse(body);
        if (p.id) {
          own("categories", p.id);
          upd("categories", p.id, {
            name: p.name,
            priority: p.priority,
            limit_cents: p.limit_cents,
          });
        } else
          ins("categories", {
            name: p.name,
            priority: p.priority,
            limit_cents: p.limit_cents,
          });
        break;
      }
      case "category/delete":
        own("categories", body.id);
        del("categories", body.id);
        break;
      case "card/save": {
        const p = z
          .object({
            id: z.string().optional(),
            name: label,
            closing_day: day,
            due_day: day,
            limit_cents: money.nullable(),
          })
          .parse(body);
        if (p.id) {
          own("cards", p.id);
          upd("cards", p.id, {
            name: p.name,
            closing_day: p.closing_day,
            due_day: p.due_day,
            limit_cents: p.limit_cents,
          });
        } else
          ins("cards", {
            name: p.name,
            closing_day: p.closing_day,
            due_day: p.due_day,
            limit_cents: p.limit_cents,
          });
        message = "Cartão salvo; datas de faturas existentes preservadas";
        break;
      }
      case "card/delete": {
        own("cards", body.id);
        if (d.purchases.some((p) => p.card_id === body.id))
          fail("Exclua as compras vinculadas antes de excluir o cartão.");
        del("cards", body.id);
        break;
      }
      case "purchase/save": {
        const p = z
          .object({
            id: z.string().optional(),
            card_id: z.string(),
            description: label,
            category: label,
            total_cents: positive,
            date,
            count: z.number().int().min(1).max(60),
            first_month: month.optional(),
          })
          .parse(body);
        const card = own("cards", p.card_id);
        if (p.total_cents < p.count)
          fail("Cada parcela deve ter ao menos um centavo.");
        if (p.id) {
          own("purchases", p.id);
          const invIds = d.installments
            .filter((i) => i.purchase_id === p.id)
            .map((i) => i.invoice_id);
          if (d.payments.some((x) => invIds.includes(x.invoice_id)))
            fail(
              "Estorne os pagamentos das faturas vinculadas antes de editar a compra.",
            );
          del("purchases", p.id);
        }
        const pid = id();
        ins("purchases", {
          id: pid,
          card_id: p.card_id,
          description: p.description,
          category: p.category,
          total_cents: p.total_cents,
          date: p.date,
          count: p.count,
        });
        const start =
          p.first_month || firstInvoice(p.date, card.closing_day, card.due_day);
        for (const [n, amount] of splitInstallments(
          p.total_cents,
          p.count,
        ).entries()) {
          const mon = addMonths(start, n);
          const existing = d.invoices.find(
            (i) => i.card_id === card.id && i.month === mon,
          );
          const invoiceId = existing?.id || id();
          if (!existing)
            ins("invoices", {
              id: invoiceId,
              card_id: card.id,
              month: mon,
              ...invoiceDates(mon, card.closing_day, card.due_day),
            });
          ins("installments", {
            purchase_id: pid,
            invoice_id: invoiceId,
            installment_index: n + 1,
            amount_cents: amount,
          });
        }
        message = "Compra distribuída entre as faturas";
        break;
      }
      case "purchase/delete": {
        own("purchases", body.id);
        const invIds = d.installments
          .filter((i) => i.purchase_id === body.id)
          .map((i) => i.invoice_id);
        if (d.payments.some((p) => invIds.includes(p.invoice_id)))
          fail("Estorne os pagamentos vinculados antes de excluir a compra.");
        del("purchases", body.id);
        break;
      }
      case "invoice/pay": {
        const p = z
          .object({ invoice_id: z.string(), amount_cents: positive, date })
          .parse(body);
        own("invoices", p.invoice_id);
        if (p.date > today() || p.date < d.accounts[0].opening_date)
          fail("Use uma data efetiva entre o saldo inicial e hoje.");
        const inv = s.invoices.find((i) => i.id === p.invoice_id)!;
        if (p.amount_cents > inv.pending)
          fail("O pagamento excede o valor pendente.");
        ins("payments", p);
        break;
      }
      case "payment/delete":
        own("payments", body.id);
        del("payments", body.id);
        break;
      case "goal/save": {
        const p = z
          .object({
            id: z.string().optional(),
            name: label,
            description: z.string().max(500).default(""),
            target_cents: positive,
            monthly_cents: money,
            deadline: date.nullable(),
            priority,
            color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
            icon: z.enum(["shield", "plane", "laptop", "home", "sparkles"]),
            status: z.enum(["active", "paused", "completed", "archived"]),
            saved_cents: money.default(0),
          })
          .parse(body);
        if (p.id) {
          own("goals", p.id);
          const saved = s.goals.find((g) => g.id === p.id)!.saved;
          if (p.target_cents < saved)
            fail("A meta não pode ser menor que o valor guardado.");
          const { id: _, saved_cents: __, ...data } = p;
          upd("goals", p.id, data);
        } else {
          if (
            p.saved_cents > p.target_cents ||
            p.saved_cents > Math.max(0, s.confirmed - s.saved - s.reserved)
          )
            fail(
              "O valor guardado excede a meta ou o dinheiro livre confirmado.",
            );
          const gid = id();
          const { id: _, saved_cents: __, ...data } = p;
          ins("goals", { id: gid, ...data });
          if (p.saved_cents)
            ins("contributions", {
              goal_id: gid,
              amount_cents: p.saved_cents,
              date: today(),
              kind: "opening",
            });
        }
        const currency = (n: number) =>
          new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(n / 100);
        const statuses: Row = {
          active: "ativa",
          paused: "pausada",
          completed: "concluída",
          archived: "arquivada",
        };
        auditDescription = `Meta ${p.name}: alvo ${currency(p.target_cents)}, aporte mensal ${currency(p.monthly_cents)}, situação ${statuses[p.status]}`;
        message = "Meta salva";
        break;
      }
      case "goal/delete": {
        own("goals", body.id);
        if (d.contributions.some((c) => c.goal_id === body.id))
          fail("Arquive a meta para preservar seu histórico de aportes.");
        del("goals", body.id);
        break;
      }
      case "goal/contribute": {
        const p = z
          .object({
            goal_id: z.string(),
            amount_cents: z
              .number()
              .int()
              .min(-100_000_000_000)
              .max(100_000_000_000)
              .refine((n) => n !== 0),
            date,
          })
          .parse(body);
        own("goals", p.goal_id);
        if (p.date !== today())
          fail("Registre aportes e retiradas com a data de hoje.");
        const goal = s.goals.find((g) => g.id === p.goal_id)!;
        const reservations = reservationRows(d)
          .filter((a) => a.goal_id === p.goal_id)
          .sort((a, b) => a.month.localeCompare(b.month));
        const goalReserved = reservations.reduce(
          (sum, a) => sum + a.outstanding,
          0,
        );
        if (
          p.amount_cents > Math.max(0, s.freeToday) + goalReserved ||
          p.amount_cents > goal.remaining ||
          goal.saved + p.amount_cents < 0
        )
          fail("O aporte excede o dinheiro livre ou o saldo da meta.");
        const cid = id();
        ins("contributions", {
          id: cid,
          ...p,
          kind: p.amount_cents > 0 ? "deposit" : "withdrawal",
        });
        let toConsume = Math.max(0, p.amount_cents);
        for (const a of reservations) {
          const used = Math.min(toConsume, a.outstanding);
          if (used > 0) {
            ins("allocation_usages", {
              allocation_id: a.id,
              contribution_id: cid,
              amount_cents: used,
            });
            toConsume -= used;
          }
        }
        break;
      }
      case "contribution/delete": {
        const c = own("contributions", body.id);
        const saved = s.goals.find((g) => g.id === c.goal_id)!.saved;
        if (
          saved - c.amount_cents < 0 ||
          -c.amount_cents > Math.max(0, s.freeToday)
        )
          fail("O estorno deixaria a reserva inconsistente.");
        del("contributions", c.id);
        break;
      }
      case "allocation/save": {
        const p = z
          .object({ goal_id: z.string(), month, reserved_cents: money })
          .parse(body);
        own("goals", p.goal_id);
        const old = d.allocations.find(
          (a) => a.goal_id === p.goal_id && a.month === p.month,
        );
        const consumed = d.allocation_usages
          .filter((x) => x.allocation_id === old?.id)
          .reduce((n, x) => n + x.amount_cents, 0);
        const oldOutstanding = (old?.reserved_cents || 0) - consumed;
        const nextOutstanding = p.reserved_cents;
        if (nextOutstanding - oldOutstanding > Math.max(0, s.freeToday))
          fail("Não há dinheiro confirmado livre para essa reserva.");
        const goal = s.goals.find((g) => g.id === p.goal_id)!;
        const otherOutstanding = reservationRows(d)
          .filter((a) => a.goal_id === p.goal_id && a.id !== old?.id)
          .reduce((n, a) => n + a.outstanding, 0);
        if (nextOutstanding + otherOutstanding > goal.remaining)
          fail("A reserva excede o valor restante da meta.");
        if (old)
          upd("allocations", old.id, {
            reserved_cents: p.reserved_cents + consumed,
          });
        else ins("allocations", p);
        break;
      }
      default:
        fail("Ação não reconhecida.");
    }
    await commit(db, u, ops, auditDescription || message);
    return json({ ok: true, message });
  } catch (error) {
    if (error instanceof AppError)
      return Response.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    if (error instanceof z.ZodError)
      return Response.json(
        {
          error:
            "Confira os campos: " +
            error.issues
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .slice(0, 3)
              .join("; "),
        },
        { status: 400 },
      );
    if (error instanceof SyntaxError)
      return Response.json({ error: "Solicitação inválida." }, { status: 400 });
    console.error(
      "Fluxo: falha interna de operação",
      error instanceof Error ? error.name : "unknown",
    );
    return Response.json(
      {
        error: "Não foi possível salvar ou carregar os dados. Tente novamente.",
      },
      { status: 500 },
    );
  }
}

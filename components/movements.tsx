"use client";
import { useState } from "react";
import {
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Undo2,
  Check,
  Pencil,
  Copy,
  Trash2,
} from "lucide-react";
import { brl, shortDate, Empty } from "./ui";
import { today, type Row } from "@/lib/finance";
export function Movements({
  d,
  s,
  onEdit,
  onDelete,
  onToggle,
  onDuplicate,
}: any) {
  const [query, setQuery] = useState(""),
    [kind, setKind] = useState("all"),
    [frequency, setFrequency] = useState("all"),
    [status, setStatus] = useState("all"),
    [category, setCategory] = useState("all"),
    [view, setView] = useState("entries"),
    [start, setStart] = useState(""),
    [end, setEnd] = useState("");
  const entries = d.movements.map((m: Row) => ({
    ...m,
    type: m.kind,
    status: m.effective_date
      ? "confirmed"
      : m.date < today() && m.kind === "expense"
        ? "late"
        : "pending",
    display_date: m.effective_date || m.date,
  }));
  const items =
    view === "entries"
      ? entries
      : [
          ...entries,
          ...d.purchases.map((p: Row) => ({
            ...p,
            amount_cents: p.total_cents,
            type: "purchase",
            status: "confirmed",
            display_date: p.date,
          })),
          ...d.payments.map((p: Row) => ({
            ...p,
            description: "Pagamento de fatura",
            category: "Faturas",
            type: "payment",
            status: "confirmed",
            display_date: p.date,
          })),
          ...d.contributions.map((c: Row) => ({
            ...c,
            description:
              d.goals.find((g: Row) => g.id === c.goal_id)?.name || "Meta",
            category: "Metas",
            type: c.amount_cents > 0 ? "contribution" : "withdrawal",
            status: "confirmed",
            display_date: c.date,
          })),
          ...d.audit.map((a: Row) => ({
            ...a,
            amount_cents: 0,
            type: "change",
            category: "Alterações",
            status: "confirmed",
            display_date: a.date.slice(0, 10),
          })),
        ];
  const filtered = items
    .filter(
      (m: Row) =>
        (start ? m.display_date >= start : m.display_date >= s.start) &&
        (end ? m.display_date <= end : m.display_date < s.end) &&
        (kind === "all" || m.type === kind) &&
        (frequency === "all" ||
          (frequency === "fixed"
            ? Boolean(m.recurrence_id)
            : !m.recurrence_id)) &&
        (status === "all" || m.status === status) &&
        (category === "all" || m.category === category) &&
        m.description.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a: Row, b: Row) => b.display_date.localeCompare(a.display_date));
  const types: Record<string, string> = {
    income: "Receita",
    expense: "Despesa",
    purchase: "Compra no cartão",
    payment: "Pagamento de fatura",
    contribution: "Aporte",
    withdrawal: "Retirada",
    change: "Alteração",
  };
  return (
    <>
      <div className="stat-row">
        <div>
          <small>Receitas do ciclo</small>
          <strong className="positive">{brl(s.income)}</strong>
        </div>
        <div>
          <small>Despesas de consumo à vista</small>
          <strong>{brl(s.expenses)}</strong>
        </div>
        <div>
          <small>Obrigações ainda pendentes</small>
          <strong>{brl(s.pending)}</strong>
        </div>
      </div>
      <section className="panel">
        <div className="tabs">
          <button
            className={view === "entries" ? "active" : ""}
            onClick={() => {
              setView("entries");
              setKind("all");
            }}
          >
            Lançamentos
          </button>
          <button
            className={view === "history" ? "active" : ""}
            onClick={() => {
              setView("history");
              setKind("all");
            }}
          >
            Histórico unificado
          </button>
        </div>
        <div className="filters">
          <label className="search">
            <Search size={17} />
            <input
              aria-label="Pesquisar descrição"
              placeholder="Buscar uma movimentação"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Filtrar tipo"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="all">Todos os tipos</option>
            {Object.entries(types)
              .filter(
                ([k]) =>
                  view === "history" || ["income", "expense"].includes(k),
              )
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </select>
          <select
            aria-label="Filtrar fixos e variáveis"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
          >
            <option value="all">Fixos e variáveis</option>
            <option value="fixed">Recorrentes / fixos</option>
            <option value="variable">Avulsos / variáveis</option>
          </select>
          <select
            aria-label="Filtrar situação"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">Todas as situações</option>
            <option value="confirmed">Confirmados</option>
            <option value="pending">Pendentes</option>
            <option value="late">Atrasados</option>
          </select>
          <select
            aria-label="Filtrar categoria"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">Todas as categorias</option>
            {Array.from(new Set(items.map((m: Row) => m.category))).map(
              (c: any) => (
                <option key={c}>{c}</option>
              ),
            )}
          </select>
        </div>
        <div className="date-filters">
          <label>
            De{" "}
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            Até{" "}
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          {(start || end) && (
            <button
              className="text-link"
              onClick={() => {
                setStart("");
                setEnd("");
              }}
            >
              Usar ciclo selecionado
            </button>
          )}
          <small>{filtered.length} registros</small>
        </div>
        <div className="table-head">
          <span>Descrição / categoria</span>
          <span>Data</span>
          <span>Situação</span>
          <span>Valor</span>
          <span>Ações</span>
        </div>
        {filtered.length ? (
          filtered.map((m: Row) => (
            <div className="transaction-row" key={m.id}>
              <div className="transaction-name">
                <span
                  className={
                    "metric-icon " +
                    (m.type === "income" ? "income" : "expense")
                  }
                >
                  {m.type === "income" ? (
                    <ArrowDownLeft size={17} />
                  ) : (
                    <ArrowUpRight size={17} />
                  )}
                </span>
                <div>
                  <strong>{m.description}</strong>
                  <small>
                    {types[m.type]} · {m.category}
                    {m.frequency && m.frequency !== "none"
                      ? " · Recorrente"
                      : ""}
                  </small>
                </div>
              </div>
              <span className="transaction-date">
                {shortDate(m.display_date)}
              </span>
              <span className={"badge " + m.status}>
                {m.status === "confirmed"
                  ? "Confirmado"
                  : m.status === "late"
                    ? "Atrasado"
                    : "Previsto"}
              </span>
              <b
                className={
                  "transaction-value " + (m.type === "income" ? "positive" : "")
                }
              >
                {m.type === "income" ? "+" : ""}
                {m.type === "change" ? "—" : brl(Math.abs(m.amount_cents))}
              </b>
              <div className="row-actions">
                {["income", "expense"].includes(m.type) && (
                  <>
                    <button
                      className="icon-btn"
                      aria-label={
                        m.effective_date
                          ? "Cancelar confirmação"
                          : "Confirmar lançamento"
                      }
                      onClick={() => onToggle(m)}
                    >
                      {m.effective_date ? (
                        <Undo2 size={16} />
                      ) : (
                        <Check size={16} />
                      )}
                    </button>
                    <button
                      className="icon-btn"
                      aria-label={"Editar " + m.description}
                      onClick={() => onEdit(m)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label={"Duplicar " + m.description}
                      onClick={() => onDuplicate(m)}
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      className="icon-btn"
                      aria-label={"Excluir " + m.description}
                      onClick={() => onDelete(m)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        ) : (
          <Empty
            title="Nenhum registro neste período"
            text="Ajuste os filtros ou adicione seu primeiro lançamento."
            action="Novo lançamento"
            onAction={() => onEdit()}
          />
        )}
      </section>
      <section className="panel budgets">
        <div className="panel-title">
          <h2>Orçamento por categoria</h2>
        </div>
        {d.categories.filter((c: Row) => c.limit_cents !== null).length ? (
          d.categories
            .filter((c: Row) => c.limit_cents !== null)
            .map((c: Row) => {
              const spent =
                d.movements
                  .filter(
                    (m: Row) =>
                      m.kind === "expense" &&
                      m.category === c.name &&
                      m.date >= s.start &&
                      m.date < s.end,
                  )
                  .reduce((n: number, m: Row) => n + m.amount_cents, 0) +
                d.purchases
                  .filter(
                    (p: Row) =>
                      p.category === c.name &&
                      p.date >= s.start &&
                      p.date < s.end,
                  )
                  .reduce((n: number, p: Row) => n + p.total_cents, 0);
              return (
                <div className="budget-row" key={c.id}>
                  <span>{c.name}</span>
                  <div className="progress-track">
                    <i
                      style={{
                        width:
                          Math.min(100, (spent / (c.limit_cents || 1)) * 100) +
                          "%",
                        background:
                          spent > c.limit_cents
                            ? "var(--error)"
                            : "var(--primary)",
                      }}
                    />
                  </div>
                  <b>
                    {brl(spent)} / {brl(c.limit_cents)}
                  </b>
                  {spent > c.limit_cents && (
                    <small className="danger">Acima do limite</small>
                  )}
                </div>
              );
            })
        ) : (
          <p className="muted">
            Defina limites em Configurações. Compras no cartão entram pelo valor
            total na data da compra; o pagamento da fatura não duplica o
            consumo.
          </p>
        )}
      </section>
    </>
  );
}

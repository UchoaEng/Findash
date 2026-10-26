"use client";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Wallet,
  TrendingUp,
  CircleHelp,
  Sparkles,
  Target,
  ShieldCheck,
  Plane,
  Laptop,
  House,
  ChartNoAxesCombined,
} from "lucide-react";
import { brl, shortDate, Empty } from "./ui";
import { today, type Row } from "@/lib/finance";
export const goalIcons: Record<string, any> = {
  shield: ShieldCheck,
  plane: Plane,
  laptop: Laptop,
  home: House,
  sparkles: Sparkles,
};
export function Overview({
  d,
  s,
  onPage,
  onExplain,
  onMovement,
  onGoal,
  onPay,
}: any) {
  const pending = [
    ...d.movements
      .filter(
        (m: Row) => m.kind === "expense" && !m.effective_date && m.date < s.end,
      )
      .map((m: Row) => ({ ...m, type: "expense" })),
    ...s.invoices
      .filter((i: Row) => i.pending > 0 && i.due_date < s.end)
      .map((i: Row) => ({
        ...i,
        date: i.due_date,
        description:
          d.cards.find((c: Row) => c.id === i.card_id)?.name + " · Fatura",
        amount_cents: i.pending,
        type: "invoice",
      })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  const recent = [
    ...d.movements,
    ...d.payments.map((p: Row) => ({
      ...p,
      kind: "expense",
      description:
        "Pagamento · " +
        (d.cards.find(
          (c: Row) =>
            c.id ===
            d.invoices.find((i: Row) => i.id === p.invoice_id)?.card_id,
        )?.name || "Fatura"),
      category: "Pagamento de fatura",
      effective_date: p.date,
    })),
  ]
    .filter(
      (m: Row) =>
        (m.effective_date || m.date) >= s.start &&
        (m.effective_date || m.date) < s.end,
    )
    .sort((a: Row, b: Row) => b.date.localeCompare(a.date))
    .slice(0, 5);
  const essentials = d.movements
    .filter(
      (m: Row) =>
        m.kind === "expense" &&
        m.priority === 1 &&
        m.date >= s.start &&
        m.date < s.end,
    )
    .reduce((n: number, m: Row) => n + m.amount_cents, 0);
  const dist: [string, number, string][] = [
    ["Essenciais", essentials, "#315e53"],
    ["Faturas e parcelas", s.invoiceTotal, "#8da999"],
    ["Outras despesas", Math.max(0, s.expenses - essentials), "#d3b57b"],
    ["Metas sugeridas", s.planned, "#abc7bc"],
    ["Livre projetado", Math.max(0, s.projectedFree), "#e5eae4"],
  ];
  const distTotal = dist.reduce((n, x) => n + x[1], 0);
  return (
    <>
      <div className="overview-top">
        <section className="balance-card">
          <div className="balance-label">
            <span>
              <span className="live-dot" />
              SEU DINHEIRO LIVRE HOJE
            </span>
            <Wallet size={22} />
          </div>
          <strong>{brl(s.freeToday)}</strong>
          <p>
            {s.freeToday < 0
              ? "Os compromissos superam seu dinheiro livre confirmado."
              : "Para viver o presente, com o futuro organizado."}
          </p>
          <button onClick={onExplain}>
            Como chegamos a este valor?
            <ArrowUpRight size={15} />
          </button>
          <div className="balance-bottom">
            <div>
              <span>Saldo confirmado</span>
              <b>{brl(s.confirmed)}</b>
            </div>
            <div>
              <span>Em metas e reservas</span>
              <b>{brl(s.saved + s.reserved)}</b>
            </div>
          </div>
        </section>
        <section className="month-summary">
          <div className="panel-title">
            <h2>O mês em perspectiva</h2>
            <span className="pill">PROJEÇÃO</span>
          </div>
          <div className="summary-item">
            <span className="metric-icon income">
              <ArrowDownLeft size={18} />
            </span>
            <div>
              <small>Receitas do ciclo</small>
              <strong>{brl(s.income)}</strong>
            </div>
            <span className="muted">previstas + recebidas</span>
          </div>
          <div className="summary-item">
            <span className="metric-icon expense">
              <ArrowUpRight size={18} />
            </span>
            <div>
              <small>Total comprometido</small>
              <strong>{brl(s.commitments)}</strong>
            </div>
            <span className="muted">despesas + faturas</span>
          </div>
          <div className="summary-item">
            <span className="metric-icon">
              <TrendingUp size={18} />
            </span>
            <div>
              <small>Saldo projetado no fim do ciclo</small>
              <strong className={s.projected < 0 ? "danger" : ""}>
                {brl(s.projected)}
              </strong>
            </div>
          </div>
          <div className="summary-note">
            <CircleHelp size={14} />A projeção inclui valores que ainda não
            entraram.
          </div>
        </section>
      </div>
      <section className={"insight-strip " + (s.deficit ? "warning" : "")}>
        <span className="insight-symbol">
          <Sparkles size={20} />
        </span>
        <div>
          <strong>
            {s.deficit
              ? "Seu planejamento precisa de um ajuste."
              : s.income === 0
                ? "Vamos dar clareza ao seu próximo passo."
                : "Seu planejamento está tomando forma."}
          </strong>
          <p>
            {s.deficit
              ? `Déficit previsto de ${brl(s.deficit)}. A sugestão de aporte é zero até cobrir os compromissos.`
              : s.income
                ? `Seus compromissos representam ${Math.round((s.commitments / s.income) * 100)}% da renda do ciclo. Você pode planejar ${brl(s.planned)} para suas metas.`
                : "Adicione suas rendas, despesas e metas para receber um plano baseado na sua realidade."}
          </p>
        </div>
        <button className="text-link" onClick={() => onPage("planning")}>
          Ver meu plano
          <ArrowRight size={16} />
        </button>
      </section>
      <div className="dashboard-grid">
        <section className="panel distribution">
          <div className="panel-title">
            <div>
              <h2>Cada real com um destino</h2>
              <p>Como seu dinheiro está distribuído neste ciclo</p>
            </div>
            <ChartNoAxesCombined size={18} />
          </div>
          <div className="distribution-total">
            <strong>{brl(distTotal)}</strong>
            <span>em compromissos, metas e saldo livre</span>
          </div>
          <div
            className="segment-bar"
            aria-label="Distribuição financeira; valores detalhados abaixo"
          >
            {dist.map(([name, amount, color]) => (
              <span
                key={name}
                style={{
                  background: color,
                  width: `${(amount / (distTotal || 1)) * 100}%`,
                }}
              />
            ))}
          </div>
          <div className="distribution-legend">
            {dist.map(([name, amount, color]) => (
              <div key={name}>
                <span>
                  <i style={{ background: color }} />
                  {name}
                </span>
                <b>{brl(amount)}</b>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>No seu radar</h2>
              <p>Próximos compromissos e valores vencidos</p>
            </div>
            <button className="text-link" onClick={() => onPage("movements")}>
              Ver todos
              <ArrowUpRight size={15} />
            </button>
          </div>
          {pending.length ? (
            pending.slice(0, 4).map((m: Row) => (
              <div className="commitment" key={m.id}>
                <div className="date-tile">
                  <strong>{m.date.slice(-2)}</strong>
                  <small>
                    {shortDate(m.date).split(" ").slice(1).join(" ")}
                  </small>
                </div>
                <div className="grow">
                  <strong>{m.description}</strong>
                  <small className={m.date < today() ? "danger" : ""}>
                    {m.date < today()
                      ? "Vencido"
                      : m.type === "invoice"
                        ? "Fatura do cartão"
                        : "Pendente"}
                  </small>
                </div>
                <div className="right">
                  <b>{brl(m.amount_cents)}</b>
                  <button
                    className="text-link"
                    onClick={() =>
                      m.type === "invoice" ? onPay(m) : onMovement(m)
                    }
                  >
                    {m.type === "invoice" ? "Pagar" : "Detalhes"}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <Empty
              title="Nada pendente por aqui"
              text="Seus próximos vencimentos aparecem neste espaço."
            />
          )}
        </section>
        <section className="panel wide">
          <div className="panel-title">
            <div>
              <h2>Planos que ganham forma</h2>
              <p>Um pouco a cada mês. Mais perto a cada passo.</p>
            </div>
            <button className="text-link" onClick={() => onPage("goals")}>
              Ver metas
              <ArrowUpRight size={15} />
            </button>
          </div>
          {s.goals.some((g: Row) => g.status !== "archived") ? (
            <div className="mini-goals">
              {s.goals
                .filter((g: Row) => g.status !== "archived")
                .slice(0, 3)
                .map((g: Row) => {
                  const Icon = goalIcons[g.icon] || Target;
                  return (
                    <button
                      className="mini-goal"
                      key={g.id}
                      onClick={() => onPage("goals")}
                    >
                      <span
                        className="goal-icon"
                        style={{ color: g.color, background: g.color + "16" }}
                      >
                        <Icon size={20} />
                      </span>
                      <strong>{g.name}</strong>
                      <div>
                        <b>{brl(g.saved)}</b>
                        <small> de {brl(g.target_cents)}</small>
                      </div>
                      <div className="progress-track">
                        <i
                          style={{
                            width:
                              Math.min(100, (g.saved / g.target_cents) * 100) +
                              "%",
                            background: g.color,
                          }}
                        />
                      </div>
                      <small>
                        {Math.floor((g.saved / g.target_cents) * 100)}%
                        conquistado{" "}
                        <span>
                          {g.months === null
                            ? "Sem previsão"
                            : g.months === 0
                              ? "Concluída"
                              : `${g.months} aportes restantes`}
                        </span>
                      </small>
                    </button>
                  );
                })}
            </div>
          ) : (
            <Empty
              title="O que vem depois? Você escolhe."
              text="Crie uma meta e descubra quanto guardar para chegar lá."
              action="Criar uma meta"
              onAction={() => onGoal()}
            />
          )}
        </section>
        <section className="panel wide">
          <div className="panel-title">
            <div>
              <h2>Últimas movimentações</h2>
              <p>O que entrou e saiu do seu dia a dia</p>
            </div>
            <button className="text-link" onClick={() => onPage("movements")}>
              Ver histórico
              <ArrowUpRight size={15} />
            </button>
          </div>
          {recent.length ? (
            recent.map((m: Row) => (
              <div className="list-row" key={m.id}>
                <span
                  className={
                    "metric-icon " +
                    (m.kind === "income" ? "income" : "expense")
                  }
                >
                  {m.kind === "income" ? (
                    <ArrowDownLeft size={18} />
                  ) : (
                    <ArrowUpRight size={18} />
                  )}
                </span>
                <div className="grow">
                  <strong>{m.description}</strong>
                  <small>
                    {m.category} · {shortDate(m.effective_date || m.date)}
                  </small>
                </div>
                <div className="right">
                  <b className={m.kind === "income" ? "positive" : ""}>
                    {m.kind === "income" ? "+" : "−"}
                    {brl(m.amount_cents)}
                  </b>
                  <small>{m.effective_date ? "Confirmado" : "Previsto"}</small>
                </div>
              </div>
            ))
          ) : (
            <Empty
              title="Sua história começa agora"
              text="Registre uma receita ou despesa. O planejamento se atualiza a cada mudança."
              action="Adicionar lançamento"
              onAction={() => onMovement()}
            />
          )}
        </section>
      </div>
    </>
  );
}

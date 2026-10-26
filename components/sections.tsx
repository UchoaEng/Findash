"use client";
import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  CreditCard,
  Target,
  ArrowUpRight,
  ChartNoAxesCombined,
  CircleHelp,
  ShieldCheck,
  Download,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { brl, shortDate, monthName, Empty, api } from "./ui";
import { goalIcons } from "./overview";
import {
  addMonths,
  calculate,
  reservationRows,
  today,
  type Row,
} from "@/lib/finance";
export function Cards({
  d,
  s,
  onNew,
  onEdit,
  onPurchase,
  onInvoice,
  onDelete,
  onDeletePurchase,
}: any) {
  const [selected, setSelected] = useState("");
  const chosen = d.cards.find((c: Row) => c.id === selected) || d.cards[0];
  const invoices = s.invoices
    .filter((i: Row) => i.card_id === chosen?.id && i.total > 0)
    .sort((a: Row, b: Row) => a.month.localeCompare(b.month));
  const debt = invoices.reduce((n: number, i: Row) => n + i.pending, 0);
  return (
    <>
      <div className="section-header">
        <span className="muted">
          Sem conexão bancária. Você mantém o controle.
        </span>
        <button className="btn secondary" onClick={onNew}>
          <Plus size={16} />
          Adicionar cartão
        </button>
      </div>
      {d.cards.length ? (
        <>
          <div className="cards-grid">
            {d.cards.map((c: Row, i: number) => {
              const owed = s.invoices
                .filter((v: Row) => v.card_id === c.id)
                .reduce((n: number, v: Row) => n + v.pending, 0);
              return (
                <button
                  key={c.id}
                  className={
                    "credit-card card-tone-" +
                    (i % 3) +
                    (chosen?.id === c.id ? " selected" : "")
                  }
                  onClick={() => setSelected(c.id)}
                >
                  <span>
                    <CreditCard size={24} />
                    <span>CRÉDITO</span>
                  </span>
                  <h2>{c.name}</h2>
                  <div className="card-debt">
                    <small>Total pendente</small>
                    <strong>{brl(owed)}</strong>
                  </div>
                  <div>
                    <span>Fecha dia {c.closing_day}</span>
                    <span>Vence dia {c.due_day}</span>
                  </div>
                  {c.limit_cents !== null && (
                    <small>Limite cadastrado {brl(c.limit_cents)}</small>
                  )}
                </button>
              );
            })}
          </div>
          <section className="panel">
            <div className="panel-title">
              <div>
                <h2>{chosen.name}</h2>
                <p>
                  {brl(debt)} em obrigações pendentes · Faturas anteriores
                  preservam suas datas
                </p>
              </div>
              <div className="button-row">
                <button
                  className="icon-btn"
                  aria-label="Editar cartão"
                  onClick={() => onEdit(chosen)}
                >
                  <Pencil size={17} />
                </button>
                <button
                  className="icon-btn"
                  aria-label="Excluir cartão"
                  onClick={() => onDelete(chosen)}
                >
                  <Trash2 size={17} />
                </button>
                <button
                  className="btn"
                  onClick={() => onPurchase(undefined, chosen.id)}
                >
                  <Plus size={17} />
                  Nova compra
                </button>
              </div>
            </div>
            <h3>Faturas atuais e futuras</h3>
            {invoices.length ? (
              invoices.map((i: Row) => (
                <button
                  className="invoice-row"
                  key={i.id}
                  onClick={() => onInvoice(i)}
                >
                  <div className="date-tile">
                    <CreditCard size={20} />
                  </div>
                  <div className="grow">
                    <strong>{monthName(i.month)}</strong>
                    <small>
                      Fecha {shortDate(i.closing_date)} · Vence{" "}
                      {shortDate(i.due_date)}
                    </small>
                  </div>
                  <span
                    className={
                      "badge " +
                      (i.pending === 0
                        ? "confirmed"
                        : i.paid > 0
                          ? "pending"
                          : i.due_date < today()
                            ? "late"
                            : "pending")
                    }
                  >
                    {i.pending === 0
                      ? "Paga"
                      : i.paid > 0
                        ? "Parcialmente paga"
                        : i.due_date < today()
                          ? "Vencida"
                          : "Em aberto"}
                  </span>
                  <div className="right">
                    <b>{brl(i.total)}</b>
                    <small>{brl(i.pending)} pendente</small>
                  </div>
                  <ChevronRight size={17} />
                </button>
              ))
            ) : (
              <Empty
                title="Nenhuma fatura por enquanto"
                text="Adicione uma compra para ver seus próximos vencimentos."
              />
            )}
            <h3 className="spaced-title">Compras vinculadas</h3>
            {d.purchases
              .filter((p: Row) => p.card_id === chosen.id)
              .map((p: Row) => (
                <div className="list-row" key={p.id}>
                  <div className="grow">
                    <strong>{p.description}</strong>
                    <small>
                      {p.category} · {shortDate(p.date)} · {p.count} parcelas ·{" "}
                      {brl(p.total_cents)}
                    </small>
                  </div>
                  <button
                    className="icon-btn"
                    aria-label={"Editar " + p.description}
                    onClick={() => onPurchase(p)}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={"Excluir " + p.description}
                    onClick={() => onDeletePurchase(p)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
          </section>
        </>
      ) : (
        <section className="panel">
          <Empty
            title="Cartões organizados. Futuro mais leve."
            text="Cadastre seu cartão pelo apelido, fechamento e vencimento. Não precisamos do número ou CVV."
            action="Adicionar meu primeiro cartão"
            onAction={onNew}
          />
        </section>
      )}
    </>
  );
}
export function GoalCard({
  g,
  onEdit,
  onAdd,
  onWithdraw,
  onHistory,
  onDelete,
}: any) {
  const Icon = goalIcons[g.icon] || Target;
  const percent = Math.min(100, Math.floor((g.saved / g.target_cents) * 100));
  return (
    <section className="panel goal-card">
      <div className="goal-top">
        <span
          className="goal-icon"
          style={{ color: g.color, background: g.color + "16" }}
        >
          <Icon size={23} />
        </span>
        <span className="badge">
          {g.status === "active"
            ? "Em progresso"
            : g.status === "paused"
              ? "Pausada"
              : g.status === "completed"
                ? "Concluída"
                : "Arquivada"}
        </span>
        <button
          className="icon-btn"
          aria-label={"Editar " + g.name}
          onClick={onEdit}
        >
          <Pencil size={16} />
        </button>
      </div>
      <h2>{g.name}</h2>
      {g.description && <p className="muted">{g.description}</p>}
      <div className="goal-amount">
        <strong>{brl(g.saved)}</strong>
        <span>de {brl(g.target_cents)}</span>
      </div>
      <div className="progress-track">
        <i style={{ width: percent + "%", background: g.color }} />
      </div>
      <div className="goal-percent">
        <span>{percent}% conquistado</span>
        <span>Faltam {brl(g.remaining)}</span>
      </div>
      <div className="goal-projection">
        <span>
          Aporte planejado <b>{brl(g.monthly_cents)} / mês</b>
        </span>
        <span>
          Previsão{" "}
          <b>
            {g.months === null
              ? "Sem previsão com o aporte atual"
              : g.months === 0
                ? "Meta alcançada"
                : `${g.months} aportes · último de ${brl(g.last)}`}
          </b>
        </span>
        {g.deadline && (
          <span>
            Data desejada{" "}
            <b>
              {shortDate(g.deadline)} / {g.deadline.slice(0, 4)}
            </b>
          </span>
        )}
      </div>
      <div className="goal-buttons">
        <button className="btn" onClick={onAdd}>
          <Plus size={16} />
          Guardar
        </button>
        <button className="btn secondary" onClick={onWithdraw}>
          Retirar
        </button>
      </div>
      <div className="section-header">
        <button className="text-link" onClick={onHistory}>
          Ver histórico
          <ArrowUpRight size={14} />
        </button>
        <button
          className="icon-btn"
          aria-label={"Excluir " + g.name}
          onClick={onDelete}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </section>
  );
}
export function Planning({ d, s, month, u, onExplain, onAllocate }: any) {
  const [horizon, setHorizon] = useState(3);
  return (
    <>
      <section className="planning-hero">
        <div>
          <span className="eyebrow">UM PLANO QUE RESPEITA SUA REALIDADE</span>
          <h2>
            {s.deficit
              ? "Primeiro, recuperar o equilíbrio."
              : s.projectedFree > 0
                ? "Espaço para hoje. Direção para amanhã."
                : "Cada compromisso no seu lugar."}
          </h2>
          <p>
            {s.deficit
              ? `Déficit de ${brl(s.deficit)}. Adie aportes e revise as obrigações antes de separar dinheiro.`
              : `Suas metas podem receber até ${brl(s.planned)} neste ciclo, considerando o saldo projetado.`}
          </p>
        </div>
        <ChartNoAxesCombined size={54} />
      </section>
      <div className="stat-row">
        <div>
          <small>Obrigações pendentes</small>
          <strong>{brl(s.pending)}</strong>
        </div>
        <div>
          <small>Sugestão para metas</small>
          <strong>{brl(s.planned)}</strong>
        </div>
        <div>
          <small>Livre projetado após metas</small>
          <strong className={s.projectedFree < 0 ? "danger" : "positive"}>
            {brl(s.projectedFree)}
          </strong>
        </div>
      </div>
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Seu plano de distribuição</h2>
            <p>
              Essenciais → faturas → compromissos → segurança → metas → livre
            </p>
          </div>
          <button className="text-link" onClick={onExplain}>
            Entender o cálculo
            <CircleHelp size={16} />
          </button>
        </div>
        <div className="plan-line">
          <span className="step-number">1</span>
          <div className="grow">
            <strong>Despesas e faturas pendentes</strong>
            <small>Inclui vencidos e os próximos compromissos do ciclo.</small>
          </div>
          <b>{brl(s.pending)}</b>
        </div>
        <div className="plan-line">
          <span className="step-number">2</span>
          <div className="grow">
            <strong>Margem de segurança</strong>
            <small>Configurável no perfil financeiro</small>
          </div>
          <b>{brl(s.safety)}</b>
        </div>
        {s.goals
          .filter((g: Row) => g.status !== "archived")
          .map((g: Row) => {
            const suggested =
              s.suggestions.find((x: Row) => x.goalId === g.id)?.amount || 0;
            const allocation = reservationRows(d).find(
              (a: Row) => a.goal_id === g.id && a.month === month,
            );
            return (
              <div className="plan-line" key={g.id}>
                <span className="step-number">
                  <Target size={17} />
                </span>
                <div className="grow">
                  <strong>{g.name}</strong>
                  <small>
                    Prioridade {g.priority} · Desejado {brl(g.monthly_cents)} ·
                    Sugerido {brl(suggested)}
                    {suggested < g.monthly_cents && g.status === "active"
                      ? " · Reduza ou adie parte do aporte"
                      : ""}
                  </small>
                  <small>
                    Reserva do mês: {brl(allocation?.outstanding || 0)} ·
                    Guardado: {brl(g.saved)}
                  </small>
                </div>
                <button className="btn secondary" onClick={() => onAllocate(g)}>
                  Ajustar reserva
                </button>
              </div>
            );
          })}
        <h3 className="spaced-title">Cobertura com o dinheiro confirmado</h3>
        {s.coverage.map((o: Row) => (
          <div className="list-row" key={o.id}>
            <div className="grow">
              <strong>{o.name}</strong>
              <small>
                Prioridade {o.priority} · {shortDate(o.date)}
              </small>
            </div>
            <div className="right">
              <b>
                {brl(o.covered)} / {brl(o.amount)}
              </b>
              <small className={o.shortfall ? "danger" : "positive"}>
                {o.shortfall
                  ? `Faltam ${brl(o.shortfall)} confirmados`
                  : "Coberto pelo saldo"}
              </small>
            </div>
          </div>
        ))}
        <p className="form-note">
          Sugestões são planos. Reservas manuais usam apenas dinheiro confirmado
          livre. Aportes abatem reservas do mesmo mês. Edite a prioridade da
          meta para mudar sua ordem.
        </p>
      </section>
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>Compromissos dos próximos meses</h2>
            <p>
              Projeção por ciclo, sem acumular saldo anterior nem simular
              rentabilidade.
            </p>
          </div>
          <select
            aria-label="Horizonte de projeção"
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
          >
            <option value={3}>3 meses</option>
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
          </select>
        </div>
        <div className="projection-grid">
          {Array.from({ length: horizon }, (_, n) => {
            const m = addMonths(month, n),
              p = calculate(d, m, today(), u.cycle_day, u.safety_cents);
            const incoming = d.movements
                .filter(
                  (x: Row) =>
                    x.kind === "income" && x.date >= p.start && x.date < p.end,
                )
                .reduce((n: number, x: Row) => n + x.amount_cents, 0),
              expenses = d.movements
                .filter(
                  (x: Row) =>
                    x.kind === "expense" && x.date >= p.start && x.date < p.end,
                )
                .reduce((n: number, x: Row) => n + x.amount_cents, 0),
              invoice = p.invoices
                .filter((x: Row) => x.due_date >= p.start && x.due_date < p.end)
                .reduce((n: number, x: Row) => n + x.total, 0);
            return (
              <div className="projection-card" key={m}>
                <h3>{monthName(m)}</h3>
                <span>
                  Receitas <b>{brl(incoming)}</b>
                </span>
                <span>
                  Despesas <b>{brl(expenses)}</b>
                </span>
                <span>
                  Faturas <b>{brl(invoice)}</b>
                </span>
                <div>
                  <span>Resultado do ciclo</span>
                  <strong
                    className={
                      incoming - expenses - invoice < 0 ? "danger" : "positive"
                    }
                  >
                    {brl(incoming - expenses - invoice)}
                  </strong>
                </div>
              </div>
            );
          })}
        </div>
        <p className="form-note">
          Recorrências mensais possuem 24 ocorrências; anuais, 3. Renove as
          ocorrências ao fim desse prazo.
        </p>
      </section>
    </>
  );
}
export function Settings({
  d,
  u,
  setModal,
  remove,
  toggleTheme,
  dark,
  safe,
  setState,
}: any) {
  return (
    <div className="settings-grid">
      <section className="panel">
        <div className="panel-title">
          <h2>Seu perfil financeiro</h2>
          <button
            className="text-link"
            onClick={() => setModal({ type: "profile" })}
          >
            Editar
            <Pencil size={14} />
          </button>
        </div>
        <dl className="formula">
          {[
            ["Nome", u.display_name],
            ["Usuário", "@" + u.username],
            ["Saldo inicial", brl(d.accounts[0].opening_cents)],
            ["Início do ciclo", "Dia " + u.cycle_day],
            ["Margem de segurança", brl(u.safety_cents)],
            ["Fuso", "America/Sao_Paulo"],
          ].map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <button className="btn secondary" onClick={toggleTheme}>
          {dark ? <Sun size={16} /> : <Moon size={16} />}Tema{" "}
          {dark ? "claro" : "escuro"}
        </button>
      </section>
      <section className="panel">
        <div className="panel-title">
          <h2>Privacidade e segurança</h2>
          <ShieldCheck size={20} />
        </div>
        <p className="muted">
          Seus registros pertencem a você. Exporte uma cópia ou gerencie seu
          acesso.
        </p>
        <div className="settings-actions">
          <a className="btn secondary" href="/api/export" download>
            <Download size={16} />
            Exportar meus dados (JSON)
          </a>
          <button
            className="btn secondary"
            onClick={() => setModal({ type: "privacy" })}
          >
            Aviso de privacidade
          </button>
          <button
            className="btn secondary"
            onClick={() =>
              safe(async () => {
                await api("auth/logout", {});
                setState(null);
              })
            }
          >
            <LogOut size={16} />
            Sair da conta
          </button>
          <button
            className="text-link danger"
            onClick={() => setModal({ type: "deleteAccount" })}
          >
            Excluir conta e dados
          </button>
        </div>
      </section>
      <section className="panel wide">
        <div className="panel-title">
          <div>
            <h2>Categorias e limites mensais</h2>
            <p>
              Limites acompanham consumo; não reservam dinheiro automaticamente.
            </p>
          </div>
          <button
            className="btn secondary"
            onClick={() => setModal({ type: "category" })}
          >
            <Plus size={16} />
            Categoria
          </button>
        </div>
        {d.categories.length ? (
          d.categories.map((c: Row) => (
            <div className="list-row" key={c.id}>
              <div className="grow">
                <strong>{c.name}</strong>
                <small>
                  Prioridade {c.priority} · Limite{" "}
                  {c.limit_cents === null ? "não definido" : brl(c.limit_cents)}
                </small>
              </div>
              <button
                className="icon-btn"
                aria-label={"Editar " + c.name}
                onClick={() => setModal({ type: "category", row: c })}
              >
                <Pencil size={16} />
              </button>
              <button
                className="icon-btn"
                aria-label={"Excluir " + c.name}
                onClick={() =>
                  remove(
                    "category/delete",
                    c.id,
                    "Excluir esta configuração? Lançamentos preservam o nome da categoria.",
                  )
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        ) : (
          <p className="muted">
            Categorias sugeridas já estão disponíveis nos lançamentos. Adicione
            uma configuração para definir um limite.
          </p>
        )}
      </section>
    </div>
  );
}

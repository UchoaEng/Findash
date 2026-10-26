"use client";
import {
  Editor,
  Modal,
  Confirm,
  brl,
  unit,
  cents,
  amountField as af,
  dateField as df,
  prio,
  shortDate,
  monthName,
  api,
} from "./ui";
import {
  today,
  reservationRows,
  requiredContribution,
  type Row,
} from "@/lib/finance";
export function Editors({
  modal: m,
  close,
  command,
  d,
  u,
  s,
  month,
  cats,
  setModal,
  remove,
  setState,
}: any) {
  if (!m) return null;
  const row = m.row || {};
  const common = { onClose: close };
  if (m.type === "movement")
    return (
      <Editor
        {...common}
        title={row.id ? "Editar lançamento" : "Novo lançamento"}
        initial={{
          ...row,
          kind: row.kind || m.kind,
          amount: unit(row.amount_cents),
          date: row.date || today(),
          effective_date: row.effective_date || "",
          competency_date: row.competency_date || row.date || today(),
          payment_method: row.payment_method || "pix",
          priority: row.priority || 3,
          frequency: row.frequency || "none",
          category: row.category || "Outras",
          status: row.effective_date ? "confirmed" : "pending",
        }}
        fields={[
          {
            key: "kind",
            label: "Tipo",
            options: [
              ["expense", "Despesa"],
              ["income", "Receita"],
            ],
          },
          { key: "description", label: "Descrição" },
          af("amount", "Valor"),
          { key: "category", label: "Categoria", options: cats },
          df("date", "Data prevista / vencimento"),
          df("competency_date", "Data de compra / competência"),
          {
            key: "payment_method",
            label: "Forma de pagamento / recebimento",
            options: [
              ["pix", "Pix"],
              ["debit", "Débito"],
              ["cash", "Dinheiro"],
              ["transfer", "Transferência"],
            ],
          },
          {
            key: "status",
            label: "Situação",
            options: [
              ["pending", "Pendente / prevista"],
              ["confirmed", "Paga / recebida"],
            ],
          },
          df("effective_date", "Data efetiva (se confirmado)", false),
          prio,
          {
            key: "frequency",
            label: "Recorrência",
            options: [
              ["none", "Não repetir"],
              ["monthly", "Mensal · próximas 24 ocorrências"],
              ["yearly", "Anual · próximas 3 ocorrências"],
            ],
          },
          row.recurrence_id && {
            key: "scope",
            label: "Aplicar alteração",
            options: [
              ["one", "Apenas esta ocorrência"],
              ["future", "Esta e as futuras ainda não confirmadas"],
            ],
          },
        ]}
        extra={
          <p className="form-note">
            Compras no cartão devem ser registradas em Cartões. Recorrências
            geram ocorrências individuais e preservam registros confirmados.
          </p>
        }
        onSave={async (v: any) =>
          command({
            action: "movement/save",
            id: row.id,
            ...v,
            amount_cents: cents(v.amount),
            priority: Number(v.priority),
            effective_date:
              v.status === "confirmed" ? v.effective_date || today() : null,
          })
        }
      />
    );
  if (m.type === "card")
    return (
      <Editor
        {...common}
        title={row.id ? "Editar cartão" : "Adicionar cartão"}
        initial={{
          ...row,
          closing_day: row.closing_day || 25,
          due_day: row.due_day || 5,
          limit: row.limit_cents ? unit(row.limit_cents) : "",
        }}
        fields={[
          { key: "name", label: "Nome / apelido do cartão" },
          {
            key: "closing_day",
            label: "Dia de fechamento",
            type: "number",
            min: 1,
            max: 31,
          },
          {
            key: "due_day",
            label: "Dia de vencimento",
            type: "number",
            min: 1,
            max: 31,
          },
          af("limit", "Limite opcional", false),
        ]}
        extra={
          <p className="form-note">
            Não informe número, CVV ou credenciais bancárias. Para uma fatura
            anterior, crie uma compra chamada “Saldo anterior” e escolha a
            primeira fatura.
          </p>
        }
        onSave={(v: any) =>
          command({
            action: "card/save",
            id: row.id,
            name: v.name,
            closing_day: Number(v.closing_day),
            due_day: Number(v.due_day),
            limit_cents: v.limit ? cents(v.limit) : null,
          })
        }
      />
    );
  if (m.type === "purchase")
    return (
      <Editor
        {...common}
        title={row.id ? "Editar compra" : "Nova compra no cartão"}
        initial={{
          ...row,
          card_id: row.card_id || m.cardId || d.cards[0]?.id,
          total: unit(row.total_cents),
          date: row.date || today(),
          count: row.count || 1,
          category: row.category || "Compras",
          first_month: row.id
            ? d.invoices.find(
                (i: Row) =>
                  i.id ===
                  d.installments.find(
                    (x: Row) =>
                      x.purchase_id === row.id && x.installment_index === 1,
                  )?.invoice_id,
              )?.month
            : "",
        }}
        fields={[
          { key: "description", label: "Descrição" },
          af("total", "Total final, incluindo juros"),
          {
            key: "card_id",
            label: "Cartão",
            options: d.cards.map((c: Row) => [c.id, c.name]),
          },
          { key: "category", label: "Categoria", options: cats },
          df("date", "Data da compra"),
          {
            key: "count",
            label: "Número de parcelas",
            type: "number",
            min: 1,
            max: 60,
          },
          {
            key: "first_month",
            label: "Primeira fatura (opcional)",
            type: "month",
            required: false,
            hint: "Vazio: calculada pelo fechamento. Compra no dia do fechamento entra no próximo ciclo.",
          },
        ]}
        onSave={(v: any) =>
          command({
            action: "purchase/save",
            id: row.id,
            card_id: v.card_id,
            description: v.description,
            category: v.category,
            total_cents: cents(v.total),
            date: v.date,
            count: Number(v.count),
            first_month: v.first_month || undefined,
          })
        }
      />
    );
  if (m.type === "goal")
    return (
      <Editor
        {...common}
        title={row.id ? "Editar meta" : "Uma nova conquista"}
        initial={{
          ...row,
          target: unit(row.target_cents),
          monthly: unit(row.monthly_cents),
          saved: "0",
          priority: row.priority || 3,
          color: row.color || "#315e53",
          icon: row.icon || "sparkles",
          status: row.status || "active",
          mode: "monthly",
        }}
        fields={[
          { key: "name", label: "O que você quer conquistar?" },
          {
            key: "description",
            label: "Descrição (opcional)",
            required: false,
          },
          af("target", "Valor da meta"),
          !row.id && af("saved", "Já guardado, dentro do saldo atual"),
          {
            key: "mode",
            label: "Como planejar?",
            options: [
              ["monthly", "Posso guardar um valor por mês"],
              ["deadline", "Quero alcançar até uma data"],
            ],
          },
          af("monthly", "Aporte mensal"),
          df("deadline", "Data desejada", false),
          prio,
          {
            key: "icon",
            label: "Ícone",
            options: [
              ["shield", "Reserva"],
              ["plane", "Viagem"],
              ["laptop", "Tecnologia"],
              ["home", "Casa"],
              ["sparkles", "Conquista"],
            ],
          },
          { key: "color", label: "Cor", type: "color" },
          {
            key: "status",
            label: "Situação",
            options: [
              ["active", "Ativa"],
              ["paused", "Aportes pausados"],
              ["completed", "Concluída"],
              ["archived", "Arquivada"],
            ],
          },
        ]}
        extra={
          <p className="form-note">
            Metas separam parte do saldo, sem transferências ou rentabilidade.
            Planejar um aporte não aumenta o valor guardado.
          </p>
        }
        onSave={(v: any) => {
          const target = cents(v.target),
            saved = row.id
              ? s.goals.find((g: Row) => g.id === row.id)!.saved
              : cents(v.saved);
          if (v.mode === "deadline" && !v.deadline)
            throw new Error("Informe a data desejada.");
          return command({
            action: "goal/save",
            id: row.id,
            name: v.name,
            description: v.description,
            target_cents: target,
            monthly_cents:
              v.mode === "deadline"
                ? requiredContribution(target - saved, v.deadline, today())
                : cents(v.monthly),
            saved_cents: row.id ? 0 : saved,
            deadline: v.deadline || null,
            priority: Number(v.priority),
            color: v.color,
            icon: v.icon,
            status: v.status,
          });
        }}
      />
    );
  if (m.type === "contribution")
    return (
      <Editor
        {...common}
        title={m.withdraw ? "Retirar da meta" : "Guardar na meta"}
        initial={{ amount: "" }}
        fields={[
          af("amount", m.withdraw ? "Valor da retirada" : "Valor do aporte"),
        ]}
        extra={
          <p className="form-note">
            {row.name} · Guardado: {brl(row.saved)}. A reserva permanece dentro
            do saldo da conta.
          </p>
        }
        onSave={(v: any) =>
          command({
            action: "goal/contribute",
            goal_id: row.id,
            amount_cents: cents(v.amount) * (m.withdraw ? -1 : 1),
            date: today(),
          })
        }
      />
    );
  if (m.type === "payment")
    return (
      <Editor
        {...common}
        title="Pagar fatura"
        initial={{ amount: unit(row.pending), date: today() }}
        fields={[af("amount", "Valor pago"), df("date", "Data do pagamento")]}
        extra={
          <p className="form-note">
            Pendente: {brl(row.pending)}. Pagamentos parciais mantêm o restante
            como obrigação. Não calculamos juros automaticamente.
          </p>
        }
        onSave={(v: any) =>
          command({
            action: "invoice/pay",
            invoice_id: row.id,
            amount_cents: cents(v.amount),
            date: v.date,
          })
        }
      />
    );
  if (m.type === "allocation")
    return (
      <Editor
        {...common}
        title="Ajustar reserva virtual"
        initial={{
          amount: unit(
            reservationRows(d).find(
              (a: Row) => a.goal_id === row.id && a.month === month,
            )?.outstanding || 0,
          ),
        }}
        fields={[af("amount", "Reserva disponível do mês")]}
        extra={
          <p className="form-note">
            {row.name} · {monthName(month)}. Aportes consomem as reservas da
            meta, começando pelas mais antigas. Para liberar, informe zero.
          </p>
        }
        onSave={(v: any) =>
          command({
            action: "allocation/save",
            goal_id: row.id,
            month,
            reserved_cents: cents(v.amount),
          })
        }
      />
    );
  if (m.type === "category")
    return (
      <Editor
        {...common}
        title={row.id ? "Editar categoria" : "Nova categoria"}
        initial={{
          ...row,
          priority: row.priority || 3,
          limit: row.limit_cents ? unit(row.limit_cents) : "",
        }}
        fields={[
          { key: "name", label: "Nome" },
          prio,
          af("limit", "Orçamento mensal máximo", false),
        ]}
        onSave={(v: any) =>
          command({
            action: "category/save",
            id: row.id,
            name: v.name,
            priority: Number(v.priority),
            limit_cents: v.limit ? cents(v.limit) : null,
          })
        }
      />
    );
  if (m.type === "profile")
    return (
      <Editor
        {...common}
        title="Sua situação financeira"
        initial={{
          display_name: u.display_name,
          cycle_day: u.cycle_day,
          safety: unit(u.safety_cents),
          opening: unit(d.accounts[0].opening_cents),
          opening_date: d.accounts[0].opening_date,
        }}
        fields={[
          { key: "display_name", label: "Como podemos chamar você?" },
          af("opening", "Saldo inicial da conta"),
          df("opening_date", "Data do saldo inicial"),
          {
            key: "cycle_day",
            label: "Dia de início do ciclo",
            type: "number",
            min: 1,
            max: 31,
          },
          af("safety", "Reserva mínima de segurança"),
        ]}
        extra={
          <p className="form-note">
            O saldo inicial não é receita. Inclua nele o dinheiro já guardado
            nas metas. Alterá-lo corrige a base do histórico financeiro.
          </p>
        }
        onSave={(v: any) =>
          command({
            action: "profile",
            display_name: v.display_name,
            cycle_day: Number(v.cycle_day),
            opening_cents: cents(v.opening),
            opening_date: v.opening_date,
            safety_cents: cents(v.safety),
            onboarded: Boolean(u.onboarded),
          })
        }
      />
    );
  if (m.type === "deleteAccount")
    return (
      <Editor
        {...common}
        title="Excluir conta e todos os dados"
        initial={{}}
        fields={[
          { key: "password", label: "Confirme sua senha", type: "password" },
        ]}
        extra={
          <p className="form-error">
            Esta ação é permanente. Exporte seus dados antes de continuar.
          </p>
        }
        onSave={async (v: any) => {
          await api("account/delete", v);
          setState(null);
        }}
      />
    );
  if (m.type === "confirm")
    return (
      <Modal {...common} title={m.title}>
        <Confirm {...m} onClose={close} />
      </Modal>
    );
  if (m.type === "explain")
    return (
      <Modal {...common} title="Como calculamos seu dinheiro livre">
        <p className="muted">
          Ciclo de {shortDate(s.start)} até {shortDate(s.end)} (exclusive).
          Receitas futuras nunca entram no saldo confirmado.
        </p>
        <dl className="formula">
          {[
            ["Saldo confirmado", s.confirmed],
            ["− Despesas pendentes", -s.pendingExpenses],
            ["− Faturas pendentes", -s.pendingInvoices],
            ["− Guardado em metas", -s.saved],
            ["− Reservas ainda não aportadas", -s.reserved],
            ["− Margem de segurança", -s.safety],
            ["Livre hoje", s.freeToday],
          ].map(([label, v]) => (
            <div key={label as string}>
              <dt>{label}</dt>
              <dd>{brl(v as number)}</dd>
            </div>
          ))}
        </dl>
        <p className="form-note">
          Incluímos obrigações vencidas e as que vencem antes do fim do ciclo
          selecionado. Compra no cartão aumenta a fatura; apenas seu pagamento
          reduz o caixa. Reservas e metas não são despesas.
        </p>
        <h3>Saldo projetado: {brl(s.projected)}</h3>
        <p className="muted">
          Saldo no início do ciclo + receitas do período − saídas pagas −
          despesas e faturas pendentes. Após os aportes sugeridos e reservas,
          restam {brl(s.projectedFree)}.
        </p>
      </Modal>
    );
  if (m.type === "invoiceDetail")
    return (
      <Modal {...common} title={"Fatura · " + monthName(row.month)}>
        <div className="detail-total">
          <span>Total da fatura</span>
          <strong>{brl(row.total)}</strong>
          <span>
            Pago {brl(row.paid)} · Pendente {brl(row.pending)}
          </span>
        </div>
        {d.installments
          .filter((i: Row) => i.invoice_id === row.id)
          .map((i: Row) => {
            const p = d.purchases.find((p: Row) => p.id === i.purchase_id)!;
            return (
              <div className="list-row" key={i.id}>
                <div className="grow">
                  <strong>{p.description}</strong>
                  <small>
                    {p.category} · Parcela {i.installment_index}/{p.count}
                  </small>
                </div>
                <b>{brl(i.amount_cents)}</b>
              </div>
            );
          })}
        <h3>Pagamentos</h3>
        {d.payments
          .filter((p: Row) => p.invoice_id === row.id)
          .map((p: Row) => (
            <div className="list-row" key={p.id}>
              <span className="grow">
                {shortDate(p.date)} · {brl(p.amount_cents)}
              </span>
              <button
                className="text-link"
                onClick={() =>
                  remove(
                    "payment/delete",
                    p.id,
                    "Estornar o pagamento e reabrir a obrigação?",
                  )
                }
              >
                Estornar
              </button>
            </div>
          ))}
        {row.pending > 0 && (
          <button
            className="btn full"
            onClick={() => setModal({ type: "payment", row })}
          >
            Registrar pagamento
          </button>
        )}
      </Modal>
    );
  if (m.type === "goalHistory")
    return (
      <Modal {...common} title={"Histórico · " + row.name}>
        {d.contributions
          .filter((c: Row) => c.goal_id === row.id)
          .sort((a: Row, b: Row) => b.date.localeCompare(a.date))
          .map((c: Row) => (
            <div className="list-row" key={c.id}>
              <div className="grow">
                <strong>{c.amount_cents > 0 ? "Aporte" : "Retirada"}</strong>
                <small>
                  {shortDate(c.date)} · {brl(Math.abs(c.amount_cents))}
                </small>
              </div>
              <button
                className="text-link"
                onClick={() =>
                  remove(
                    "contribution/delete",
                    c.id,
                    "Estornar este registro e recalcular a reserva?",
                  )
                }
              >
                Estornar
              </button>
            </div>
          ))}
        {!d.contributions.some((c: Row) => c.goal_id === row.id) && (
          <p className="muted">Nenhum aporte registrado ainda.</p>
        )}
      </Modal>
    );
  if (m.type === "privacy")
    return (
      <Modal {...common} title="Privacidade e seus dados">
        <div className="prose">
          <p>
            O Fluxo coleta nome de usuário, verificadores de senha e
            recuperação, configurações e os registros financeiros que você
            informa. Esses dados permitem autenticar seu acesso e calcular seu
            planejamento.
          </p>
          <p>
            Os registros ficam vinculados à sua conta, no servidor Sites /
            Cloudflare D1. Não solicitamos CPF, telefone, número de cartão ou
            acesso bancário. Não enviamos o conteúdo financeiro a modelos de IA
            e não incluímos analytics.
          </p>
          <p>
            Senhas usam Argon2id. Códigos de recuperação e tokens são
            armazenados por verificadores criptográficos. Limites de tentativas
            usam identificadores derivados de usuário e origem da solicitação.
          </p>
          <p>
            Você pode exportar seus dados e excluir sua conta em Configurações.
            Backups de infraestrutura seguem a política do provedor. O serviço
            não realiza pagamentos ou investimentos reais.
          </p>
          <p>
            Fuso: America/Sao_Paulo. HTTPS em produção. Antes de oferecer o
            serviço ao público, o responsável deve complementar este aviso com
            sua identificação, contato e política de retenção.
          </p>
        </div>
      </Modal>
    );
  return null;
}

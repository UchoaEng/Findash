"use client";
import { useEffect, useState } from "react";
import {
  Plus,
  LayoutDashboard,
  ArrowLeftRight,
  CreditCard,
  Target,
  ChartNoAxesCombined,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Moon,
  Sun,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  X,
} from "lucide-react";
import { addMonths, currentCycleMonth, today, type Row } from "@/lib/finance";
import {
  Auth,
  Brand,
  Empty,
  brl,
  monthName,
  api,
  categories,
} from "@/components/ui";
import { Overview } from "@/components/overview";
import { Movements } from "@/components/movements";
import { Cards, GoalCard, Planning, Settings } from "@/components/sections";
import { Editors } from "@/components/editors";
const nav = [
  ["overview", "Visão geral", LayoutDashboard],
  ["movements", "Movimentações", ArrowLeftRight],
  ["cards", "Cartões", CreditCard],
  ["goals", "Metas", Target],
  ["planning", "Planejamento", ChartNoAxesCombined],
  ["settings", "Configurações", SettingsIcon],
] as const;
function LoadingShell() {
  return (
    <main className="loading-shell" aria-busy="true" aria-label="Carregando seus dados">
      <span className="sr-only">Organizando seu espaço financeiro…</span>
      <div className="loading-top">
        <span className="skeleton skeleton-brand" />
        <span className="skeleton skeleton-action" />
      </div>
      <div className="loading-title">
        <span className="skeleton skeleton-line short" />
        <span className="skeleton skeleton-line heading" />
        <span className="skeleton skeleton-line medium" />
      </div>
      <div className="loading-stats">
        {[0, 1, 2].map((item) => (
          <div className="skeleton-card" key={item}>
            <span className="skeleton skeleton-line short" />
            <span className="skeleton skeleton-line value" />
            <span className="skeleton skeleton-line medium" />
          </div>
        ))}
      </div>
      <div className="loading-panels">
        <div className="skeleton-card loading-chart">
          <span className="skeleton skeleton-line short" />
          <span className="skeleton skeleton-chart" />
        </div>
        <div className="skeleton-card loading-list">
          <span className="skeleton skeleton-line medium" />
          {[0, 1, 2, 3].map((item) => (
            <span className="skeleton skeleton-line" key={item} />
          ))}
        </div>
      </div>
    </main>
  );
}
export default function Home() {
  const [state, setState] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [fatal, setFatal] = useState(""),
    [page, setPage] = useState("overview"),
    [month, setMonth] = useState(today().slice(0, 7)),
    [modal, setModal] = useState<any>(null),
    [toast, setToast] = useState(""),
    [toastError, setToastError] = useState(false),
    [dark, setDark] = useState(false),
    [onboard, setOnboard] = useState(0);
  const load = async () => {
    try {
      setFatal("");
      const r = await api("state?month=" + month);
      setState(r);
      if (!state) {
        const current = currentCycleMonth(today(), r.user.cycle_day);
        if (current !== month) setMonth(current);
      }
    } catch (e: any) {
      if (e.status === 401) setState(null);
      else setFatal(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [month]);
  useEffect(() => {
    const t = localStorage.getItem("fluxo-theme") === "dark";
    setDark(t);
    document.documentElement.dataset.theme = t ? "dark" : "light";
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (loading || !state || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const targets = document.querySelectorAll(
      ".content > .page-header, .content > .onboarding, .content .panel, .content .stat-row, .content .goals-grid > *",
    );
    if (!targets.length || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -24px 0px" },
    );
    targets.forEach((target) => {
      target.classList.add("scroll-reveal");
      observer.observe(target);
    });
    return () => observer.disconnect();
  }, [loading, page, state]);
  const command = async (v: any) => {
    const r = await api("command?month=" + month, v);
    await load();
    setToastError(false);
    setToast(r.message);
  };
  const safe = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e: any) {
      setToastError(true);
      setToast(e.message);
    }
  };
  const remove = (action: string, id: string, text: string) =>
    setModal({
      type: "confirm",
      title: "Excluir registro?",
      text,
      run: () => command({ action, id }),
    });
  if (loading) return <LoadingShell />;
  if (fatal)
    return (
      <div className="page-loading">
        <Brand />
        <h2>Não conseguimos carregar seus dados.</h2>
        <p role="alert">{fatal}</p>
        <button className="btn" onClick={load}>
          Tentar novamente
        </button>
      </div>
    );
  if (!state) return <Auth onLogin={load} />;
  const { data: d, user: u, summary: s } = state;
  const cats = Array.from(
    new Set([...categories, ...d.categories.map((c: Row) => c.name)]),
  );
  const openMovement = (row?: Row, kind = "expense") =>
    setModal({ type: "movement", row, kind });
  const openCard = (row?: Row) => setModal({ type: "card", row });
  const openGoal = (row?: Row) => setModal({ type: "goal", row });
  const openPurchase = (row?: Row, cardId?: string) =>
    setModal({ type: "purchase", row, cardId });
  const toggleTheme = () => {
    const t = !dark;
    setDark(t);
    localStorage.setItem("fluxo-theme", t ? "dark" : "light");
    document.documentElement.dataset.theme = t ? "dark" : "light";
  };
  const finishOnboarding = async () => {
    await command({
      action: "profile",
      display_name: u.display_name,
      cycle_day: u.cycle_day,
      safety_cents: u.safety_cents,
      opening_cents: d.accounts[0].opening_cents,
      opening_date: d.accounts[0].opening_date,
      onboarded: true,
    });
    setOnboard(0);
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">SEU ESPAÇO FINANCEIRO</div>
        <nav>
          {nav.map(([key, label, Icon]) => (
            <button
              key={key}
              className={page === key ? "nav-item active" : "nav-item"}
              onClick={() => setPage(key)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {page === key && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="small-sun">✳</span>
            <p>
              Pequenos passos.
              <br />
              <strong>Grandes conquistas.</strong>
            </p>
          </div>
          <button className="user-menu" onClick={() => setPage("settings")}>
            <span className="avatar">
              {u.display_name.slice(0, 2).toUpperCase()}
            </span>
            <span>
              <strong>{u.display_name}</strong>
              <small>Minha conta pessoal</small>
            </span>
            <SettingsIcon size={16} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Meu espaço <ChevronRight size={14} />
            <strong>{nav.find((n) => n[0] === page)?.[1]}</strong>
          </div>
          <div className="top-actions">
            <button
              className="icon-btn"
              onClick={toggleTheme}
              aria-label="Alternar tema"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <span className="sync-label">
              <span />
              Dados salvos no servidor
            </span>
            <button
              className="mobile-settings icon-btn"
              aria-label="Configurações"
              onClick={() => setPage("settings")}
            >
              <SettingsIcon size={18} />
            </button>
          </div>
        </header>
        <main className="content">
          <div className="page-header">
            <div>
              <div className="eyebrow">
                {page === "overview"
                  ? "CADA ESCOLHA, UM NOVO CAMINHO"
                  : "SEU DINHEIRO, COM DIREÇÃO"}
              </div>
              <h1>
                {page === "overview"
                  ? `Bom te ver, ${u.display_name.split(" ")[0]}.`
                  : nav.find((n) => n[0] === page)?.[1]}
              </h1>
              <p>
                {page === "overview"
                  ? "Clareza para o agora. Tranquilidade para o que vem."
                  : page === "movements"
                    ? "Cada entrada e saída tem seu lugar."
                    : page === "cards"
                      ? "Suas compras de hoje, com os próximos meses à vista."
                      : page === "goals"
                        ? "Dê um destino ao dinheiro. E vida aos seus planos."
                        : page === "planning"
                          ? "Um plano possível, feito a partir da sua realidade."
                          : "Seu espaço, do seu jeito."}
              </p>
            </div>
            <div className="page-actions">
              <div className="month-picker">
                <button
                  aria-label="Mês anterior"
                  onClick={() => setMonth(addMonths(month, -1))}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  <CalendarDays size={15} />
                  {monthName(month)}
                </span>
                <button
                  aria-label="Próximo mês"
                  onClick={() => setMonth(addMonths(month, 1))}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <button className="btn" onClick={() => openMovement()}>
                <Plus size={18} />
                Novo lançamento
              </button>
            </div>
          </div>
          {!u.onboarded && (
            <section className="onboarding">
              <div className="onboarding-top">
                <span className="pill">SEU PRIMEIRO PASSO</span>
                <span>{onboard + 1} de 5</span>
              </div>
              <div className="onboarding-progress">
                {[0, 1, 2, 3, 4].map((n) => (
                  <i key={n} className={n <= onboard ? "done" : ""} />
                ))}
              </div>
              <div className="onboarding-body">
                <div>
                  <h2>
                    {
                      [
                        "Vamos começar pela sua realidade.",
                        "De onde vem seu dinheiro?",
                        "O que precisa ser pago todo mês?",
                        "Seus cartões, sem surpresas.",
                        "O que você quer conquistar?",
                      ][onboard]
                    }
                  </h2>
                  <p>
                    {
                      [
                        "Informe seu saldo atual e o dia em que seu ciclo começa.",
                        "Adicione salário e outras fontes, fixas ou variáveis.",
                        "Cadastre despesas essenciais e escolha a recorrência.",
                        "Adicione cartões e registre faturas anteriores como compras.",
                        "Crie sua primeira meta. Depois, o Fluxo faz as contas.",
                      ][onboard]
                    }
                  </p>
                </div>
                <button
                  className="btn secondary"
                  onClick={() =>
                    onboard === 0
                      ? setModal({ type: "profile" })
                      : onboard === 1
                        ? openMovement(undefined, "income")
                        : onboard === 2
                          ? openMovement()
                          : onboard === 3
                            ? openCard()
                            : openGoal()
                  }
                >
                  <Plus size={16} />
                  {
                    [
                      "Configurar situação",
                      "Adicionar renda",
                      "Adicionar despesa",
                      "Adicionar cartão",
                      "Criar uma meta",
                    ][onboard]
                  }
                </button>
              </div>
              <div className="onboarding-bottom">
                <span>
                  {onboard === 0
                    ? `Saldo inicial: ${brl(d.accounts[0].opening_cents)}`
                    : onboard === 1
                      ? `${d.movements.filter((m: Row) => m.kind === "income").length} receitas cadastradas`
                      : onboard === 2
                        ? `${d.movements.filter((m: Row) => m.kind === "expense").length} despesas cadastradas`
                        : onboard === 3
                          ? `${d.cards.length} cartões cadastrados`
                          : `${d.goals.length} metas cadastradas`}
                </span>
                <div>
                  {onboard > 0 && (
                    <button
                      className="text-link"
                      onClick={() => setOnboard(onboard - 1)}
                    >
                      Voltar
                    </button>
                  )}
                  <button
                    className="text-link"
                    onClick={() =>
                      safe(
                        onboard === 4
                          ? finishOnboarding
                          : async () => setOnboard(onboard + 1),
                      )
                    }
                  >
                    {onboard === 4
                      ? "Concluir planejamento"
                      : "Continuar ou pular"}
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </section>
          )}
          {page === "overview" && (
            <Overview
              d={d}
              s={s}
              onPage={setPage}
              onExplain={() => setModal({ type: "explain" })}
              onMovement={openMovement}
              onGoal={openGoal}
              onPay={(r: Row) => setModal({ type: "payment", row: r })}
            />
          )}
          {page === "movements" && (
            <Movements
              d={d}
              s={s}
              onEdit={openMovement}
              onToggle={(r: Row) =>
                safe(() => command({ action: "movement/toggle", id: r.id }))
              }
              onDelete={(r: Row) =>
                setModal({
                  type: "confirm",
                  title: "Excluir lançamento?",
                  text: r.recurrence_id
                    ? "Excluir apenas esta ocorrência ou também as futuras ainda não confirmadas?"
                    : "O registro será excluído e os saldos recalculados.",
                  run: () => command({ action: "movement/delete", id: r.id }),
                  future: r.recurrence_id
                    ? () =>
                        command({
                          action: "movement/delete",
                          id: r.id,
                          scope: "future",
                        })
                    : undefined,
                })
              }
              onDuplicate={(r: Row) =>
                openMovement({
                  ...r,
                  id: undefined,
                  recurrence_id: undefined,
                  effective_date: null,
                  date: today(),
                  frequency: "none",
                })
              }
            />
          )}
          {page === "cards" && (
            <Cards
              d={d}
              s={s}
              onNew={() => openCard()}
              onEdit={openCard}
              onPurchase={openPurchase}
              onInvoice={(r: Row) =>
                setModal({ type: "invoiceDetail", row: r })
              }
              onDelete={(r: Row) =>
                remove(
                  "card/delete",
                  r.id,
                  "O cartão será excluído se não houver compras vinculadas.",
                )
              }
              onDeletePurchase={(r: Row) =>
                remove(
                  "purchase/delete",
                  r.id,
                  "Excluir compra e parcelas? Faturas com pagamentos precisam ser estornadas primeiro.",
                )
              }
            />
          )}
          {page === "goals" && (
            <>
              <div className="section-header">
                <span className="muted">
                  {s.goals.length} planos para o futuro · {brl(s.saved)}{" "}
                  guardados
                </span>
                <button className="btn secondary" onClick={() => openGoal()}>
                  <Plus size={16} />
                  Nova meta
                </button>
              </div>
              <div className="goals-grid">
                {s.goals.map((g: Row) => (
                  <GoalCard
                    key={g.id}
                    g={g}
                    onEdit={() => openGoal(g)}
                    onAdd={() => setModal({ type: "contribution", row: g })}
                    onWithdraw={() =>
                      setModal({ type: "contribution", row: g, withdraw: true })
                    }
                    onHistory={() => setModal({ type: "goalHistory", row: g })}
                    onDelete={() =>
                      remove(
                        "goal/delete",
                        g.id,
                        "Metas com aportes devem ser arquivadas para preservar o histórico.",
                      )
                    }
                  />
                ))}
              </div>
              {!s.goals.length && (
                <section className="panel">
                  <Empty
                    title="Seu próximo sonho começa aqui"
                    text="Uma viagem, uma reserva, algo só seu. Defina o destino e encontre um ritmo possível."
                    action="Criar minha primeira meta"
                    onAction={() => openGoal()}
                  />
                </section>
              )}
            </>
          )}
          {page === "planning" && (
            <Planning
              d={d}
              s={s}
              month={month}
              u={u}
              onExplain={() => setModal({ type: "explain" })}
              onAllocate={(g: Row) => setModal({ type: "allocation", row: g })}
            />
          )}
          {page === "settings" && (
            <Settings
              d={d}
              u={u}
              setModal={setModal}
              remove={remove}
              toggleTheme={toggleTheme}
              dark={dark}
              safe={safe}
              setState={setState}
            />
          )}
          <footer className="app-footer">
            <span>
              <span className="brand-mini">fluxo.</span> Um passo de cada vez.
            </span>
            <button
              className="text-link"
              onClick={() => setModal({ type: "privacy" })}
            >
              Privacidade
            </button>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav">
        {nav.slice(0, 5).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setPage(key)}
            className={page === key ? "active" : ""}
          >
            <Icon size={20} />
            <span>{key === "movements" ? "Movimentos" : label}</span>
          </button>
        ))}
      </nav>
      <Editors
        key={modal?.type + (modal?.row?.id || "")}
        modal={modal}
        close={() => setModal(null)}
        command={command}
        d={d}
        u={u}
        s={s}
        month={month}
        cats={cats}
        setModal={setModal}
        remove={remove}
        setState={setState}
      />
      {toast && (
        <div
          role={toastError ? "alert" : "status"}
          className={"toast" + (toastError ? " toast-error" : "")}
        >
          {toastError ? <CircleAlert size={18} /> : <CheckCircle2 size={18} />}
          {toast}
          <button
            className="icon-btn"
            aria-label="Fechar aviso"
            onClick={() => setToast("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

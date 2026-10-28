"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Plus,
  X,
  ShieldCheck,
  TrendingUp,
  Copy,
  Download,
  Eye,
  EyeOff,
  LoaderCircle,
  Check,
  Sparkles,
} from "lucide-react";
export const brl = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    n / 100,
  );
export const shortDate = (s: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(
    new Date(s.slice(0, 10) + "T12:00:00"),
  );
export const monthName = (m: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(m + "-02T12:00:00"),
  );
export const cents = (v: any) => {
  const s = String(v ?? "0")
    .trim()
    .replace(",", ".");
  if (!/^-?\d+(\.\d{0,2})?$/.test(s))
    throw new Error("Use até duas casas decimais, sem separador de milhar.");
  const [w, f = ""] = s.replace("-", "").split(".");
  return (
    (s.startsWith("-") ? -1 : 1) * (Number(w) * 100 + Number(f.padEnd(2, "0")))
  );
};
export const unit = (n: number) => String((n || 0) / 100);
export const categories = [
  "Moradia",
  "Alimentação essencial",
  "Energia",
  "Água",
  "Internet",
  "Transporte",
  "Saúde",
  "Educação",
  "Seguros",
  "Lazer",
  "Compras",
  "Salário",
  "Outras rendas",
  "Outras",
];
export async function api(path: string, body?: any) {
  const r = await fetch("/api/" + path, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data: any = await r.json();
  if (!r.ok) {
    const e: any = new Error(data.error || "Não foi possível concluir.");
    e.status = r.status;
    throw e;
  }
  return data;
}
export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <i />
        <i />
        <i />
      </span>
      fluxo<span className="brand-dot">.</span>
    </div>
  );
}
export function Empty({ title, text, action, onAction }: any) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Sparkles size={24} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="btn secondary" onClick={onAction}>
          <Plus size={16} />
          {action}
        </button>
      )}
    </div>
  );
}
export function Modal({ title, children, onClose }: any) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2 id={titleId}>{title}</h2>
        <button className="icon-btn" aria-label="Fechar" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Field({ label, children, hint }: any) {
  const fid = React.useId();
  return (
    <label className="field" htmlFor={fid}>
      <span>{label}</span>
      {React.cloneElement(children, { id: fid })}
      {hint && <small>{hint}</small>}
    </label>
  );
}
function Password({ name = "password", label = "Senha" }: any) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label}>
      <span className="password-wrap">
        <input
          name={name}
          aria-label={label}
          type={show ? "text" : "password"}
          required
          minLength={10}
          maxLength={128}
          autoComplete={
            name === "confirm" ? "new-password" : "current-password"
          }
        />
        <button
          type="button"
          className="icon-btn"
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          onClick={() => setShow(!show)}
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </Field>
  );
}
export function Auth({ onLogin }: any) {
  const [mode, setMode] = useState("login"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [code, setCode] = useState(""),
    [saved, setSaved] = useState(false),
    [copied, setCopied] = useState(false);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const f = Object.fromEntries(new FormData(e.currentTarget));
    if (mode !== "login" && f.password !== f.confirm) {
      setError("As senhas precisam ser iguais.");
      return;
    }
    setBusy(true);
    try {
      const r = await api(
        "auth/" +
          (mode === "register"
            ? "register"
            : mode === "recover"
              ? "recover"
              : "login"),
        f,
      );
      if (r.recoveryCode) {
        setCode(r.recoveryCode);
        setSaved(false);
      } else onLogin();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const download = () => {
    const blob = new Blob(
      [
        "FLUXO — Código de recuperação\n\n" +
          code +
          "\n\nGuarde em local seguro.",
      ],
      { type: "text/plain;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fluxo-codigo-recuperacao.txt";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <main className="auth-page">
      <section className="auth-story">
        <Brand />
        <div className="story-copy">
          <span className="eyebrow">MENOS CONTAS NA CABEÇA. MAIS VIDA.</span>
          <h1>
            Seu dinheiro,
            <br />
            com direção.
          </h1>
          <p>
            Um lugar para organizar o presente.
            <br />E abrir espaço para o que vem depois.
          </p>
        </div>
        <div className="orbit-art" aria-hidden="true">
          <div className="orbit o1" />
          <div className="orbit o2" />
          <div className="orbit o3" />
          <div className="orbit-center">
            <TrendingUp size={46} />
          </div>
          <span className="orbit-label label-a">
            <ShieldCheck size={17} />
            Tranquilidade para planejar
          </span>
          <span className="orbit-label label-b">
            <Sparkles size={17} />
            Cada conquista começa aqui
          </span>
        </div>
        <p className="story-footer">
          FINANÇAS PESSOAIS, DE UM JEITO MAIS HUMANO.
        </p>
      </section>
      <section className="auth-form-area">
        <div className="auth-box">
          <div className="mobile-brand">
            <Brand />
          </div>
          {code ? (
            <>
              <span className="mini-icon">
                <ShieldCheck />
              </span>
              <h2>Sua conta, em boas mãos.</h2>
              <p>
                Este código permite recuperar sua conta caso você esqueça sua
                senha. Guarde-o em um lugar seguro. Não será possível consultar
                o mesmo código novamente.
              </p>
              <code className="recovery-code">{code}</code>
              <div className="button-row">
                <button
                  className="btn secondary"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(code);
                      setCopied(true);
                    } catch {
                      setError("Selecione e copie o código manualmente.");
                    }
                  }}
                >
                  <Copy size={16} />
                  {copied ? "Copiado" : "Copiar código"}
                </button>
                <button className="btn secondary" onClick={download}>
                  <Download size={16} />
                  Salvar .txt
                </button>
              </div>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={saved}
                  onChange={(e) => setSaved(e.target.checked)}
                />
                Guardei meu código em um local seguro.
              </label>
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              <button
                className="btn full"
                disabled={!saved}
                onClick={() => {
                  setCode("");
                  setMode("login");
                  setError("");
                }}
              >
                Ir para o login
                <ArrowRight size={17} />
              </button>
            </>
          ) : (
            <>
              <span className="eyebrow">BEM-VINDO AO FLUXO</span>
              <h2>
                {mode === "login"
                  ? "Bom ter você por aqui."
                  : mode === "register"
                    ? "Comece uma nova relação com seu dinheiro."
                    : "Vamos recuperar seu acesso."}
              </h2>
              <p>
                {mode === "login"
                  ? "Entre para continuar cuidando do que importa."
                  : mode === "register"
                    ? "Só um nome de usuário e uma senha. Simples assim."
                    : "Use o código salvo no cadastro. Sem ele e sem a senha, a recuperação automática não está disponível."}
              </p>
              <form onSubmit={submit} className="form-stack">
                <Field
                  label="Nome de usuário"
                  hint="3 a 32 caracteres: letras sem acento, números, ponto, _ ou -."
                >
                  <input
                    name="username"
                    required
                    autoComplete="username"
                    minLength={3}
                    maxLength={32}
                    placeholder="seu.usuario"
                  />
                </Field>
                {mode === "recover" && (
                  <Field label="Código de recuperação">
                    <input
                      name="code"
                      required
                      autoComplete="off"
                      placeholder="Cole seu código completo"
                      maxLength={100}
                    />
                  </Field>
                )}
                <Password label={mode === "recover" ? "Nova senha" : "Senha"} />
                {mode !== "login" && (
                  <>
                    <small className="muted">
                      Use pelo menos 10 caracteres.
                    </small>
                    <Password name="confirm" label="Confirme a senha" />
                  </>
                )}
                {mode === "login" && (
                  <button
                    type="button"
                    className="text-link forgot"
                    onClick={() => {
                      setMode("recover");
                      setError("");
                    }}
                  >
                    Esqueci minha senha
                  </button>
                )}
                {error && (
                  <p role="alert" className="form-error">
                    {error}
                  </p>
                )}
                <button className="btn full" disabled={busy}>
                  {busy ? <LoaderCircle className="spin" size={18} /> : null}
                  {mode === "login"
                    ? "Entrar na minha conta"
                    : mode === "register"
                      ? "Criar minha conta"
                      : "Redefinir senha"}
                  <ArrowRight size={17} />
                </button>
              </form>
              <div className="auth-switch">
                {mode === "login" ? (
                  <>
                    Primeira vez aqui?{" "}
                    <button
                      className="text-link"
                      onClick={() => {
                        setMode("register");
                        setError("");
                      }}
                    >
                      Crie sua conta
                    </button>
                  </>
                ) : (
                  <button
                    className="text-link"
                    onClick={() => {
                      setMode("login");
                      setError("");
                    }}
                  >
                    Voltar para o login
                  </button>
                )}
              </div>
            </>
          )}
          <div className="auth-security">
            <ShieldCheck size={16} />
            <span>Sem integração bancária. Seus dados ficam na sua conta.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
export function Editor({
  title,
  initial,
  fields,
  onSave,
  onClose,
  extra,
}: any) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal title={title} onClose={onClose}>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          setBusy(true);
          try {
            await onSave(Object.fromEntries(new FormData(e.currentTarget)));
            onClose();
          } catch (e: any) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          {fields.filter(Boolean).map((f: any) => (
            <Field key={f.key} label={f.label} hint={f.hint}>
              {f.options ? (
                <select
                  name={f.key}
                  defaultValue={initial[f.key] ?? f.default ?? ""}
                >
                  {f.options.map((o: any) => (
                    <option
                      key={typeof o === "string" ? o : o[0]}
                      value={typeof o === "string" ? o : o[0]}
                    >
                      {typeof o === "string" ? o : o[1]}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name={f.key}
                  type={f.type || "text"}
                  defaultValue={initial[f.key] ?? f.default ?? ""}
                  required={f.required !== false}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  maxLength={f.maxLength || 100}
                  inputMode={f.money ? "decimal" : undefined}
                />
              )}
            </Field>
          ))}
        </div>
        {extra}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn" disabled={busy}>
            {busy ? (
              <LoaderCircle size={16} className="spin" />
            ) : (
              <Check size={16} />
            )}
            Salvar
          </button>
        </div>
      </form>
    </Modal>
  );
}
export const amountField = (key: string, label: string, required = true) => ({
  key,
  label: label + " (R$)",
  money: true,
  required,
  hint: "Ex.: 1250,50",
});
export const dateField = (key: string, label: string, required = true) => ({
  key,
  label,
  type: "date",
  required,
});
export const prio = {
  key: "priority",
  label: "Prioridade",
  options: [
    ["1", "1 · Essencial"],
    ["2", "2 · Dívida / importante"],
    ["3", "3 · Normal"],
    ["4", "4 · Flexível"],
    ["5", "5 · Baixa"],
    ["6", "6 · Opcional"],
  ],
};
export function Confirm({ text, run, future, onClose }: any) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const doRun = async (fn: any) => {
    setBusy(true);
    try {
      await fn();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <p className="muted">{text}</p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="btn secondary" onClick={onClose}>
          Cancelar
        </button>
        {future && (
          <button
            className="btn destructive"
            disabled={busy}
            onClick={() => doRun(future)}
          >
            Esta e futuras
          </button>
        )}
        <button
          className="btn destructive"
          disabled={busy}
          onClick={() => doRun(run)}
        >
          {busy ? <LoaderCircle className="spin" size={16} /> : null}
          {future ? "Apenas esta" : "Confirmar"}
        </button>
      </div>
    </>
  );
}

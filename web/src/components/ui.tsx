import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ------------------------------------------------------------------ Layout

/**
 * Kopfzeile einer Ansicht. Der Titel ist optional: auf den Hauptseiten steht
 * er bereits in der Navigationsleiste — im Altsystem kam er dort aus
 * @PageTitle. Unterseiten (ein Kunde, eine Kampagne) setzen ihn, weil die
 * Leiste nur den Bereich nennt.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="view-header">
      <div>
        {title ? <h1 className="view-title">{title}</h1> : null}
        {description ? <p className="view-description">{description}</p> : null}
      </div>
      {actions ? <div className="toolbar">{actions}</div> : null}
    </div>
  );
}

export function Card({
  children,
  className,
  title,
  description,
  footer,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  footer?: ReactNode;
}) {
  return (
    <section className={cx("card", className)}>
      {title ? (
        <header className="card-header">
          <h2 className="card-title">{title}</h2>
          {description ? <p className="card-description">{description}</p> : null}
        </header>
      ) : null}
      <div className="card-body">{children}</div>
      {footer ? <footer className="card-footer">{footer}</footer> : null}
    </section>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <p style={{ fontWeight: 500, color: "var(--lumo-body-text-color)" }}>
        {title}
      </p>
      {description ? (
        <p style={{ margin: "0.5rem auto 0", maxWidth: "34rem" }}>
          {description}
        </p>
      ) : null}
      {action ? <div style={{ marginTop: "1rem" }}>{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------- Meldungen

export function Alert({
  variant = "info",
  title,
  children,
}: {
  variant?: "info" | "success" | "warning" | "error";
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cx("alert", `alert-${variant}`)}>
      {title ? <p className="alert-title">{title}</p> : null}
      {children ? <div>{children}</div> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "green" | "amber" | "red" | "blue";
}) {
  const cls = {
    slate: "",
    green: "badge-success",
    amber: "badge-warning",
    red: "badge-error",
    blue: "badge-primary",
  }[tone];
  return <span className={cx("badge", cls)}>{children}</span>;
}

// ---------------------------------------------------------------- Formulare

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && !error ? <p className="field-hint">{hint}</p> : null}
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cx("field-control", props.className)} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return (
    <textarea {...props} className={cx("field-control", props.className)} />
  );
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={cx("field-control", props.className)} />;
}

// ----------------------------------------------------------------- Aktionen

type ButtonVariant = "primary" | "secondary" | "error" | "tertiary";

const variantClass: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "",
  error: "btn-error",
  tertiary: "btn-tertiary",
};

export function Button({
  variant = "secondary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button {...props} className={cx("btn", variantClass[variant], className)} />
  );
}

export function LinkButton({
  variant = "secondary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return (
    <Link {...props} className={cx("btn", variantClass[variant], className)} />
  );
}

// ----------------------------------------------------------------- Tabellen

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="grid-wrapper">
      <table className="grid">{children}</table>
    </div>
  );
}

export function Th({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return <th className={className}>{children}</th>;
}

export function Td({
  children,
  className,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return <td className={className}>{children}</td>;
}

// ------------------------------------------------------------------ Formate

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function toDateInput(value: Date | null | undefined): string {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

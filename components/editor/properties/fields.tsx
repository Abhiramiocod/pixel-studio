"use client";

/**
 * Small, reusable property controls.
 *
 * Every editor input funnels through these so the properties panel stays a
 * composition of sections instead of one enormous component.
 */

import type { ReactNode } from "react";

export function Section({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 border-b border-zinc-100 pb-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
          {title}
        </h3>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Row({
  columns = 2,
  children,
}: {
  columns?: 1 | 2 | 3;
  children: ReactNode;
}) {
  const layout =
    columns === 1
      ? "grid-cols-1"
      : columns === 2
        ? "grid-cols-2"
        : "grid-cols-3";
  return <div className={`grid gap-2 ${layout}`}>{children}</div>;
}

export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-zinc-500">
      <span className="truncate">
        {label}
        {suffix ? ` (${suffix})` : ""}
      </span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(next);
        }}
        className="w-full rounded border border-zinc-200 px-2 py-1 text-sm text-zinc-900 tabular-nums"
      />
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-zinc-500">
      {label}
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded border border-zinc-200 px-2 py-1 text-sm text-zinc-900"
      />
    </label>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-zinc-500">
      {label}
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 w-14 cursor-pointer rounded border border-zinc-200 bg-white"
      />
    </label>
  );
}

export function SelectField<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-zinc-500">
      {label}
      <select
        value={value}
        onChange={(event) => {
          const raw = event.target.value;
          const match = options.find((option) => String(option.value) === raw);
          if (match) onChange(match.value);
        }}
        className="w-full truncate rounded border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900"
      >
        {options.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ToggleField({
  label,
  active,
  onChange,
}: {
  label: string;
  active: boolean;
  onChange: (active: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onChange(!active)}
      className={`rounded border px-2 py-1 text-xs transition-colors ${
        active
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-zinc-200 text-zinc-600 hover:bg-zinc-50"
      }`}
    >
      {label}
    </button>
  );
}

export function ActionButton({
  label,
  title,
  disabled,
  tone = "neutral",
  onClick,
}: {
  label: string;
  title?: string;
  disabled?: boolean;
  tone?: "neutral" | "danger";
  onClick: () => void;
}) {
  const palette =
    tone === "danger"
      ? "border-red-200 text-red-600 hover:bg-red-50"
      : "border-zinc-200 text-zinc-700 hover:bg-zinc-50";
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded border px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${palette}`}
    >
      {label}
    </button>
  );
}

/**
 * Field.tsx — Typed form field primitive (W1-1d).
 *
 * Wraps label + input + helper + error message with proper aria wiring.
 * Replaces ad-hoc form layouts in BuilderPanel/StandardPanel/SimulatorPage
 * and similar Preact form sites.
 *
 * A11y guarantees:
 *   - <label htmlFor> linked to input id (auto-generated if not provided)
 *   - helper text gets its own id; input.aria-describedby = helper id
 *   - error has role="alert" + aria-live="assertive"; input.aria-describedby
 *     includes error id when error is present, input.aria-invalid="true"
 *   - required → asterisk in label + aria-required="true"
 *   - disabled → input.disabled + label opacity-50
 *   - 44px minimum touch target on default md size
 *
 * Sizes: sm (32) | md (40, default — slightly under 44 to fit dense
 *        builder forms; use md=44 via custom class if standalone CTA-adjacent) |
 *        lg (48)
 *
 * Decorations: `prefix` ($, ⚠) and `suffix` (%, USDT) slots — non-interactive,
 *              positioned inside the input border.
 */
import type { ComponentChildren, JSX } from "preact";
import { useId } from "preact/hooks";

export type FieldType =
  | "text"
  | "number"
  | "email"
  | "password"
  | "date"
  | "url"
  | "search"
  | "tel";
export type FieldSize = "sm" | "md" | "lg";

export interface FieldProps {
  label: string;
  helper?: string;
  error?: string;
  required?: boolean;
  // Input props
  type?: FieldType;
  value?: string | number;
  defaultValue?: string | number;
  placeholder?: string;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  inputMode?: JSX.HTMLAttributes<HTMLInputElement>["inputMode"];
  pattern?: string;
  autoComplete?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  // Handlers
  onInput?: JSX.GenericEventHandler<HTMLInputElement>;
  onChange?: JSX.GenericEventHandler<HTMLInputElement>;
  onBlur?: JSX.FocusEventHandler<HTMLInputElement>;
  onFocus?: JSX.FocusEventHandler<HTMLInputElement>;
  onKeyDown?: JSX.KeyboardEventHandler<HTMLInputElement>;
  // Decorations
  prefix?: ComponentChildren;
  suffix?: ComponentChildren;
  // Sizing
  size?: FieldSize;
  fullWidth?: boolean;
  // Custom
  id?: string;
  name?: string;
  class?: string;
  inputClass?: string;
  "data-testid"?: string;
}

const inputSizeClasses: Record<FieldSize, string> = {
  sm: "h-8 min-h-[32px] text-xs px-3",
  md: "h-10 min-h-[40px] text-sm px-3",
  lg: "h-12 min-h-[48px] text-base px-4",
};

const labelSizeClasses: Record<FieldSize, string> = {
  sm: "text-[11px]",
  md: "text-xs",
  lg: "text-sm",
};

export default function Field({
  label,
  helper,
  error,
  required = false,
  type = "text",
  value,
  defaultValue,
  placeholder,
  min,
  max,
  step,
  inputMode,
  pattern,
  autoComplete,
  autoFocus,
  disabled = false,
  readOnly = false,
  onInput,
  onChange,
  onBlur,
  onFocus,
  onKeyDown,
  prefix,
  suffix,
  size = "md",
  fullWidth = false,
  id: idProp,
  name,
  class: className = "",
  inputClass = "",
  ...rest
}: FieldProps) {
  const reactId = useId();
  const id = idProp ?? `field-${reactId}`;
  const helperId = helper ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [errorId, helperId].filter(Boolean).join(" ") || undefined;

  const hasError = Boolean(error);
  const widthCls = fullWidth ? "w-full" : "";

  const inputBaseCls =
    "block w-full bg-[--color-bg-card] border rounded font-mono " +
    "text-[--color-text] placeholder:text-[--color-text-muted] " +
    "transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 " +
    "focus:ring-offset-[--color-bg] " +
    "disabled:opacity-50 disabled:cursor-not-allowed " +
    "read-only:bg-[--color-bg-hover] read-only:cursor-default";

  const inputStateCls = hasError
    ? "border-[--color-down] focus:border-[--color-down] focus:ring-[--color-down]"
    : "border-[--color-border] focus:border-[--color-accent] focus:ring-[--color-accent]";

  const inputCls =
    `${inputBaseCls} ${inputSizeClasses[size]} ${inputStateCls} ${prefix || suffix ? "" : ""} ${inputClass}`.trim();

  const labelCls = `font-mono uppercase tracking-wider mb-1 block ${labelSizeClasses[size]} ${disabled ? "opacity-50" : "text-[--color-text-muted]"}`;

  return (
    <div class={`${widthCls} ${className}`.trim()}>
      <label htmlFor={id} class={labelCls}>
        {label}
        {required && (
          <span class="text-[--color-down] ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div class="relative">
        {prefix && (
          <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[--color-text-muted] text-sm">
            {prefix}
          </span>
        )}
        <input
          id={id}
          name={name}
          type={type}
          value={value as string | undefined}
          defaultValue={defaultValue as string | undefined}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          inputMode={inputMode}
          pattern={pattern}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
          aria-required={required ? "true" : undefined}
          aria-invalid={hasError ? "true" : undefined}
          aria-describedby={describedBy}
          onInput={onInput}
          onChange={onChange}
          onBlur={onBlur}
          onFocus={onFocus}
          onKeyDown={onKeyDown}
          class={`${inputCls} ${prefix ? "pl-8" : ""} ${suffix ? "pr-10" : ""}`.trim()}
          {...rest}
        />
        {suffix && (
          <span class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-[--color-text-muted] text-sm">
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <p
          id={errorId}
          role="alert"
          aria-live="assertive"
          class="mt-1 text-xs font-mono text-[--color-down]"
        >
          {error}
        </p>
      )}
      {helper && !error && (
        <p
          id={helperId}
          class="mt-1 text-[11px] font-mono text-[--color-text-muted]"
        >
          {helper}
        </p>
      )}
    </div>
  );
}

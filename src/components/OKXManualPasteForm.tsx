/**
 * OKX manual API key paste form.
 *
 * Posts to backend POST /auth/okx/manual-connect, which validates the
 * credentials with OKX before persisting them. On success, the backend sets
 * the same `pruviq_okx_session` cookie as OAuth — so all /execute/* endpoints
 * see an identical session row regardless of how the user connected.
 *
 * The form is rendered inline by OKXConnectButton when AUTOTRADE_MANUAL_ENABLED
 * is true and the user is disconnected. It is NOT a standalone route.
 */
import { useState } from "preact/hooks";
import { API_BASE_URL as API_BASE } from "../config/api";
import { PRUVIQ_BACKEND_IP } from "../config/exchanges";
import { useTranslations, type Lang } from "../i18n/index";

interface Props {
  lang?: Lang;
  onSuccess?: () => void;
}

export default function OKXManualPasteForm({ lang = "en", onSuccess }: Props) {
  const t = useTranslations(lang);
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    if (submitting) return;

    const ak = apiKey.trim();
    const sk = secretKey.trim();
    const pp = passphrase.trim();
    if (!ak || !sk || !pp) {
      setError(t("okxManual.error.missing_field"));
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const resp = await fetch(`${API_BASE}/auth/okx/manual-connect`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: ak,
          secret_key: sk,
          passphrase: pp,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (resp.ok) {
        setSuccess(true);
        // Hand control back to the parent; OKXConnectButton flips to the
        // connected pill, then redirect after a short success flash.
        if (onSuccess) onSuccess();
        setTimeout(() => {
          const target = lang === "ko" ? "/ko/autotrading" : "/autotrading";
          window.location.assign(target);
        }, 800);
        return;
      }

      let detail = "";
      try {
        const body = await resp.json();
        detail = typeof body?.detail === "string" ? body.detail : "";
      } catch {
        // Non-JSON error body — fall back to status-only message.
      }

      // Map known backend error shapes to localized strings; surface anything
      // unknown verbatim so the user sees the OKX-side message rather than a
      // black-box "something went wrong".
      if (detail.startsWith("missing_field")) {
        setError(t("okxManual.error.missing_field"));
      } else if (
        detail.startsWith("invalid_credentials") ||
        detail.startsWith("malformed_field")
      ) {
        setError(`${t("okxManual.error.invalid_credentials")} (${detail})`);
      } else if (detail) {
        setError(detail);
      } else {
        setError(`${t("okxManual.error.network")} (HTTP ${resp.status})`);
      }
    } catch (err) {
      setError(t("okxManual.error.network"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      class="border border-[--color-accent]/20 rounded-xl p-5 bg-[--color-accent]/5"
      onSubmit={handleSubmit}
      data-testid="okx-manual-paste-form"
      noValidate
    >
      <h4 class="font-bold text-sm mb-1">{t("okxManual.heading")}</h4>
      <p class="text-xs text-[--color-text-muted] mb-3">
        {t("okxManual.subtitle")}
      </p>

      <div
        class="text-xs space-y-1.5 mb-4 p-3 rounded bg-[--color-bg-card] border border-[--color-border]"
        id="okx-manual-perms-info"
      >
        <p class="text-[--color-text-secondary]">
          <strong>{t("okxManual.perms.required")}</strong>
        </p>
        <p class="text-[--color-text-muted]">
          {t("okxManual.ip.recommend")}{" "}
          <code class="font-mono text-[--color-accent-bright]">
            {PRUVIQ_BACKEND_IP}
          </code>
        </p>
        <p class="text-[10px] text-[--color-text-muted]">
          {t("okxManual.ip.warning")}
        </p>
        <a
          href="https://www.okx.com/account/my-api"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-[--color-accent-bright] hover:underline inline-flex items-center gap-1 mt-1"
        >
          {t("okxManual.help.docs")} →
        </a>
      </div>

      <div class="space-y-3">
        <div>
          <label
            htmlFor="okx-manual-api-key"
            class="block text-xs font-medium text-[--color-text-secondary] mb-1"
          >
            {t("okxManual.field.api_key")}
          </label>
          <input
            id="okx-manual-api-key"
            type="text"
            class="w-full px-3 py-2.5 text-sm font-mono rounded border border-[--color-border] bg-[--color-bg-card] focus:border-[--color-accent] outline-none min-h-[44px]"
            placeholder={t("okxManual.placeholder.api_key")}
            value={apiKey}
            onInput={(e) => setApiKey((e.target as HTMLInputElement).value)}
            autoComplete="off"
            spellcheck={false}
            aria-describedby="okx-manual-perms-info"
            disabled={submitting || success}
            required
          />
        </div>

        <div>
          <label
            htmlFor="okx-manual-secret-key"
            class="block text-xs font-medium text-[--color-text-secondary] mb-1 flex items-center justify-between"
          >
            <span>{t("okxManual.field.secret_key")}</span>
            <button
              type="button"
              class="text-[10px] text-[--color-accent-bright] hover:underline"
              onClick={() => setShowSecret(!showSecret)}
              aria-pressed={showSecret}
            >
              {showSecret ? t("okxManual.hide") : t("okxManual.show")}
            </button>
          </label>
          <input
            id="okx-manual-secret-key"
            type={showSecret ? "text" : "password"}
            class="w-full px-3 py-2.5 text-sm font-mono rounded border border-[--color-border] bg-[--color-bg-card] focus:border-[--color-accent] outline-none min-h-[44px]"
            placeholder={t("okxManual.placeholder.secret_key")}
            value={secretKey}
            onInput={(e) => setSecretKey((e.target as HTMLInputElement).value)}
            autoComplete="off"
            spellcheck={false}
            disabled={submitting || success}
            required
          />
        </div>

        <div>
          <label
            htmlFor="okx-manual-passphrase"
            class="block text-xs font-medium text-[--color-text-secondary] mb-1 flex items-center justify-between"
          >
            <span>{t("okxManual.field.passphrase")}</span>
            <button
              type="button"
              class="text-[10px] text-[--color-accent-bright] hover:underline"
              onClick={() => setShowPassphrase(!showPassphrase)}
              aria-pressed={showPassphrase}
            >
              {showPassphrase ? t("okxManual.hide") : t("okxManual.show")}
            </button>
          </label>
          <input
            id="okx-manual-passphrase"
            type={showPassphrase ? "text" : "password"}
            class="w-full px-3 py-2.5 text-sm font-mono rounded border border-[--color-border] bg-[--color-bg-card] focus:border-[--color-accent] outline-none min-h-[44px]"
            placeholder={t("okxManual.placeholder.passphrase")}
            value={passphrase}
            onInput={(e) => setPassphrase((e.target as HTMLInputElement).value)}
            autoComplete="off"
            spellcheck={false}
            disabled={submitting || success}
            required
          />
        </div>
      </div>

      {error && (
        <p
          class="text-xs text-[--color-down] mt-3"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </p>
      )}

      {success && (
        <p
          class="text-xs text-[--color-up] mt-3"
          role="status"
          aria-live="polite"
        >
          {t("okxManual.success")}
        </p>
      )}

      <button
        type="submit"
        class="btn btn-primary btn-md w-full mt-4 min-h-[44px]"
        disabled={submitting || success}
        aria-label={
          submitting ? t("okxManual.submitting") : t("okxManual.submit")
        }
      >
        {submitting
          ? t("okxManual.submitting")
          : success
            ? t("okxManual.success")
            : t("okxManual.submit")}
      </button>

      <p class="text-[10px] text-[--color-text-muted] mt-3 leading-relaxed">
        {t("okxManual.disclaimer")}
      </p>
    </form>
  );
}

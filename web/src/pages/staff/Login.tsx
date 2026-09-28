import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useNavigate } from "react-router";
import Icon from "../../components/Icon";
import LanguageSwitch from "../../components/LanguageSwitch";
import { BigButton, ErrorBox, Field, inputClass } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { errorMessage } from "../../lib/format";

export default function Login() {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const from = (location.state as { from?: string } | null)?.from ?? "/app";

  if (user) return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 p-4">
      <LanguageSwitch />
      <main className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <div className="mb-6 flex items-center gap-2 text-2xl font-bold text-blue-900">
          <Icon name="mapPin" className="h-8 w-8" /> {t("app.name")}
        </div>
        <h1 className="mb-4 text-xl font-bold">{t("login.title")}</h1>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label={t("login.email")}>
            {(id) => (
              <input id={id} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
            )}
          </Field>
          <Field label={t("login.password")}>
            {(id) => (
              <input
                id={id}
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            )}
          </Field>
          {error && <ErrorBox message={error} />}
          <BigButton type="submit" big full disabled={busy}>
            {busy ? t("common.loading") : t("login.submit")}
          </BigButton>
        </form>
        <p className="mt-4 text-sm text-gray-600">{t("login.demo")}</p>
      </main>
    </div>
  );
}

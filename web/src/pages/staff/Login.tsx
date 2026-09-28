import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation } from "react-router";
import Icon from "../../components/Icon";
import LanguageSwitch from "../../components/LanguageSwitch";
import { BigButton, ErrorBox, Field, inputClass } from "../../components/ui";
import { isStaff, useAuth } from "../../lib/auth";
import { errorMessage } from "../../lib/format";

/** One login for everyone: staff use their email, citizens their mobile number. */
export default function Login() {
  const { t } = useTranslation();
  const { user, login } = useAuth();
  const location = useLocation();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const from = (location.state as { from?: string } | null)?.from;

  // Staff go to their area; citizens go back where they came from (e.g. the report form).
  const home = (staff: boolean) => (staff ? (from?.startsWith("/app") ? from : "/app") : from && !from.startsWith("/app") ? from : "/my");
  if (user) return <Navigate to={home(isStaff(user))} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(id.trim(), password);
      // Navigation happens through the <Navigate> above once `user` is set.
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 p-4 text-lg">
      <LanguageSwitch />
      <main className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <Link to="/" className="mb-6 flex items-center gap-2 text-2xl font-bold text-blue-900">
          <Icon name="mapPin" className="h-8 w-8" /> {t("app.name")}
        </Link>
        <h1 className="mb-4 text-xl font-bold">{t("login.title")}</h1>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label={t("login.identifier")}>
            {(fid) => <input id={fid} autoComplete="username" required value={id} onChange={(e) => setId(e.target.value)} className={inputClass} />}
          </Field>
          <Field label={t("login.password")}>
            {(fid) => (
              <input id={fid} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
            )}
          </Field>
          {error && <ErrorBox message={error} />}
          <BigButton type="submit" big full disabled={busy}>
            {busy ? t("common.loading") : t("login.submit")}
          </BigButton>
        </form>
        <p className="mt-5 text-base">
          {t("login.newHere")}{" "}
          <Link to="/signup" state={{ from }} className="inline-flex min-h-12 items-center font-bold text-blue-900 underline">
            {t("login.createAccount")}
          </Link>
        </p>
        {/* Demo accounts use demo1234 only locally; production uses a strong password. */}
        {import.meta.env.DEV && <p className="mt-2 text-sm text-gray-600">{t("login.demo")}</p>}
      </main>
    </div>
  );
}

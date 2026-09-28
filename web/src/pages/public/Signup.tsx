import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useLocation } from "react-router";
import { BigButton, ErrorBox, Field, inputClass } from "../../components/ui";
import { isStaff, useAuth } from "../../lib/auth";
import { errorMessage, fieldErrors } from "../../lib/format";

/** Citizen sign-up: name, mobile, password. Creates a CITIZEN account and logs in. */
export default function Signup() {
  const { t } = useTranslation();
  const { user, signup } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const errs = fieldErrors(error);

  if (user) return <Navigate to={isStaff(user) ? "/app" : from && !from.startsWith("/app") ? from : "/my"} replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signup(name.trim(), phone, password);
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-3xl font-bold">{t("signup.title")}</h1>
      <p className="text-lg text-gray-800">{t("signup.help")}</p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label={t("signup.name")} error={errs.name}>
          {(id) => <input id={id} autoComplete="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} min-h-14 text-lg`} />}
        </Field>
        <Field label={t("signup.phone")} error={errs.phone}>
          {(id) => (
            <input
              id={id}
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              required
              pattern="[6-9][0-9]{9}"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              className={`${inputClass} min-h-14 font-mono text-xl tracking-wider`}
            />
          )}
        </Field>
        <Field label={t("signup.password")} error={errs.password}>
          {(id) => <input id={id} type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} min-h-14 text-lg`} />}
        </Field>
        {error != null && <ErrorBox message={errorMessage(error)} />}
        <BigButton type="submit" big full icon="user" disabled={busy} className="min-h-16 text-xl">
          {busy ? t("common.loading") : t("signup.submit")}
        </BigButton>
      </form>
      <p className="text-center text-lg">
        {t("signup.haveAccount")}{" "}
        <Link to="/login" state={{ from }} className="inline-flex min-h-12 items-center font-bold text-blue-900 underline">
          {t("signup.login")}
        </Link>
      </p>
    </div>
  );
}

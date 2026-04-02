import { notFound } from "next/navigation";
import DevLoginClient from "./DevLoginClient";

export default function DevLoginPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const hasEnvCredentials = !!(
    process.env.DEV_LOGIN_EMAIL && process.env.DEV_LOGIN_PASSWORD
  );
  const devEmail = process.env.DEV_LOGIN_EMAIL ?? "";

  return (
    <DevLoginClient hasEnvCredentials={hasEnvCredentials} devEmail={devEmail} />
  );
}

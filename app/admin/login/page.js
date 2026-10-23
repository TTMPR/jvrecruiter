import Link from "next/link";
import { login } from "./actions";

const messages = {
  "invalid-login": "Email or password is incorrect.",
  "not-authorized": "This account is not authorized to access JVRecruit."
};

export default async function LoginPage({ searchParams }) {
  const params = await searchParams;
  const message = messages[params?.error];
  const nextPath = params?.next || "/admin/dashboard";

  return (
    <main className="login-shell">
      <div className="login-card">
        <Link href="/" className="wordmark">JVRecruit</Link>
        <p className="eyebrow">Recruiter workspace</p>
        <h1>Sign in</h1>
        <p className="muted">
          This area is private and available only to authorized JVRecruit recruiters.
        </p>

        {message ? <div className="error-box">{message}</div> : null}

        <form action={login} className="login-form">
          <input type="hidden" name="next" value={nextPath} />
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              defaultValue="joel@towerh.com"
              required
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button type="submit">Sign in</button>
        </form>
      </div>
    </main>
  );
}

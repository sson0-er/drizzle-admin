import { Layout, type PageChrome } from "./layout.js";

export interface LoginPageProps {
  /** Already passed through `safeNext`. */
  next: string;
  username: string;
  error?: string;
}

export function LoginPage(props: PageChrome & LoginPageProps) {
  const { t, prefix, csrfToken, next, username, error } = props;
  return (
    <Layout {...props}>
      <h1>{props.title}</h1>
      <form id="login-form" method="post" action={`${prefix}/login/`}>
        <input type="hidden" name="_csrf" value={csrfToken} />
        <input type="hidden" name="next" value={next} />
        {error === undefined ? null : <p class="errornote">{error}</p>}
        <div class="form-row">
          <label for="id_username">{t.username}</label>
          <input
            type="text"
            id="id_username"
            name="username"
            value={username}
            autocomplete="username"
            required
          />
        </div>
        <div class="form-row">
          <label for="id_password">{t.password}</label>
          {/* Never echo the password back, even after a failed attempt. */}
          <input
            type="password"
            id="id_password"
            name="password"
            autocomplete="current-password"
            required
          />
        </div>
        <div class="submit-row">
          <button type="submit">{t.login}</button>
        </div>
      </form>
    </Layout>
  );
}

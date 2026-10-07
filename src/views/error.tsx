import { Layout, type PageChrome } from "./layout.js";

export function ErrorPage(props: PageChrome & { status: number; message: string }) {
  return (
    <Layout {...props}>
      <h1>{String(props.status)}</h1>
      <p class="error-message">{props.message}</p>
    </Layout>
  );
}

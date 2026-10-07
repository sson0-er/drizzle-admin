import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { originCheck, tokensEqual } from "../src/auth/csrf.js";

const PUBLIC = "https://admin.example.com";

function makeApp(publicOrigin: string | null) {
  const app = new Hono();
  app.use("*", originCheck(publicOrigin));
  app.post("/", (c) => c.text("ok"));
  app.get("/", (c) => c.text("ok"));
  return app;
}

async function post(app: Hono, headers: Record<string, string>) {
  const res = await app.request("http://internal:3000/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers },
    body: "a=1",
  });
  return res.status;
}

describe("originCheck with publicOrigin (decision 020)", () => {
  const app = makeApp(PUBLIC);

  it("passes the exact Origin", async () => {
    expect(await post(app, { Origin: PUBLIC })).toBe(200);
  });

  it.each([
    ["different port", "https://admin.example.com:8443"],
    ["trailing slash", "https://admin.example.com/"],
    ["longer host with same prefix", "https://admin.example.com.evil.example"],
    ["different scheme", "http://admin.example.com"],
  ])("rejects %s", async (_name, origin) => {
    expect(await post(app, { Origin: origin })).toBe(403);
  });

  it("rejects the request URL origin when a public origin is set", async () => {
    expect(await post(app, { Origin: "http://internal:3000" })).toBe(403);
  });

  it("passes Sec-Fetch-Site: same-origin without Origin", async () => {
    expect(await post(app, { "Sec-Fetch-Site": "same-origin" })).toBe(200);
  });
});

describe("originCheck(null)", () => {
  const app = makeApp(null);

  it("passes Origin equal to the request URL origin", async () => {
    expect(await post(app, { Origin: "http://internal:3000" })).toBe(200);
  });

  it("rejects a foreign Origin", async () => {
    expect(await post(app, { Origin: "http://evil.example" })).toBe(403);
  });

  it("rejects without Origin and Sec-Fetch-Site", async () => {
    expect(await post(app, {})).toBe(403);
  });

  it("lets a GET pass without Origin", async () => {
    const res = await app.request("http://internal:3000/");
    expect(res.status).toBe(200);
  });
});

describe("tokensEqual", () => {
  it("is true for equal tokens", () => {
    expect(tokensEqual("abc123", "abc123")).toBe(true);
  });
  it("is false for different same-length tokens", () => {
    expect(tokensEqual("abc123", "abc124")).toBe(false);
  });
  it("is false for different lengths", () => {
    expect(tokensEqual("abc", "abcd")).toBe(false);
  });
  it("is false for empty vs non-empty", () => {
    expect(tokensEqual("", "a")).toBe(false);
  });
});

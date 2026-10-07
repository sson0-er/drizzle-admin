---
id: 2026-10-07-ts7-vitest-biome-compat
question: Can TypeScript 7, vitest 5 and a lint tool work together for typecheck, test, lint and build?
source: scratch project on Node 24.21.0 with typescript 7.0.2, vitest 5.0.3 (vite 8.3.3), @biomejs/biome 2.5.15; `npm view typescript-eslint@latest`, `npm view tsdown@latest` on 2026-10-07
fetched: 2026-10-07
expires: 2026-11-06
---
Learned: `tsc` 7.0.2 with module/moduleResolution nodenext, jsx react-jsx, jsxImportSource hono/jsx, declaration true emits .js and .d.ts; emitted JS imports `hono/jsx/jsx-runtime`, so consumers' tsconfig does not affect the built output. The §5.2 `ColumnKey<T>` type rejects a nonexistent column name and a `-nope` ordering key (checked with @ts-expect-error) under TS 7 with drizzle-orm 0.45.3.
vitest 5.0.3 runs .ts/.tsx tests, resolves `./x.js` imports to `./x.ts`/`.tsx`, and compiles Hono JSX using the tsconfig jsxImportSource (rendered output was Hono-escaped HTML).
typescript-eslint 8.71.1 (latest) peers `typescript >=4.8.4 <6.1.0`, so it does not support TS 7. tsdown 0.23.0 peers typescript ^5||^6||^7 (not exercised).
Biome 2.5.15: `lint/suspicious/noExplicitAny` flags `any`; a `// biome-ignore <rule>:` comment with an empty reason is itself an error ("Reason is missing"), so every suppression must carry a reason.
Unknown: tsx and @hono/node-server behavior with this setup (not probed).

---
name: Express 5 Request augmentation
description: How to add custom properties (e.g. req.userHash) to the Express Request type under @types/express v5
---

To add custom properties to `req` under `@types/express@5` (+ `@types/express-serve-static-core@5`, `moduleResolution: "bundler"`), augment the **global Express namespace**:

```ts
import "express";
declare global {
  namespace Express {
    interface Request {
      userHash?: string;
    }
  }
}
```

**Why:** In v5 the runtime `Request` interface merges from `global.Express.Request`. The older `declare module "express-serve-static-core" { interface Request {...} }` pattern silently does NOT merge in this setup — `tsc --noEmit` still reports TS2339 "Property does not exist on Request", even though the .d.ts is included. (esbuild ignores this, so the app runs fine at runtime and the breakage only shows up in typecheck / clean builds.)

**How to apply:** Property is optional (`?`), so handlers guarded by `requireSession` should read it as `req.userHash as string` (the middleware guarantees it at runtime). Repo convention: see games.ts. The production build (`build.mjs` esbuild) does NOT typecheck — run `pnpm run typecheck` before publishing to catch these.

# TODO

## Security

- [ ] **Prisma/effect vulnerability** — `effect@3.18.4` (transitive via `@prisma/config@6.19.2`) has a high-severity advisory (GHSA-38f7-945m-qr2g): AsyncLocalStorage context lost under concurrent RPC load. No fix available without Prisma upgrade to a version that pulls `effect>=3.20.0`. Monitor Prisma releases and upgrade when patched.

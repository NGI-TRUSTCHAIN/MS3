# Contributing to M3S

Thank you for contributing. This document describes the mandatory requirements and process for adding adapters, interfaces, tests and CI changes. All items below are required unless explicitly marked as optional.

---

## Process overview

- Open an issue using the appropriate template in .github/ISSUE_TEMPLATE:
  - `adapter/` — for new adapter proposals or adapter changes
  - `interface/` — for new interface proposals or breaking interface changes
- Include RFC-level rationale, compatibility plan, and required test scope in the issue.
- Create a PR that references the issue. PR must include the items from the relevant acceptance checklist below.
- Maintainers review. Authorized closers: AngelaHerrador, Gunner Andersen Gil.

---

## General repository rules

- Use semantic versioning for adapters (registry keys use "name@version").
- All adapter capabilities MUST use the shared `Capability` enum from `packages/shared`.
- Tests: unit tests required for all adapters. Integration tests optional but gated by RUN_INTEGRATION (see CI notes).
- CI must pass: lint, typecheck, build, unit tests. Commits that break build/tests will be rejected.
- Ensure registration is idempotent and import-safe (see Registration template section).

---

## Adapter acceptance checklist (MANDATORY)

Every adapter PR must include the following before it can be merged:

1. Implementation
   - Adapter class implements required interfaces:
     - `IAdapterIdentity`
     - `IAdapterLifecycle`
     - Module-specific interface(s) (e.g., `IEVMWallet` for wallet adapters).
   - Adapter exposes a static factory:
     ```ts
     static async create(args: AdapterArguments<OptionsType>) {
       const i = new Adapter(args);
       await i.initialize();
       return i;
     }
     ```
   - `initialize()` and `isInitialized()` implemented and tested.

2. Registration (`.registration.ts`)
   - File present at `packages/<module>/src/adapters/<adapter>/<adapter>.registration.ts`.
   - Exports a Joi schema for adapter options (e.g., `export const adapterOptionsSchema = Joi.object({...})`).
   - Calls `getRequirements(adapterOptionsSchema, '<adapter-name>')` to populate `requirements`.
   - Calls `getEnvironments('<adapter-name>', [...RuntimeEnvironment], limitations?, securityNotes?)` to populate `environment`.
   - Constructs an `AdapterMetadata` object including at minimum:
     - `name`, `version`, `module`, `adapterType`, `adapterClass`
     - `capabilities: Capability[]` (MUST use shared enum)
     - `requirements: Requirement[]`
     - `environment: EnvironmentRequirements`
     - optional `errorMap`
   - Must register the adapter via the registry:
     ```ts
     registry.registerAdapter('<module>', metadata);
     ```
   - Registration file MUST be import-safe (no side-effects that fail on import) and idempotent.

3. COMPATIBILITY MATRIX (MANDATORY)
   - The registration MUST call:
     ```ts
     const matrix = getStaticCompatibilityMatrix('<module>', '<adapter>', '<version>');
     if (matrix) registry.registerCompatibilityMatrix('<module>', matrix);
     ```
   - If the adapter has no static matrix, include an explicit comment in the registration file explaining compatibility expectations and runtime constraints.

4. Tests & package README
   - Unit tests added under `packages/<module>/tests` covering:
     - Adapter `create()` behavior and `initialize()` path
     - Validation: missing required options, wrong types
     - Capability-protected methods (when applicable)
   - If integration tests are provided, gate them with `RUN_INTEGRATION`:
     ```ts
     (RUN_INTEGRATION ? describe : describe.skip)('integration', () => { ... })
     ```
   - Update package README with a minimal usage snippet and example create call.
   - Add links to tests/adapters in the PR description for reviewer convenience (see "Tests & examples" below).

5. TypeScript & build
   - Types compile (`tsc`) with no errors.
   - Lint passes (ESLint).
   - All tests pass locally.

6. Packaging & exports
   - Adapter classes and registration should be exported in the module package index so lazy registration works when consumers import factory entrypoints.
   - Ensure package.json exports include the new adapter if required.

7. PR metadata
   - Include changelog entry (adapter name, version, short description). Prefer a package-level CHANGELOG.md or include a clear entry in PR body.
   - Link to the issue with rationale and compatibility considerations.

---

## Interface acceptance checklist (MANDATORY)

When proposing a new public interface or changes that affect consumers:

1. Issue + RFC
   - Open an `interface/` prefixed issue with technical rationale and migration/back-compat plan.

2. Types & Schema
   - Provide TypeScript interface/type definitions in `packages/<module>/src/types`.
   - Provide corresponding Joi schema when applicable for runtime validation.

3. Registry alias
   - If the interface is a convenience alias (e.g., `IEVMWallet`), register its shape via:
     ```ts
     registry.registerInterfaceShape('IEVMWallet', [ Capability.CoreWallet, ... ]);
     ```
     Add this registration in the module init (e.g., `packages/wallet/src/index.ts`) so factories can use `expectedInterface`.

4. Tests & migration
   - Unit tests that demonstrate backward compatibility or required migration steps.
   - Migration notes and a deprecation plan if changing an existing interface.

5. Approval
   - Major interface changes require explicit maintainer approval (AngelaHerrador + Gunner Andersen Gil).

---

## Registration template pointers (recommended pattern)

Registration should be idempotent and import-safe. Minimal pattern:

- Export Joi schema `adapterOptionsSchema`.
- Compute `requirements` with `getRequirements(adapterOptionsSchema, adapterName)`.
- Compute `environment` with `getEnvironments(adapterName, [RuntimeEnvironment.SERVER], ...)`.
- Build `AdapterMetadata` and call `registry.registerAdapter(moduleName, metadata)`.
- Publish static compatibility matrix via `getStaticCompatibilityMatrix` + `registry.registerCompatibilityMatrix`.

Template & examples (copy for new adapters):
- Wallet template: `packages/wallet/src/adapters/template/wallet.registration.ts` and `packages/wallet/src/adapters/template/wallet.ts`
- Smart-contract template: `packages/smart-contract/src/adapters/template/contract.registration.ts` and `packages/smart-contract/src/adapters/template/contract.ts`
- Crosschain example: `packages/crosschain/src/adapters/LI.FI.registration.ts` and `packages/crosschain/src/adapters/LI.FI.Adapter.ts`
- Live adapter examples: `packages/wallet/src/adapters/*` and `packages/crosschain/src/adapters/*`

---

## CI notes & commands

- Standard commands (repo root):
  - Install: `npm ci`
  - Build: `npm run build`
  - Test: `npm test` (unit)
  - Monorepo package test: `npm --workspace packages/wallet test`
- Pre-flight (recommended locally):
  - npm ci
  - npm run lint
  - npm run build
  - npm test
- If developers encounter dependency resolution issues with workspaces, fall back to:
  - npm install --legacy-peer-deps
  - npm run build
- RUN_INTEGRATION:
  - Unix: `RUN_INTEGRATION=1 npm test`
  - Windows (cmd): `set RUN_INTEGRATION=1 && npm test`
  - Windows (PowerShell): `$env:RUN_INTEGRATION=1; npm test`
- CI gating:
  - PR must pass: lint, typecheck, build, unit tests.
  - Integration tests run only when `RUN_INTEGRATION` enabled or on release branches as configured.

- Publishing:
  - Publish scripts require Azure credentials (set in CI secrets).
  - DO NOT commit credentials to source.

---

## Reviewer checklist (what reviewers must verify)

- Code implements required interfaces and lifecycle.
- Registration file present and follows template.
- `capabilities` array uses `Capability` enum (no strings).
- `getStaticCompatibilityMatrix` used and matrix registered.
- Unit tests present and sufficient.
- Types compile and linter errors fixed.
- No secrets or credentials committed.
- README and package README updated with minimal usage.

Suggested PR description checklist for authors (copy into PR body):
- [ ] Links to issue / RFC
- [ ] Tests added (unit/integration flagged)
- [ ] Registration file added and metadata registered
- [ ] Compatibility matrix registered or explanation added
- [ ] README updated
- [ ] Local pre-flight run: lint, build, test (passed)

---

## Tests & examples (author / reviewer convenience)

Include links to relevant live examples in your PR description:
- Wallet tests: `packages/wallet/tests` (e.g., 00_Registry.test.ts, 01_Core.test.ts, 03_IEVMWallet.test.ts)
- Wallet adapters: `packages/wallet/src/adapters/*`
- Shared helpers (keys / registry / errors): `packages/shared/src/helpers/*` and `packages/shared/src/registry/*`
- Crosschain adapters: `packages/crosschain/src/adapters/*`
- Smart-contract templates & artifacts: `packages/smart-contract/src/adapters/template/*`

---

## Versioning & Releases

- Adapters follow semver. Registry stores adapters keyed as `name@version`.
- Use minor/major bumps for breaking changes. Document breaking changes in the compatibility matrix entry.

---

## Authorized closers & maintainers

- Maintainers:
  - AngelaHerrador — Lead maintainer
  - Gunner Andersen Gil — Core maintainer
- Authorized closers:
  - AngelaHerrador
  - Gunner Andersen Gil

Merges and closures should reference the issue and include migration notes if closing as "not planned".

---

## Questions / support

If anything in this checklist is unclear, feel free to contact the team with suggestions for improvements at: https://m3s.changetheblock.com/collaboration/
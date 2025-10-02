<div align="center">
  <img src="./logo.png" alt="MS3 Banner" width="300"/>
</div>

# M3S - Modular Web3 Suite.

> IMPORTANT: active development. See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution workflow.

## M3S - Introduction
- A modular adapter framework to compose wallet, smart-contract and cross-chain integrations with deterministic validation, capability-based feature discovery and cross-package compatibility matrices.

## Quick links — authoritative references (use these when implementing adapters / interfaces)

- Registry (packages/shared/src/registry)
  - filepath: packages/shared/src/registry/registry.ts
  - Exports:
    - registry (singleton) — UniversalRegistry instance.
    - type UniversalRegistry (exported type).
  - What it does:
    - Stores modules and adapters keyed by moduleName → (adapterName@version → AdapterMetadata).
    - Stores compatibility matrices keyed by moduleName → (adapterName@version → CompatibilityMatrix).
    - Stores interface aliases (registerInterfaceShape) mapping alias → Capability[].
    - Helpers for querying: getAdapter, getLatestAdapter, getAdapterVersions, getModuleAdapters, getAllModules, getCompatibilityMatrix, getEnvironmentRequirements, supportsEnvironment, findAdaptersWithCapability, getCompatibleAdapters.
  - When to use:
    - In adapter registration files (registry.registerAdapter / registerCompatibilityMatrix).
    - In factories to resolve adapter metadata before create().
  - Example:
    ```ts
    import { registry } from '@m3s/shared';
    // register module (run once on module init)
    registry.registerModule({ name: Ms3Modules.wallet, version: '1.0.0' });
    // lookup adapter metadata
    const info = registry.getAdapter(Ms3Modules.wallet, 'ethers', '1.0.0');
    ```

- Dev tooling & validation (packages/shared/src/helpers)
  - devtool (packages/shared/src/helpers/devtool.ts)
    - Exports: getRequirements(joiSchema, adapterName) -> Requirement[], getEnvironments(adapterName, supportedEnvs, limitations?, notes?) -> EnvironmentRequirements
    - What it does:
      - Converts Joi schemas to runtime Requirement[] (server-side) or returns safe fallbacks (browser).
      - Produces curated EnvironmentRequirements (supportedEnvironments, limitations, securityNotes) used by registry metadata and validateEnvironment.
    - When to use:
      - Always in registration files to populate metadata.requirements and metadata.environment.
    - Example:
      ```ts
      import Joi from 'joi';
      import { getRequirements, getEnvironments } from '@m3s/shared';
      const schema = Joi.object({ privateKey: Joi.string() });
      const requirements = getRequirements(schema, 'myAdapter');
      const env = getEnvironments('myAdapter', [RuntimeEnvironment.SERVER]);
      ```
  - validator (packages/shared/src/helpers/validator.ts)
    - Exports: validateAdapterParameters(args: ValidatorArguments): void
    - What it does:
      - Performs the "Promise & Verify" interface check: maps expectedInterface → Capability[] via registry.getInterfaceShape and ensures adapter.capabilities includes all required capabilities.
      - Validates adapterInfo.requirements against the factory params (path lookup, type checks, allowUndefined).
      - Throws AdapterError with codes: INTERNAL_ERROR, INCOMPATIBLE_ADAPTER, MISSING_ADAPTER_REQUIREMENT, INVALID_ADAPTER_REQUIREMENT_TYPE.
    - When to use:
      - Called by factories before instantiating adapters.
    - Example:
      ```ts
      validateAdapterParameters({
        moduleName: Ms3Modules.wallet,
        name: 'ethers',
        version: '1.0.0',
        params, adapterInfo, registry, factoryMethodName: 'createWallet'
      });
      ```

- Capabilities & runtime proxies (packages/shared/src/registry/capability.ts, packages/shared/src/errors/proxy.ts)
  - capability (packages/shared/src/registry/capability.ts)
    - Exports: Capability (enum), MethodToCapabilityMap (Record<string, Capability>)
    - What it does:
      - Canonical capability names for adapters (use these in registration metadata.capabilities).
      - Map method name → capability used by proxy to guard method calls.
  - proxy (packages/shared/src/errors/proxy.ts)
    - Exports: createErrorHandlingProxy(adapterInstance, capabilities, errorMap?, defaultErrorCode?, contextName?) -> proxied adapter
    - What it does:
      - Wraps adapter instances, enforces capability-based method access, standardizes errors into AdapterError, maps low-level errors via errorMap.
    - When to use:
      - Factories wrap created adapter instances with this prior to returning to callers.
    - Example:
      ```ts
      return createErrorHandlingProxy(adapter, adapterInfo.capabilities, adapterInfo.errorMap || {}, undefined, `WalletAdapter(${name})`);
      ```

- Compatibility database & helpers (packages/shared/src/registry/compatibility.ts)
  - Exports: getStaticCompatibilityMatrix(moduleName, adapterName, version) -> CompatibilityMatrix | undefined, checkCrossPackageCompatibility(...)
  - What it does:
    - Holds authoritative static compatibility matrices (WALLET_COMPATIBILITY, SMART_CONTRACT_COMPATIBILITY, CROSSCHAIN_COMPATIBILITY).
    - checkCrossPackageCompatibility verifies capability and environment requirements between specific adapter instances.
  - When to use:
    - Mandatory: registration files MUST call getStaticCompatibilityMatrix(...) and registry.registerCompatibilityMatrix(...) to publish compatibility info.
    - Factories / UIs can call registry.getCompatibleAdapters(...) to list compatible adapters.

- Environment helpers (packages/shared/src/helpers/environment.ts)
  - Exports: detectRuntimeEnvironment() -> RuntimeEnvironment[], validateEnvironment(adapterName, EnvironmentRequirements) -> void
  - What it does:
    - detectRuntimeEnvironment detects SERVER / BROWSER.
    - validateEnvironment verifies adapter.environment.supportedEnvironments contains at least one detected runtime and throws AdapterError with WalletErrorCode.environment if not.
  - When to use:
    - Factories should call validateEnvironment(adapterName, adapterInfo.environment) before adapter.create().

- Factories (packages/*/src/index.ts)
  - Wallet (packages/wallet/src/index.ts)
    - Exports: createWallet(params: IWalletOptions)
    - Flow:
      1. registry.registerModule(...) (module init)
      2. registry.registerInterfaceShape(...) (declare convenience alias e.g., 'IEVMWallet')
      3. lazy-import adapter registration (import('./adapters/ethers/ethersWallet.registration.js'))
      4. adapterInfo = registry.getAdapter(module, name, version)
      5. validateEnvironment(name, adapterInfo.environment)
      6. validateAdapterParameters({...})
      7. adapter = await AdapterClass.create({ name, version, options })
      8. return createErrorHandlingProxy(adapter, adapterInfo.capabilities, adapterInfo.errorMap, ..., `WalletAdapter(${name})`)
    - When to use:
      - Consumers call createWallet(...) to obtain a proxied wallet adapter instance.
  - Smart-contract and Cross-chain factories follow the same pattern; review their package/index.ts for module-specific details.

- Types & shapes (packages/shared/src/types)
  - AdapterMetadata (packages/shared/src/types/registry.ts)
    - Required fields for registration metadata used by factories and registry: name, version, module, adapterType, adapterClass, capabilities: Capability[], requirements: Requirement[], environment: EnvironmentRequirements, errorMap? etc.
  - Use these types in registration files and adapter implementations to ensure compile-time safety.

Notes / contract between registration and factories
- Registrations MUST:
  - Export a Joi options schema and call getRequirements(schema, adapterName).
  - Call getEnvironments(adapterName, supportedEnvs, limitations?, securityNotes?).
  - Build AdapterMetadata with required fields and call registry.registerAdapter(moduleName, metadata).
  - Obtain static compatibility matrix via getStaticCompatibilityMatrix(moduleName, adapterName, version) and call registry.registerCompatibilityMatrix(moduleName, matrix). This is mandatory.
- Factories WILL:
  - Use registry metadata to validate environment and parameters and will refuse to instantiate incompatible adapters.

## Short architecture overview

High level
- The repository is modular: each domain is a package under packages/ (shared, wallet, smart-contract, crosschain).
- packages/shared contains the common runtime: registry, capability definitions, compatibility database, helpers (devtool, validator, environment), error types and proxy utilities. Module packages consume shared.
- Each domain package (wallet, smart-contract, crosschain) exposes a factory entrypoint (packages/<module>/src/index.ts) that is the public API for consumers.

Module responsibilities
- shared
  - registry (packages/shared/src/registry/registry.ts): authoritative runtime store for modules, adapters (multi-version keyed by "name@version"), compatibility matrices and interface alias shapes.
  - capability (packages/shared/src/registry/capability.ts): canonical capability enum and MethodToCapabilityMap used by proxies and validators.
  - compatibility (packages/shared/src/registry/compatibility.ts): static compatibility matrices and checkCrossPackageCompatibility helper.
  - helpers (packages/shared/src/helpers): getRequirements / getEnvironments (devtool), validateAdapterParameters (validator), detectRuntimeEnvironment & validateEnvironment (environment).
  - errors & proxy (packages/shared/src/errors): AdapterError and createErrorHandlingProxy for standardized errors and capability enforcement.
- wallet / smart-contract / crosschain
  - Each package registers itself in registry.registerModule on init (see packages/wallet/src/index.ts).
  - Adapter implementations live under packages/<module>/src/adapters/<adapterName>.
  - Each adapter must provide a registration file (.registration.ts) that exports the Joi schema, computes requirements via getRequirements, computes environment via getEnvironments, constructs AdapterMetadata and calls registry.registerAdapter plus registry.registerCompatibilityMatrix (mandatory).

Factory flow (what happens when consumer calls createX)
1. Consumer calls factory (e.g., createWallet(params) in packages/wallet/src/index.ts).
2. Factory lazy-loads adapter registration (import('./adapters/ethers/ethersWallet.registration.js')) so registration runs at runtime.
3. Factory resolves adapter metadata: registry.getAdapter(module, name, version).
4. Factory calls validateEnvironment(name, adapterInfo.environment) — fails early if environment unsupported.
5. Factory calls validateAdapterParameters({ moduleName, name, version, params, adapterInfo, registry, factoryMethodName }) — performs Promise & Verify (expectedInterface → registry.getInterfaceShape) and requirement checks (adapterInfo.requirements derived from JUOI or fallback).
6. Factory calls AdapterClass.create({ name, version, options }) and awaits initialization.
7. Factory returns createErrorHandlingProxy(adapter, adapterInfo.capabilities, adapterInfo.errorMap || {}, ..., `ModuleAdapter(${name})`), enforcing method-capability mapping and standardized errors.

Notes on compatibility & versions
- Adapters are keyed by "name@version" in the registry. Use registry.getAdapterVersions(module, name) or registry.getLatestAdapter(...) to select versions.
- Registrations MUST publish a static CompatibilityMatrix (getStaticCompatibilityMatrix(...) + registry.registerCompatibilityMatrix(...)). checkCrossPackageCompatibility enforces required capabilities and performs runtime environment checks using detectRuntimeEnvironment during cross-module compatibility queries.

Where to find the code that implements the above
- registry core: packages/shared/src/registry/registry.ts
- capability mapping: packages/shared/src/registry/capability.ts
- static compatibility DB + lookup: packages/shared/src/registry/compatibility.ts
- factory example (wallet): packages/wallet/src/index.ts
- adapter registration example (ethers): packages/wallet/src/adapters/ethers/ethersWallet.registration.ts
- getRequirements / getEnvironments: packages/shared/src/helpers/devtool.ts
- validateAdapterParameters: packages/shared/src/helpers/validator.ts
- environment checks: packages/shared/src/helpers/environment.ts
- proxy + errors: packages/shared/src/errors/proxy.ts, packages/shared/src/errors/AdapterError.ts

## Templates & registration pattern (where to start)

- Template adapters: packages/<module>/src/adapters/template — use these as the starting point for new adapters. Example wallet template:
  - Implementation: packages/wallet/src/adapters/template/wallet.ts
  - Registration example: packages/wallet/src/adapters/template/wallet.registration.ts

- Registration responsibilities (every .registration.ts MUST):
  1. Export a Joi schema for adapter options.
  2. Derive runtime requirements via getRequirements(schema, 'adapter-name').
  3. Derive environment via getEnvironments('adapter-name', [...RuntimeEnvironment]).
  4. Build an AdapterMetadata object with required fields:
     - name, version, module, adapterType, adapterClass, capabilities: Capability[], requirements, environment, errorMap? 
     - capabilities MUST use the shared Capability enum.
  5. Call registry.registerAdapter(moduleName, metadata).
  6. Obtain static compatibility matrix via getStaticCompatibilityMatrix(moduleName, adapterName, version) and call registry.registerCompatibilityMatrix(moduleName, matrix). This is mandatory.
  7. Keep registration idempotent and safe to import multiple times (no side effects beyond registration).

- Files you will typically import in a registration:
  - from '@m3s/shared': registry, AdapterMetadata type, getRequirements, getEnvironments, getStaticCompatibilityMatrix, RuntimeEnvironment, Capability
  - module adapter class and local WalletType / AdapterType enums from the module package
  - Joi for the schema

## Short registration snippet (minimal, copy‑paste)

This is the minimal valid pattern every .registration.ts must follow. It matches the template in packages/wallet/src/adapters/template/wallet.registration.ts.

```typescript
// filepath: packages/<module>/src/adapters/<adapter>/adapter.registration.ts
import Joi from 'joi';
import { registry, AdapterMetadata, getRequirements, getEnvironments, getStaticCompatibilityMatrix, RuntimeEnvironment, Capability } from '@m3s/shared';
import { MyAdapterClass } from './adapter.js';
import { MyAdapterType } from '../../types/index.js'; // module-specific enum

// 1) options schema (Joi)
export const adapterOptionsSchema = Joi.object({
  // example option definitions
  privateKey: Joi.string().optional().description('Optional private key'),
  provider: Joi.object({ rpcUrl: Joi.string().uri().required() }).optional()
});

// 2) runtime requirements derived from schema
const requirements = getRequirements(adapterOptionsSchema, 'my-adapter');

// 3) environment declaration
const environment = getEnvironments('my-adapter', [RuntimeEnvironment.SERVER, RuntimeEnvironment.BROWSER]);

// 4) AdapterMetadata
const metadata: AdapterMetadata = {
  name: 'my-adapter',
  version: '1.0.0',
  module:  Ms3Modules.wallet,              // module name
  adapterType: MyAdapterType.evm, // module-specific adapter type
  adapterClass: MyAdapterClass,
  capabilities: [                 // MUST use shared Capability enum values
    Capability.CoreWallet,
    Capability.TransactionHandler,
    Capability.AdapterLifecycle
  ],
  requirements,
  environment,
  // optional: errorMap: { 'rejected': WalletErrorCode.UserRejected }
};

// 5) register adapter
registry.registerAdapter( Ms3Modules.wallet,  metadata);

// 6) mandatory: publish static compatibility matrix if available
const matrix = getStaticCompatibilityMatrix( Ms3Modules.wallet,  'my-adapter', '1.0.0');
if (matrix) registry.registerCompatibilityMatrix( Ms3Modules.wallet,  matrix);

// 7) keep light debug logs (optional)
console.debug('Registered my-adapter', { name: metadata.name, version: metadata.version });
```

## Scripts & example commands

Run from repo root. Replace <package> with package folder (wallet, smart-contract, crosschain, shared) when needed.

- Install
  - npm install --legacy-peer-deps
- Build all packages
  - npm run build
- Clean
  - npm run clean
- Test (unit)
  - npm test
- Test a single package (example: wallet)
  - npm --workspace packages/wallet test
  - or from package folder:
    - cd packages\wallet
    - npm test
- Run only wallet tests (monorepo script)
  - npm run test:wallet
- Show available adapter versions (example using node script)
  - node -e "const { registry } = require('./packages/shared/dist'); console.log(registry.getAdapterVersions( Ms3Modules.wallet,'ethers'))"

Notes:
- Use semantic versioning for adapters (name@version keys). Registry helpers (getAdapterVersions / getLatestAdapter) expect semver-like strings.

## How to run tests with RUN_INTEGRATION flag

Integration tests are gated by RUN_INTEGRATION. Default CI runs only unit tests.

- Unix / macOS:
  - RUN_INTEGRATION=1 npm test
- Windows (cmd.exe / PowerShell):
  - set RUN_INTEGRATION=1 && npm test
  - or in PowerShell: $env:RUN_INTEGRATION=1; npm test

Typical pattern inside test files:
- (RUN_INTEGRATION ? describe : describe.skip)('integration suite', () => { ... })

Recommendation (optional):
- Export a central boolean (packages/shared/src/testUtils.ts) such as export const RUN_INTEGRATION = !!process.env.RUN_INTEGRATION to avoid per-file process.env lookups.

## Maintainers & authorized closers

- Maintainers:
  - AngelaHerrador — Lead maintainer (reviews adapters, approves compatibility matrices)
  - Gunner Andersen Gil — Core maintainer (registry, shared helpers, CI)

- Authorized closers:
  - AngelaHerrador
  - Gunner Andersen Gil

Process:
- All adapter or interface proposals must open an issue using the appropriate template (see .github/ISSUE_TEMPLATE).
- PRs must include the adapter registration file, unit tests, and updated package README usage snippet.
- Maintainers review and either merge, request changes, or close-as-not-planned with rationale. Closing as "not planned" must include migration notes.

## License
  - Apache-2.0 — see LICENSE in [here.](https://github.com/NGI-TRUSTCHAIN/MS3/blob/main/LICENSE)

## Issues
  - GitHub Issues: https://github.com/NGI-TRUSTCHAIN/MS3/issues

# Pull Request: [Module/Feature Name] - Brief Description of Change

**Please reference the issue this PR resolves using keywords (e.g., `Closes #123`).**

## 🎯 What does this PR do?

Please provide a high-level summary of the change.
- [ ] New feature / Adapter: What is it and what capability does it add?
- [ ] Bug fix: What was broken and how is it fixed?
- [ ] Refactoring/Improvement: Why was the code changed?

## ✅ Acceptance Checklist (MANDATORY for Reviewers)

This checklist ensures the PR meets the mandatory requirements outlined in `CONTRIBUTING.md`.

### Code & Architecture
- [ ] **Implementation:** Adapter class implements `IAdapterIdentity`, `IAdapterLifecycle`, and required module-specific interfaces (e.g., `IEVMWallet`).
- [ ] **Registration File:** The corresponding `.registration.ts` file is present, correctly exports the Joi schema, and is idempotent.
- [ ] **Capabilities:** `AdapterMetadata.capabilities` only uses the shared `Capability` enum values.
- [ ] **Requirements & Environment:** `getRequirements` and `getEnvironments` were used to populate metadata.

### Compatibility & Testing
- [ ] **Compatibility Matrix:** `getStaticCompatibilityMatrix` was called and the matrix was registered (or an explicit comment explains why there is no static matrix).
- [ ] **Unit Tests:** Unit tests have been added/updated and run successfully (`npm test`).
- [ ] **Integration Tests:** (If applicable) Integration tests are gated by `RUN_INTEGRATION`.
- [ ] **Build Check:** Types compile (`tsc`) and lint passes (ESLint).

### Documentation & Metadata
- [ ] **Issue Linked:** This PR links to an `adapter/` or `interface/` proposal issue.
- [ ] **README Updated:** The relevant package `README.md` includes a minimal usage snippet.
- [ ] **Changelog Entry:** A clear changelog entry is included in the PR body or the package's `CHANGELOG.md`.

## 🔗 Links for Reviewer Convenience

* [Link to new/changed Adapter file(s)]
* [Link to new/changed Registration file]
* [Link to new/changed Test file(s)]
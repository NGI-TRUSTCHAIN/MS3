# Contribution Guide for M3S

Thank you for your interest in contributing to the M3S ecosystem. This project follows a hybrid collaboration model: open on GitHub for community proposals and discussion, with internal validation on Azure DevOps to ensure production stability.

## General Requirements

- All contributions must start by opening an Issue using the **official templates**.
- Direct Pull Requests to the `/main` branch of the public repository are not allowed.
- Each proposal must focus on **a single contribution**: either an *adapter* or an *interface*.
- Only approved and published interfaces may be used.

## Collaboration Workflow

1. **Issue Creation**
   - Choose one of the available templates:
     - `Adapter Proposal`  
     - `Interface Proposal`
   - ⚠️ **IMPORTANT!** The title must begin with the corresponding prefix (`adapter/` or `interface/`).  
   - The issue will be automatically labeled as `In process`, and a linked branch will be generated.

2. **Development**
   - Work on the branch linked to the issue.
   - Once the contribution is ready, manually update the issue label to `Complete Issue`.

3. **Maintainer Review**
   - A member of the M3S team will review your contribution:
     - If **approved**, the label is changed to `Approved` and the issue is closed as `Closed`. This triggers a pipeline that creates a Pull Request in the private Azure DevOps repository.
     - If **rejected**, the label is changed to `Denied` and the issue is closed as `Closed as not planned`, with a comment explaining the reason. You may reopen the issue and resubmit your proposal.

4. **Internal Validation**
   - In Azure DevOps:
     - The full test suite is executed automatically.
     - If successful, the code is merged into the main branch.
     - Updates are manually synchronized with the public GitHub repository.

## Key Rules

- Simultaneous changes to multiple adapters or interfaces are not allowed.
- System evolution follows a **sequential**, **community-driven consensus** process.
- **Branch Protection Rules** have been applied to prevent unauthorized edits to critical files and maintain the integrity of the automation workflow.

## Branch and PR Naming

- Branches are automatically created when opening an issue.
- Do not rename the branch or open PRs outside the automated flow.
- PR names in Azure DevOps must follow the format:  
  `adapter/<name>` or `interface/<name>`, as appropriate.

## Automated Validations

- Every commit and every production release trigger a CI/CD pipeline that runs:
  - Code linting
  - Build verification
  - Functional tests
- Only contributions that pass all validations will be accepted.

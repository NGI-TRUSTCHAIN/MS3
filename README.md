# M3S Wallet Adapters

This repository allows contributors to submit wallet adapters for the M3S wallet system.

## How to Contribute

1. Fork this repository
2. Create a branch named `collaborate/adapter/<your-adapter-name>`
3. Implement your adapter following the guidelines in [CONTRIBUTING.md](./.github/CONTRIBUTING.md)
4. Submit a Pull Request to be reviewed

## Adapter Structure

Each adapter must include:

1. Main implementation file (`<adapterName>Wallet.ts`)
2. Registration file (`<adapterName>Wallet.registration.ts`)
3. Unit tests (`<adapterName>Wallet.spec.ts`)

## Testing Locally

Before submitting your PR, test your adapter locally:

```bash
npm install
npm run validate-adapter collaborate/adapter/<your-adapter-name>
````
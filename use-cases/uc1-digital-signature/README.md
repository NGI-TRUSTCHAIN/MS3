# Use Case 1 – Digital Signature with Wallet

This minimal environment demonstrates how to use the `@m3s/wallet` package with the `ethers` adapter to allow a user to digitally sign a message.

---

## 🎯 Test Objectives

Validate the installation, configuration, and basic integration of a wallet using `m3s`, and execute a digital signature from the frontend. In this use case:

1. We connect a wallet using the ethers adapter.
2. We request the signature of a message.
3. We display the generated signature in the console.

---

## 🛠️ Prerequisites

- Node.js >= 18
- `ts-node` installed globally:

```bash
npm install -g ts-node
```

---

## 📝 Instructions

- Install dependencies:
```bash
npm install
```
- Run the script:
```bash
npm run start
```
- Check the documentation to implement digital signature at https://changetheblock.com/projects/ms3

# Use Case 3 – Crosschain Payments with LiFi

This minimal environment demonstrates how to use the `@m3s/crosschain` package with the `LiFi` adapter to perform a token transfer across two EVM-compatible networks.

---

## 🎯 Test Objectives

Validate the installation, configuration, and crosschain payment process using `m3s`. In this use case:

1. We connect a wallet with tokens on a source network.
2. We configure and initiate a crosschain token swap.
3. We display the transaction hash in the console.

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

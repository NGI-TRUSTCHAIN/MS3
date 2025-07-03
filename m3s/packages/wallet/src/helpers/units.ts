import { AdapterError, WalletErrorCode } from "@m3s/common";
import { ethers } from "ethers";

export function toWei(
  value: string | number | bigint,
  decimals: number
): string {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  const s = String(value).trim();
  if (!s || s === '0') {
    return '0';
  }
  try {
    return ethers.parseUnits(s, decimals).toString();
  } catch (err: any) {
    throw new AdapterError(`Invalid value format: ${value}`, {
      methodName: 'toWei',
      code: WalletErrorCode.InvalidInput,
      cause: err
    });
  }
}

export function toBigInt(value: string|number|bigint): bigint {
  try {
    if (typeof value === "bigint") return value;
    if (typeof value === "number")  return BigInt(value);
    // allow hex or decimal strings
    return BigInt(value.trim());
  } catch (err: any) {
    throw new AdapterError(`Invalid BigInt value: ${value}`, {
      methodName: "toBigInt",
      code: WalletErrorCode.InvalidInput,
      cause: err
    });
  }
}
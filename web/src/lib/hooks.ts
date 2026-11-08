"use client";

import { useEffect, useRef, useState } from "react";
import { decodeAbiParameters, type Address } from "viem";
import { useReadContract, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { tokenAbi, vaultAbi } from "./abi";
import { USDC } from "./config";

/** Current unix time, ticking every second (for countdowns). */
export function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export type VaultRules = { dailyLimit: bigint; delay: number; curfewStart: number; curfewEnd: number };
export type QueuedWithdrawal = { id: number; to: Address; amount: bigint; unlockAt: number; status: number };
export type QueuedChange = { id: number; kind: number; readyAt: number; status: number; label: string };

const KIND = ["Change rules", "Remove guardian", "Change recovery address", "Change owner"];

function describeChange(kind: number, data: `0x${string}`) {
  try {
    if (kind === 0) {
      const [r] = decodeAbiParameters(
        [{ type: "tuple", components: [{ type: "uint128" }, { type: "uint32" }, { type: "uint16" }, { type: "uint16" }] }],
        data
      ) as unknown as [[bigint, number, number, number]];
      return `${KIND[0]}: $${Number(r[0]) / 1e6}/day, ${Number(r[1]) / 3600}h delay`;
    }
    const [a] = decodeAbiParameters([{ type: "address" }], data);
    return `${KIND[kind]}: ${a}`;
  } catch {
    return KIND[kind] ?? "Change";
  }
}

export function useVault(vault?: Address) {
  const base = { address: vault, abi: vaultAbi } as const;
  const enabled = Boolean(vault);
  const core = useReadContracts({
    contracts: [
      { ...base, functionName: "owner" },
      { ...base, functionName: "recovery" },
      { ...base, functionName: "rules" },
      { ...base, functionName: "guardians" },
      { ...base, functionName: "frozenUntil" },
      { ...base, functionName: "maxExtractableNow" },
      { ...base, functionName: "withdrawalCount" },
      { ...base, functionName: "changeCount" },
    ],
    query: { enabled, refetchInterval: 8000 },
  });
  const balance = useReadContract({
    address: USDC,
    abi: tokenAbi,
    functionName: "balanceOf",
    args: vault ? [vault] : undefined,
    query: { enabled: enabled && Boolean(USDC), refetchInterval: 8000 },
  });

  const d = core.data;
  const ok = d?.every((x) => x.status === "success");
  const wCount = ok ? Number(d![6].result) : 0;
  const cCount = ok ? Number(d![7].result) : 0;

  const ws = useReadContracts({
    contracts: Array.from({ length: wCount }, (_, i) => ({ ...base, functionName: "getWithdrawal" as const, args: [BigInt(i)] as const })),
    query: { enabled: wCount > 0, refetchInterval: 8000 },
  });
  const cs = useReadContracts({
    contracts: Array.from({ length: cCount }, (_, i) => ({ ...base, functionName: "getChange" as const, args: [BigInt(i)] as const })),
    query: { enabled: cCount > 0, refetchInterval: 8000 },
  });

  const refetch = () => {
    core.refetch();
    balance.refetch();
    ws.refetch();
    cs.refetch();
  };

  if (!ok) return { ready: false as const, loading: core.isLoading, error: core.error ?? (d && !ok ? new Error("Not a Mora vault") : null), refetch } as const;

  const r = d![2].result as readonly [bigint, number, number, number];
  const withdrawals: QueuedWithdrawal[] = (ws.data ?? []).flatMap((x, i) => {
    if (x.status !== "success") return [];
    const w = x.result as { to: Address; amount: bigint; unlockAt: bigint; status: number };
    return [{ id: i, to: w.to, amount: w.amount, unlockAt: Number(w.unlockAt), status: Number(w.status) }];
  });
  const changes: QueuedChange[] = (cs.data ?? []).flatMap((x, i) => {
    if (x.status !== "success") return [];
    const c = x.result as { kind: number; readyAt: bigint; status: number; data: `0x${string}` };
    return [{ id: i, kind: Number(c.kind), readyAt: Number(c.readyAt), status: Number(c.status), label: describeChange(Number(c.kind), c.data) }];
  });

  return {
    ready: true as const,
    loading: false,
    error: null,
    refetch,
    owner: d![0].result as Address,
    recovery: d![1].result as Address,
    rules: { dailyLimit: r[0], delay: Number(r[1]), curfewStart: Number(r[2]), curfewEnd: Number(r[3]) } as VaultRules,
    guardians: d![3].result as readonly Address[],
    frozenUntil: Number(d![4].result),
    maxExtractable: d![5].result as bigint,
    balance: (balance.data as bigint | undefined) ?? 0n,
    withdrawals,
    changes,
  };
}

/** Send a transaction and wait for it; calls onDone after it is mined. */
export function useTx(onDone?: () => void) {
  const { writeContractAsync, data: hash, isPending, error, reset } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash });
  const handled = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (receipt.isSuccess && hash && handled.current !== hash) {
      handled.current = hash;
      onDone?.();
    }
  }, [receipt.isSuccess, hash, onDone]);
  return {
    send: writeContractAsync,
    hash,
    busy: isPending || (Boolean(hash) && receipt.isLoading),
    error: (error ?? receipt.error) as Error | null,
    reset,
  };
}

/** Status enum in the contract: 0 None, 1 Pending, 2 Executed, 3 Cancelled. */
export const PENDING = 1;

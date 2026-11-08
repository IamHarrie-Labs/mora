"use client";

import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { useState } from "react";
import { chain } from "@/lib/config";
import { short } from "@/lib/format";

export function ConnectButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [open, setOpen] = useState(false);

  if (isConnected && chainId !== chain.id) {
    return <button className="btn btn-bad" onClick={() => switchChain({ chainId: chain.id })}>Switch to Base Sepolia</button>;
  }
  if (isConnected) {
    return (
      <button className="btn btn-ghost font-mono" onClick={() => disconnect()} title="Disconnect">
        {short(address)}
      </button>
    );
  }
  return (
    <div className="relative">
      <button className="btn btn-moon" onClick={() => setOpen((o) => !o)} disabled={isPending}>
        {isPending ? "Connecting…" : "Connect"}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-60 card p-2 z-20 shadow-xl">
          {connectors.map((c) => (
            <button
              key={c.uid}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-2 text-sm"
              onClick={() => {
                setOpen(false);
                connect({ connector: c, chainId: chain.id });
              }}
            >
              {c.name === "Injected" ? "Browser wallet" : c.name}
              {c.id === "baseAccount" && <span className="block text-xs text-muted">Face ID / passkey, no extension</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

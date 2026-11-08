import Link from "next/link";

export function NotDeployed() {
  return (
    <div className="card p-6 space-y-3 max-w-2xl">
      <h2 className="text-xl font-semibold">Contracts not connected yet</h2>
      <p className="text-muted text-sm">
        This copy of Mora has no contract addresses configured. Deploy with <code>scripts/deploy.js</code>, then set{" "}
        <code>NEXT_PUBLIC_FACTORY_ADDRESS</code> and <code>NEXT_PUBLIC_USDC_ADDRESS</code>.
      </p>
      <Link href="/demo" className="btn btn-moon">Try the no-wallet demo instead</Link>
    </div>
  );
}

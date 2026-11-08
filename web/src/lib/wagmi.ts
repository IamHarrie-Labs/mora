import { createConfig, http } from "wagmi";
import { baseAccount, injected } from "wagmi/connectors";
import { chain } from "./config";

export const wagmiConfig = createConfig({
  chains: [chain],
  connectors: [baseAccount({ appName: "Mora" }), injected()],
  transports: { [chain.id]: http(process.env.NEXT_PUBLIC_RPC_URL || undefined) },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}

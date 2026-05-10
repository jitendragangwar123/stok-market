import { http } from "wagmi";
import { base, baseSepolia, foundry, mainnet, sepolia } from "wagmi/chains";
import { createConfig } from "@privy-io/wagmi";
import { CHAIN_ID, RPC_URL } from "./contracts";

const activeChain =
  CHAIN_ID === base.id
    ? base
    : CHAIN_ID === baseSepolia.id
      ? baseSepolia
      : CHAIN_ID === mainnet.id
        ? mainnet
        : CHAIN_ID === sepolia.id
          ? sepolia
          : foundry;

export const wagmiConfig = createConfig({
  chains: [foundry, baseSepolia, base, sepolia, mainnet],
  transports: {
    [foundry.id]: foundry.id === activeChain.id ? http(RPC_URL) : http(),
    [baseSepolia.id]: baseSepolia.id === activeChain.id ? http(RPC_URL) : http(),
    [base.id]: base.id === activeChain.id ? http(RPC_URL) : http(),
    [sepolia.id]: sepolia.id === activeChain.id ? http(RPC_URL) : http(),
    [mainnet.id]: mainnet.id === activeChain.id ? http(RPC_URL) : http(),
  },
});

export { activeChain };

import { QueryClient } from '@tanstack/react-query'
import { defineChain } from 'viem'
import { createConfig, http, injected } from 'wagmi'
import { walletConnect } from 'wagmi/connectors'

export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.arc.network'],
    },
  },
  blockExplorers: {
    default: {
      name: 'ArcScan',
      url: 'https://testnet.arcscan.app',
    },
  },
  testnet: true,
})

export const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim() ?? ''
export const hasWalletConnectProjectId = walletConnectProjectId.length > 0

const connectors = hasWalletConnectProjectId
  ? [
      injected({
        shimDisconnect: true,
      }),
      walletConnect({
        projectId: walletConnectProjectId,
        showQrModal: true,
        metadata: {
          name: 'PegPulse',
          description: 'Stablecoin de-peg monitoring and onchain hedge execution.',
          url: 'https://pegpulse.app',
          icons: [],
        },
      }),
    ]
  : [
      injected({
        shimDisconnect: true,
      }),
    ]

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors,
  transports: {
    [arcTestnet.id]: http(arcTestnet.rpcUrls.default.http[0]),
  },
})

export const queryClient = new QueryClient()

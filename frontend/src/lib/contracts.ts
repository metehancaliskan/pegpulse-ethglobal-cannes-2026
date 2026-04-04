import {
  createPublicClient,
  formatEther,
  http,
  parseAbi,
  parseEther,
  type Address,
  type WalletClient,
} from 'viem'
import { writeContract } from 'viem/actions'
import { arcTestnet } from './wallet'

export const ARC_NETWORK = {
  chainId: arcTestnet.id,
  chainIdHex: '0x4cef52',
  chainName: arcTestnet.name,
  rpcUrl: arcTestnet.rpcUrls.default.http[0],
  blockExplorerUrl: arcTestnet.blockExplorers.default.url,
  nativeCurrency: arcTestnet.nativeCurrency,
} as const

export const FACTORY_ADDRESS = '0x2028b0EBFB6B60904285a83CcffE4e7e77664e18' as Address

export const FACTORY_ABI = parseAbi([
  'function owner() view returns (address)',
  'function getMarkets() view returns (address[])',
  'function createMarket(string _description)',
])

export const MARKET_ABI = parseAbi([
  'function description() view returns (string)',
  'function oracle() view returns (address)',
  'function isSettled() view returns (bool)',
  'function marketOutcome() view returns (uint8)',
  'function totalWinBets() view returns (uint256)',
  'function totalLoseBets() view returns (uint256)',
  'function winBets(address) view returns (uint256)',
  'function loseBets(address) view returns (uint256)',
  'function betWin() payable',
  'function betLose() payable',
  'function settleMarket(uint8 _outcome)',
  'function withdrawWinnings()',
])

export type MarketOutcome = 0 | 1 | 2 | 3

export type MarketView = {
  address: string
  description: string
  oracle: string
  isSettled: boolean
  outcome: MarketOutcome
  totalWinBets: bigint
  totalLoseBets: bigint
  userWinBet: bigint
  userLoseBet: bigint
}

type DashboardData = {
  owner: string
  markets: MarketView[]
}

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(ARC_NETWORK.rpcUrl),
})

export async function fetchDashboardData(userAddress?: string): Promise<DashboardData> {
  const [owner, marketAddresses] = await Promise.all([
    publicClient.readContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: 'owner',
    }),
    publicClient.readContract({
      address: FACTORY_ADDRESS,
      abi: FACTORY_ABI,
      functionName: 'getMarkets',
    }),
  ])

  const markets = await Promise.all(
    marketAddresses.map(async (address) => {
      const [description, oracle, isSettled, outcome, totalWinBets, totalLoseBets, userWinBet, userLoseBet] =
        await Promise.all([
          publicClient.readContract({
            address,
            abi: MARKET_ABI,
            functionName: 'description',
          }),
          publicClient.readContract({
            address,
            abi: MARKET_ABI,
            functionName: 'oracle',
          }),
          publicClient.readContract({
            address,
            abi: MARKET_ABI,
            functionName: 'isSettled',
          }),
          publicClient.readContract({
            address,
            abi: MARKET_ABI,
            functionName: 'marketOutcome',
          }),
          publicClient.readContract({
            address,
            abi: MARKET_ABI,
            functionName: 'totalWinBets',
          }),
          publicClient.readContract({
            address,
            abi: MARKET_ABI,
            functionName: 'totalLoseBets',
          }),
          userAddress
            ? publicClient.readContract({
                address,
                abi: MARKET_ABI,
                functionName: 'winBets',
                args: [userAddress as Address],
              })
            : Promise.resolve(0n),
          userAddress
            ? publicClient.readContract({
                address,
                abi: MARKET_ABI,
                functionName: 'loseBets',
                args: [userAddress as Address],
              })
            : Promise.resolve(0n),
        ])

      return {
        address,
        description,
        oracle,
        isSettled,
        outcome: outcome as MarketOutcome,
        totalWinBets,
        totalLoseBets,
        userWinBet,
        userLoseBet,
      }
    }),
  )

  return { owner, markets: [...markets].reverse() }
}

function getWalletAccount(walletClient: WalletClient) {
  const account = walletClient.account

  if (!account) {
    throw new Error('No connected wallet account found.')
  }

  return account
}

export async function createMarket(walletClient: WalletClient, description: string) {
  const hash = await writeContract(walletClient, {
    chain: arcTestnet,
    account: getWalletAccount(walletClient),
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: 'createMarket',
    args: [description],
  })

  await publicClient.waitForTransactionReceipt({ hash })
}

export async function placeBet(
  walletClient: WalletClient,
  marketAddress: string,
  side: 'win' | 'lose',
  amount: string,
) {
  const hash = await writeContract(walletClient, {
    chain: arcTestnet,
    account: getWalletAccount(walletClient),
    address: marketAddress as Address,
    abi: MARKET_ABI,
    functionName: side === 'win' ? 'betWin' : 'betLose',
    value: parseEther(amount),
  })

  await publicClient.waitForTransactionReceipt({ hash })
}

export async function settleMarket(
  walletClient: WalletClient,
  marketAddress: string,
  outcome: Exclude<MarketOutcome, 0>,
) {
  const hash = await writeContract(walletClient, {
    chain: arcTestnet,
    account: getWalletAccount(walletClient),
    address: marketAddress as Address,
    abi: MARKET_ABI,
    functionName: 'settleMarket',
    args: [outcome],
  })

  await publicClient.waitForTransactionReceipt({ hash })
}

export async function withdrawWinnings(walletClient: WalletClient, marketAddress: string) {
  const hash = await writeContract(walletClient, {
    chain: arcTestnet,
    account: getWalletAccount(walletClient),
    address: marketAddress as Address,
    abi: MARKET_ABI,
    functionName: 'withdrawWinnings',
  })

  await publicClient.waitForTransactionReceipt({ hash })
}

export function formatAmount(value: bigint) {
  const formatted = Number(formatEther(value))

  if (formatted === 0) {
    return '0.00'
  }

  if (formatted < 0.01) {
    return '<0.01'
  }

  return formatted.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  })
}

export function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function outcomeLabel(outcome: MarketOutcome) {
  if (outcome === 1) return 'Yes'
  if (outcome === 2) return 'No'
  if (outcome === 3) return 'Invalid'
  return 'Live'
}

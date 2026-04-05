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
import snapshot from './market-snapshot.json'

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
  'function exitOpenStake(bool onWinSide, uint256 amount)',
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

export const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(ARC_NETWORK.rpcUrl),
})

type SnapshotMarket = { address: string; description: string; oracle: string }
const staticMarkets: SnapshotMarket[] = (snapshot as { owner: string; markets: SnapshotMarket[] }).markets
const staticOwner: string = (snapshot as { owner: string }).owner

function buildStaticViews(): MarketView[] {
  return [...staticMarkets].reverse().map((sm) => ({
    address: sm.address,
    description: sm.description,
    oracle: sm.oracle,
    isSettled: false,
    outcome: 0 as MarketOutcome,
    totalWinBets: 0n,
    totalLoseBets: 0n,
    userWinBet: 0n,
    userLoseBet: 0n,
  }))
}

export async function fetchSingleMarketDynamic(
  marketAddress: string,
  userAddress?: string,
): Promise<Partial<MarketView>> {
  const addr = marketAddress as Address
  try {
    const calls = [
      publicClient.readContract({ address: addr, abi: MARKET_ABI, functionName: 'isSettled' }),
      publicClient.readContract({ address: addr, abi: MARKET_ABI, functionName: 'marketOutcome' }),
      publicClient.readContract({ address: addr, abi: MARKET_ABI, functionName: 'totalWinBets' }),
      publicClient.readContract({ address: addr, abi: MARKET_ABI, functionName: 'totalLoseBets' }),
    ] as const

    const userCalls = userAddress
      ? [
          publicClient.readContract({ address: addr, abi: MARKET_ABI, functionName: 'winBets', args: [userAddress as Address] }),
          publicClient.readContract({ address: addr, abi: MARKET_ABI, functionName: 'loseBets', args: [userAddress as Address] }),
        ] as const
      : []

    const results = await Promise.all([...calls, ...userCalls])

    return {
      isSettled: results[0] as boolean,
      outcome: (results[1] as number) as MarketOutcome,
      totalWinBets: results[2] as bigint,
      totalLoseBets: results[3] as bigint,
      userWinBet: userAddress ? (results[4] as bigint) : 0n,
      userLoseBet: userAddress ? (results[5] as bigint) : 0n,
    }
  } catch {
    return {}
  }
}

/** Parallel batches of eth_call — Arc RPC often lacks working aggregate3 multicall; detail page uses the same reads. */
const ENRICH_BATCH_SIZE = 6

async function enrichMarketsFromChain(markets: MarketView[], userAddress?: string): Promise<MarketView[]> {
  if (markets.length === 0) return markets

  const out: MarketView[] = []

  for (let i = 0; i < markets.length; i += ENRICH_BATCH_SIZE) {
    const batch = markets.slice(i, i + ENRICH_BATCH_SIZE)
    const dynamics = await Promise.all(
      batch.map((m) => fetchSingleMarketDynamic(m.address, userAddress)),
    )

    for (let j = 0; j < batch.length; j++) {
      const m = batch[j]
      const dyn = dynamics[j]
      const hasPools = dyn.totalWinBets !== undefined && dyn.totalLoseBets !== undefined
      if (!hasPools) {
        out.push(m)
        continue
      }
      out.push({
        ...m,
        isSettled: dyn.isSettled ?? m.isSettled,
        outcome: (dyn.outcome ?? m.outcome) as MarketOutcome,
        totalWinBets: dyn.totalWinBets!,
        totalLoseBets: dyn.totalLoseBets!,
        userWinBet: dyn.userWinBet ?? 0n,
        userLoseBet: dyn.userLoseBet ?? 0n,
      })
    }
  }

  return out
}

export async function fetchDashboardData(userAddress?: string): Promise<DashboardData> {
  const base = buildStaticViews()
  const markets = await enrichMarketsFromChain(base, userAddress)
  return { owner: staticOwner, markets }
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

/** Return stake from an open market (partial or full). Requires deployed contract with exitOpenStake. */
export async function exitOpenStake(
  walletClient: WalletClient,
  marketAddress: string,
  onWinSide: boolean,
  amountEther: string,
) {
  const value = parseEther(amountEther)
  if (value <= 0n) throw new Error('Amount must be greater than zero.')
  const hash = await writeContract(walletClient, {
    chain: arcTestnet,
    account: getWalletAccount(walletClient),
    address: marketAddress as Address,
    abi: MARKET_ABI,
    functionName: 'exitOpenStake',
    args: [onWinSide, value],
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

import { parseAbiItem, type Address, type PublicClient } from 'viem'

/** On-chain event name is fixed by the contract ABI. */
const marketFundingEvent = parseAbiItem(
  'event BetPlaced(address indexed bettor, uint256 amount, bool indexed betOnWin)',
)

export type SideStakeTotals = { yesGross: bigint; noGross: bigint }

export async function fetchUserSideStakeTotals(
  client: PublicClient,
  marketAddress: Address,
  wallet: Address,
): Promise<SideStakeTotals> {
  try {
    const logs = await client.getLogs({
      address: marketAddress,
      event: marketFundingEvent,
      args: { bettor: wallet },
      fromBlock: 0n,
      toBlock: 'latest',
    })
    let yesGross = 0n
    let noGross = 0n
    for (const log of logs) {
      const amount = log.args.amount ?? 0n
      const onYesSide = log.args.betOnWin ?? false
      if (onYesSide) yesGross += amount
      else noGross += amount
    }
    return { yesGross, noGross }
  } catch {
    return { yesGross: 0n, noGross: 0n }
  }
}

export function settledResultLabel(
  outcome: number,
  yesGross: bigint,
  noGross: bigint,
): string {
  if (yesGross === 0n && noGross === 0n) return '—'
  if (outcome === 3) return 'Refunded'
  if (outcome === 1) {
    if (yesGross > 0n && noGross === 0n) return 'Won · Yes'
    if (noGross > 0n && yesGross === 0n) return 'Lost'
    if (yesGross > 0n && noGross > 0n) return 'Mixed · Yes won'
  }
  if (outcome === 2) {
    if (noGross > 0n && yesGross === 0n) return 'Won · No'
    if (yesGross > 0n && noGross === 0n) return 'Lost'
    if (yesGross > 0n && noGross > 0n) return 'Mixed · No won'
  }
  return '—'
}

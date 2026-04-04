# PegPulse Hardhat Project

This project uses Hardhat for compiling, testing, and deploying contracts.

## Arc Testnet

Use the following chain details when adding the network to MetaMask:

| Field | Value |
| --- | --- |
| Network name | Arc Testnet |
| New RPC URL | https://rpc.testnet.arc.network |
| Chain ID | 5042002 |
| Currency symbol | USDC |
| Explorer URL | https://testnet.arcscan.app |

The Hardhat network config is also set to `arcTestnet` with the same RPC URL and chain ID.

## Environment Variables

Create a `.env` file before deploying:

```shell
PRIVATE_KEY=your_private_key_here
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
```

## Useful Commands

```shell
npx hardhat compile
npx hardhat test
npx hardhat ignition deploy ./ignition/modules/PredictionMarketFactory.ts --network arcTestnet
```

## Contract Flow

- `PredictionMarketFactory` is owned by the deployer.
- Only the owner can create new markets.
- Every created market uses the factory owner as its oracle.
- Anyone can place bets on active markets and withdraw after settlement.

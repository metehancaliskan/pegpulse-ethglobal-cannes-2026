import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("PredictionMarketFactory", function () {
  async function deployFixture() {
    const [owner, bettorOne, bettorTwo] = await hre.ethers.getSigners();

    const Factory = await hre.ethers.getContractFactory("PredictionMarketFactory");
    const factory = await Factory.deploy();

    return { factory, owner, bettorOne, bettorTwo };
  }

  it("allows only the owner to create markets", async function () {
    const { factory, owner, bettorOne } = await loadFixture(deployFixture);

    await expect(factory.connect(bettorOne).createMarket("USDC depeg market"))
      .to.be.revertedWith("Only owner can call this function");

    await expect(factory.connect(owner).createMarket("USDC depeg market"))
      .to.emit(factory, "MarketCreated");

    expect(await factory.owner()).to.equal(owner.address);
    expect(await factory.markets(0)).to.properAddress;
  });

  it("creates markets with the owner as oracle", async function () {
    const { factory, owner } = await loadFixture(deployFixture);
    const description = "Will USDC depeg below $0.99 before Friday?";

    await factory.createMarket(description);

    const marketAddress = await factory.markets(0);
    const market = await hre.ethers.getContractAt("PredictionMarket", marketAddress);

    expect(await market.description()).to.equal(description);
    expect(await market.oracle()).to.equal(owner.address);
    expect(await market.isSettled()).to.equal(false);
  });

  it("lets anyone place bets on an active market", async function () {
    const { factory, bettorOne, bettorTwo } = await loadFixture(deployFixture);

    await factory.createMarket("Will USDT depeg this week?");

    const marketAddress = await factory.markets(0);
    const market = await hre.ethers.getContractAt("PredictionMarket", marketAddress);

    await expect(
      market.connect(bettorOne).betWin({ value: hre.ethers.parseEther("1") })
    ).to.emit(market, "BetPlaced");

    await expect(
      market.connect(bettorTwo).betLose({ value: hre.ethers.parseEther("2") })
    ).to.emit(market, "BetPlaced");

    expect(await market.totalWinBets()).to.equal(hre.ethers.parseEther("0.999"));
    expect(await market.totalLoseBets()).to.equal(hre.ethers.parseEther("1.998"));
  });

  it("lets only the owner settle a created market", async function () {
    const { factory, owner, bettorOne } = await loadFixture(deployFixture);

    await factory.createMarket("Will DAI depeg?");

    const marketAddress = await factory.markets(0);
    const market = await hre.ethers.getContractAt("PredictionMarket", marketAddress);

    await expect(market.connect(bettorOne).settleMarket(1))
      .to.be.revertedWith("Only oracle can settle market");

    await expect(market.connect(owner).settleMarket(1))
      .to.emit(market, "MarketSettled");

    expect(await market.marketOutcome()).to.equal(1);
    expect(await market.isSettled()).to.equal(true);
  });

  it("allows a winning bettor to withdraw after owner settlement", async function () {
    const { factory, owner, bettorOne, bettorTwo } = await loadFixture(deployFixture);

    await factory.createMarket("Will USDC depeg over the weekend?");

    const marketAddress = await factory.markets(0);
    const market = await hre.ethers.getContractAt("PredictionMarket", marketAddress);

    await market.connect(bettorOne).betWin({ value: hre.ethers.parseEther("1") });
    await market.connect(bettorTwo).betLose({ value: hre.ethers.parseEther("1") });
    await market.connect(owner).settleMarket(1);

    await expect(() => market.connect(bettorOne).withdrawWinnings()).to.changeEtherBalances(
      [bettorOne, market],
      [hre.ethers.parseEther("1.998"), -hre.ethers.parseEther("1.998")]
    );
  });
});

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const PredictionMarketFactoryModule = buildModule(
  "PredictionMarketFactoryModule",
  (m) => {
    const factory = m.contract("PredictionMarketFactory");

    return { factory };
  }
);

export default PredictionMarketFactoryModule;

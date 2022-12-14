import "@nomicfoundation/hardhat-toolbox";

import "solidity-coverage";
import { AddressOne } from "@gnosis.pm/safe-contracts";
import dotenv from "dotenv";
import { HttpNetworkUserConfig, HardhatUserConfig } from "hardhat/types";
import "@cardstack/upgrade-manager";

// Load environment variables.
dotenv.config();
const { INFURA_KEY, MNEMONIC, ETHERSCAN_API_KEY, PK } = process.env;

const DEFAULT_MNEMONIC =
  "test test test test test test test test test test test junk";

const sharedNetworkConfig: HttpNetworkUserConfig = {};
if (PK) {
  sharedNetworkConfig.accounts = [PK];
} else {
  sharedNetworkConfig.accounts = {
    mnemonic: MNEMONIC || DEFAULT_MNEMONIC,
  };
}

const config: HardhatUserConfig = {
  paths: {
    artifacts: "artifacts",
    cache: "cache",
    sources: "contracts",
  },
  solidity: {
    compilers: [{ version: "0.8.9" }],
  },
  upgradeManager: {
    contracts: [
      "Config",
      "Exchange",
      {
        id: "ScheduledPaymentModule",
        abstract: true,
        deterministic: true,
        constructorArgs: [
          AddressOne,
          AddressOne,
          [AddressOne],
          AddressOne,
          AddressOne,
          AddressOne,
        ],
      },
    ],
  },
  networks: {
    mainnet: {
      ...sharedNetworkConfig,
      url: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
    },
    rinkeby: {
      ...sharedNetworkConfig,
      url: `https://rinkeby.infura.io/v3/${INFURA_KEY}`,
    },
    kovan: {
      ...sharedNetworkConfig,
      url: `https://kovan.infura.io/v3/${INFURA_KEY}`,
    },
    goerli: {
      ...sharedNetworkConfig,
      url: `https://goerli.infura.io/v3/${INFURA_KEY}`,
      chainId: 5,
    },
    xdai: {
      ...sharedNetworkConfig,
      url: "https://rpc.gnosischain.com",
    },
    sokol: {
      ...sharedNetworkConfig,
      url: "https://sokol.poa.network",
    },
    matic: {
      ...sharedNetworkConfig,
      url: "https://polygon-rpc.com",
    },
  },
  mocha: {
    timeout: 2000000,
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },
};

export default config;

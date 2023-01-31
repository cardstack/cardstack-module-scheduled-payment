import { ConfigFunction } from "@cardstack/upgrade-manager/dist/src/types";

const configValues = {
  goerli: {
    crankAddress: "0x0CE00362735A9c00dcF5B345Af78b5aab136ef79",
    feeReceiver: "0x307E0433369776eF3B381Fd990353a7da8DfD138",
    validForDays: 3,
  },
  mainnet: {
    crankAddress: "0xA667C141aB169b3BC0476Bc1225BF609f4A7eb38",
    feeReceiver: "0x3Fc163F9Ca47408EF3915590b0c82509e44b050B",
    validForDays: 3,
  },
  matic: {
    crankAddress: "0xA667C141aB169b3BC0476Bc1225BF609f4A7eb38",
    feeReceiver: "0x571D0d89324A7dE8a2f0D994808e191943B6E320",
    validForDays: 3,
  },
};

const config: ConfigFunction = async function ({
  deployConfig: { sourceNetwork },
}) {
  const networkValues = configValues[sourceNetwork];

  // Contract setUp function:
  //
  // function setUp(
  //     address _crankAddress,
  //     address _feeReceiver,
  //     uint8 _validForDays
  // ) external onlyOwner {

  return {
    setUp: [
      { getter: "crankAddress", value: networkValues.crankAddress },
      { getter: "feeReceiver", value: networkValues.feeReceiver },
      {
        getter: "validForDays",
        value: networkValues.validForDays,
      },
    ],
  };
};

export default config;

import { ConfigFunction } from "@cardstack/upgrade-manager/dist/src/types";

const configValues = {
  goerli: {
    crankAddress: "CRANK_ADDRESS_HERE",
    feeReceiver: "FEE_RECEIVER_HERE",
    validForDays: 3,
  },
  mainnet: {
    crankAddress: "CRANK_ADDRESS_HERE",
    feeReceiver: "FEE_RECEIVER_HERE",
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

import { ConfigFunction } from "@cardstack/upgrade-manager/dist/src/types";

const configValues = {
  goerli: {
    factory: "FACTORY_ADDRESS_HERE",
    fee: 123,
    usdToken: "USD_TOKEN_HERE",
    secondsAgo: 123,
  },
  mainnet: {
    factory: "FACTORY_ADDRESS_HERE",
    fee: 123,
    usdToken: "USD_TOKEN_HERE",
    secondsAgo: 123,
  },
};

const config: ConfigFunction = async function ({
  deployConfig: { sourceNetwork },
}) {
  const networkValues = configValues[sourceNetwork];

  // Contract setUp function:
  //
  // function setUp(
  //     address _factory,
  //     uint24 _fee,
  //     address _usdToken,
  //     uint32 _secondsAgo
  // ) external onlyOwner {

  return {
    setUp: [
      { getter: "factory", value: networkValues.factory },
      { getter: "fee", value: networkValues.fee },
      {
        getter: "usdToken",
        value: networkValues.usdToken,
      },
      {
        getter: "secondsAgo",
        value: networkValues.secondsAgo,
      },
    ],
  };
};

export default config;

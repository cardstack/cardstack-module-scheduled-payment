import { ConfigFunction } from "@cardstack/upgrade-manager/dist/src/types";

const configValues = {
  goerli: {
    factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    fee: 3000,
    usdToken: "0xB0b4eD7E54641f96C134D27921764711Cb303e96",
    secondsAgo: 86400,
  },
  mainnet: {
    factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    fee: 3000,
    usdToken: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    secondsAgo: 86400,
  },
  matic: {
    factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    fee: 3000,
    usdToken: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    secondsAgo: 86400,
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

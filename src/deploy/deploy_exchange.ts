import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, ethers, upgrades } = hre;
  const { deployer } = await getNamedAccounts();

  const Exchange = await ethers.getContractFactory("Exchange");
  const exchange = await upgrades.deployProxy(Exchange, [deployer]);
  await exchange.deployed();

  console.log(`Exchange contract deployed to: ${exchange.address}`);
};

deploy.tags = ["exchange-contract"];
export default deploy;

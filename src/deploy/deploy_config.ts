import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, ethers, upgrades } = hre;
  const { deployer } = await getNamedAccounts();

  const Config = await ethers.getContractFactory("Config");
  const config = await upgrades.deployProxy(Config, [deployer]);
  await config.deployed();
  console.log(`Config contract deployed to: ${config.address}`);
};

deploy.tags = ["config-contract"];
export default deploy;

import { expect } from "chai";
import hre, { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";

describe("Config", async () => {
  const [user1, user2, user3] = waffle.provider.getWallets();
  const crankAddress = user2.address;
  const feeReceiver = user3.address;
  const validForDays = 3;

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture();
    const Config = await hre.ethers.getContractFactory("Config");
    const config = await Config.deploy();
    await config.initialize(user1.address);

    return {
      config,
    };
  });

  describe("setUp", () => {
    it("throws if not called by the owner", async () => {
      const { config } = await setupTests();
      await expect(
        config.connect(user2).setUp(crankAddress, feeReceiver, validForDays)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should set crankAddress and feeReceiver", async () => {
      const { config } = await setupTests();
      await expect(config.setUp(crankAddress, feeReceiver, validForDays))
        .to.emit(config, "ConfigSetup")
        .withArgs(crankAddress, feeReceiver);

      expect(await config.crankAddress()).to.be.eq(crankAddress);
      expect(await config.feeReceiver()).to.be.eq(feeReceiver);
      expect(await config.validForDays()).to.be.eq(validForDays);
    });
  });
});

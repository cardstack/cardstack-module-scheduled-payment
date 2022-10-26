import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";

import "@nomiclabs/hardhat-ethers";
import { Config } from "../typechain-types";

describe("Config", async () => {
  const validForDays = 3;

  async function setupFixture() {
    const [user1, user2, user3] = await hre.ethers.getSigners();
    const crankAddress = user2.address;
    const feeReceiver = user3.address;

    const Config = await hre.ethers.getContractFactory("Config");
    const config = await Config.deploy();
    await config.initialize(user1.address);

    return { config, crankAddress, feeReceiver };
  }

  describe("setUp", () => {
    let config: Config, crankAddress: string, feeReceiver: string;

    beforeEach(async function () {
      ({ config, crankAddress, feeReceiver } = await loadFixture(setupFixture));
    });

    it("throws if not called by the owner", async () => {
      await expect(
        config
          .connect(crankAddress)
          .setUp(crankAddress, feeReceiver, validForDays)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should set crankAddress and feeReceiver", async () => {
      await expect(config.setUp(crankAddress, feeReceiver, validForDays))
        .to.emit(config, "ConfigSetup")
        .withArgs(crankAddress, feeReceiver);

      expect(await config.crankAddress()).to.be.eq(crankAddress);
      expect(await config.feeReceiver()).to.be.eq(feeReceiver);
      expect(await config.validForDays()).to.be.eq(validForDays);
    });
  });
});

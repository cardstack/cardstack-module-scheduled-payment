import assert from "assert";

import { AddressZero } from "@ethersproject/constants";
import { AddressOne } from "@gnosis.pm/safe-contracts";
import { expect } from "chai";
import hre, { deployments, waffle, ethers } from "hardhat";

import "@nomiclabs/hardhat-ethers";

describe("ScheduledPayment", async () => {
  const [user1, user2] = waffle.provider.getWallets();
  const abiCoder = new ethers.utils.AbiCoder();

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture();
    const avatarFactory = await hre.ethers.getContractFactory("TestAvatar");
    const avatar = await avatarFactory.deploy();
    const ScheduledPayment = await hre.ethers.getContractFactory(
      "ScheduledPayment"
    );
    const scheduledPayment = await ScheduledPayment.deploy(
      user1.address,
      avatar.address,
      avatar.address,
      AddressOne
    );
    const enableModule = await avatar.populateTransaction.enableModule(
      scheduledPayment.address
    );
    await expect(
      avatar.execTransactionFromModule(avatar.address, 0, enableModule.data, 0)
    );
    const tx = {
      to: avatar.address,
      value: 0,
      data: "0x",
      operation: 0,
      avatarTxGas: 0,
      baseGas: 0,
      gasPrice: 0,
      gasToken: AddressZero,
      refundReceiver: AddressZero,
      signatures: "0x",
    };

    return {
      avatar,
      scheduledPayment,
      tx,
    };
  });

  describe("setUp()", async () => {
    it("throws if guard has already been initialized", async () => {
      const { avatar, scheduledPayment } = await setupTests();
      const initializeParams = abiCoder.encode(
        ["address", "address", "address", "address"],
        [user1.address, avatar.address, avatar.address, AddressOne]
      );
      await expect(scheduledPayment.setUp(initializeParams)).to.be.revertedWith(
        "Initializable: contract is already initialized"
      );
    });

    it("throws if owner is zero address", async () => {
      const avatarFactory = await hre.ethers.getContractFactory("TestAvatar");
      const avatar = await avatarFactory.deploy();
      const ScheduledPayment = await hre.ethers.getContractFactory(
        "ScheduledPayment"
      );
      await expect(
        ScheduledPayment.deploy(
          AddressZero,
          avatar.address,
          avatar.address,
          AddressZero
        )
      ).to.be.revertedWith("Ownable: new owner is the zero address");
    });

    it("throws if avatar is zero address", async () => {
      const avatarFactory = await hre.ethers.getContractFactory("TestAvatar");
      const avatar = await avatarFactory.deploy();
      const ScheduledPayment = await hre.ethers.getContractFactory(
        "ScheduledPayment"
      );
      await expect(
        ScheduledPayment.deploy(
          user1.address,
          AddressZero,
          avatar.address,
          AddressZero
        )
      ).to.be.revertedWith("Avatar can not be zero address");
    });

    it("throws if target is zero address", async () => {
      const avatarFactory = await hre.ethers.getContractFactory("TestAvatar");
      const avatar = await avatarFactory.deploy();
      const ScheduledPayment = await hre.ethers.getContractFactory(
        "ScheduledPayment"
      );
      await expect(
        ScheduledPayment.deploy(
          user1.address,
          avatar.address,
          AddressZero,
          AddressZero
        )
      ).to.be.revertedWith("Target can not be zero address");
    });

    it("should emit event because of successful set up", async () => {
      const avatarFactory = await hre.ethers.getContractFactory("TestAvatar");
      const avatar = await avatarFactory.deploy();
      const ScheduledPayment = await hre.ethers.getContractFactory(
        "ScheduledPayment"
      );
      const scheduledPayment = await ScheduledPayment.deploy(
        user1.address,
        avatar.address,
        avatar.address,
        AddressZero
      );
      await scheduledPayment.deployed();

      await expect(scheduledPayment.deployTransaction)
        .to.emit(scheduledPayment, "ScheduledPaymentSetup")
        .withArgs(
          user1.address,
          user1.address,
          avatar.address,
          avatar.address,
          AddressZero
        );
    });
  });

  describe("setConfig", async () => {
    it("throws if caller not owner", async () => {
      const { scheduledPayment } = await setupTests();
      await expect(
        scheduledPayment.connect(user2).setConfig(AddressOne)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should emit event and update config value", async () => {
      const { scheduledPayment } = await setupTests();
      await expect(scheduledPayment.setConfig(AddressOne))
        .to.emit(scheduledPayment, "ConfigSet")
        .withArgs(AddressOne);
      assert.equal(await scheduledPayment.config(), AddressOne);
    });
  });

  describe("schedulePayment()", async () => {
    it("throws if caller not avatar", async () => {
      const { scheduledPayment } = await setupTests();
      const spHash = ethers.utils.solidityKeccak256(
        [
          "string",
          "uint256",
          "string",
          "uint256",
          "string",
          "uint256",
          "uint256",
        ],
        [
          AddressOne,
          "1000000000000",
          AddressOne,
          "10000000000",
          AddressOne,
          "1659072885",
          await scheduledPayment.nonce(),
        ]
      );
      await expect(
        scheduledPayment.connect(user2).schedulePayment(spHash)
      ).to.be.revertedWith("caller is not the right avatar");
    });

    it("should emit event and add the spHash list", async () => {
      const { tx, avatar, scheduledPayment } = await setupTests();
      const nonce = await scheduledPayment.nonce();
      const spHash = ethers.utils.solidityKeccak256(
        [
          "string",
          "uint256",
          "string",
          "uint256",
          "string",
          "uint256",
          "uint256",
        ],
        [
          AddressOne,
          "1000000000000",
          AddressOne,
          "10000000000",
          AddressOne,
          "1659072885",
          nonce,
        ]
      );
      const schedulePayment =
        await scheduledPayment.populateTransaction.schedulePayment(spHash);
      await expect(
        avatar.execTransaction(
          scheduledPayment.address,
          tx.value,
          schedulePayment.data,
          tx.operation,
          tx.avatarTxGas,
          tx.baseGas,
          tx.gasPrice,
          tx.gasToken,
          tx.refundReceiver,
          tx.signatures
        )
      )
        .to.emit(scheduledPayment, "PaymentScheduled")
        .withArgs(nonce, spHash);
      assert.equal(await scheduledPayment.getSpHash(nonce), spHash);
    });
  });
});

import assert from "assert";

import { AddressZero } from "@ethersproject/constants";
import { AddressOne } from "@gnosis.pm/safe-contracts";
import { expect } from "chai";
import { Contract } from "ethers";
import hre, { deployments, waffle, ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";

describe("ScheduledPaymentModule", async () => {
  const [user1, user2] = waffle.provider.getWallets();
  const abiCoder = new ethers.utils.AbiCoder();

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture();
    const avatarFactory = await hre.ethers.getContractFactory("TestAvatar");
    const avatar = await avatarFactory.deploy();
    const ScheduledPaymentModule = await hre.ethers.getContractFactory(
      "ScheduledPaymentModule"
    );
    const scheduledPaymentModule = await ScheduledPaymentModule.deploy(
      user1.address,
      avatar.address,
      avatar.address,
      AddressOne
    );
    const enableModule = await avatar.populateTransaction.enableModule(
      scheduledPaymentModule.address
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
      scheduledPaymentModule,
      tx,
    };
  });

  describe("setUp()", async () => {
    it("throws if guard has already been initialized", async () => {
      const { avatar, scheduledPaymentModule } = await setupTests();
      const initializeParams = abiCoder.encode(
        ["address", "address", "address", "address"],
        [user1.address, avatar.address, avatar.address, AddressOne]
      );
      await expect(
        scheduledPaymentModule.setUp(initializeParams)
      ).to.be.revertedWith("Initializable: contract is already initialized");
    });

    it("throws if owner is zero address", async () => {
      const avatarFactory = await hre.ethers.getContractFactory("TestAvatar");
      const avatar = await avatarFactory.deploy();
      const ScheduledPaymentModule = await hre.ethers.getContractFactory(
        "ScheduledPaymentModule"
      );
      await expect(
        ScheduledPaymentModule.deploy(
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
      const ScheduledPaymentModule = await hre.ethers.getContractFactory(
        "ScheduledPaymentModule"
      );
      await expect(
        ScheduledPaymentModule.deploy(
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
      const ScheduledPaymentModule = await hre.ethers.getContractFactory(
        "ScheduledPaymentModule"
      );
      await expect(
        ScheduledPaymentModule.deploy(
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
      const ScheduledPaymentModule = await hre.ethers.getContractFactory(
        "ScheduledPaymentModule"
      );
      const scheduledPaymentModule = await ScheduledPaymentModule.deploy(
        user1.address,
        avatar.address,
        avatar.address,
        AddressZero
      );
      await scheduledPaymentModule.deployed();

      await expect(scheduledPaymentModule.deployTransaction)
        .to.emit(scheduledPaymentModule, "ScheduledPaymentModuleSetup")
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
      const { scheduledPaymentModule } = await setupTests();
      await expect(
        scheduledPaymentModule.connect(user2).setConfig(AddressOne)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should emit event and update config value", async () => {
      const { scheduledPaymentModule } = await setupTests();
      await expect(scheduledPaymentModule.setConfig(AddressOne))
        .to.emit(scheduledPaymentModule, "ConfigSet")
        .withArgs(AddressOne);
      assert.equal(await scheduledPaymentModule.config(), AddressOne);
    });
  });

  describe("schedulePayment()", async () => {
    it("throws if caller not avatar", async () => {
      const { scheduledPaymentModule } = await setupTests();
      const spHash = await scheduledPaymentModule.createSpHash(
        AddressOne, //token
        "1000000000000", // amount
        AddressOne, //payee
        "10000000000", //maxGasPrice
        AddressOne, //gasToken
        "1659072885", //payAt
        await scheduledPaymentModule.nonce()
      );
      await expect(
        scheduledPaymentModule.connect(user2).schedulePayment(spHash)
      ).to.be.revertedWith("caller is not the right avatar");
    });

    it("should emit event and add the spHash list", async () => {
      const { tx, avatar, scheduledPaymentModule } = await setupTests();
      const nonce = await scheduledPaymentModule.nonce();
      const spHash = await scheduledPaymentModule.createSpHash(
        AddressOne, //token
        "1000000000000", // amount
        AddressOne, //payee
        "10000000000", //maxGasPrice
        AddressOne, //gasToken
        "1659072885", //payAt
        nonce
      );
      const schedulePayment =
        await scheduledPaymentModule.populateTransaction.schedulePayment(
          spHash
        );
      await expect(
        avatar.execTransaction(
          scheduledPaymentModule.address,
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
        .to.emit(scheduledPaymentModule, "PaymentScheduled")
        .withArgs(nonce, spHash);
      assert.equal((await scheduledPaymentModule.getSpHashes())[0], spHash);
    });
  });

  describe("cancelScheduledPayment()", async () => {
    let tx: any,
      avatar: Contract,
      scheduledPaymentModule: Contract,
      spHash: any;

    beforeEach(async () => {
      const setupData = await setupTests();
      tx = setupData.tx;
      avatar = setupData.avatar;
      scheduledPaymentModule = setupData.scheduledPaymentModule;

      const nonce = await scheduledPaymentModule.nonce();
      spHash = await scheduledPaymentModule.createSpHash(
        AddressOne, //token
        "1000000000000", // amount
        AddressOne, //payee
        "10000000000", //maxGasPrice
        AddressOne, //gasToken
        "1659072885", //payAt
        nonce
      );
      const schedulePayment =
        await scheduledPaymentModule.populateTransaction.schedulePayment(
          spHash
        );
      await expect(
        avatar.execTransaction(
          scheduledPaymentModule.address,
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
      );
    });

    it("throws if caller not avatar", async () => {
      await expect(
        scheduledPaymentModule.connect(user2).cancelScheduledPayment(spHash)
      ).to.be.revertedWith("caller is not the right avatar");
    });

    it("throws if hash unknown", async () => {
      const newSPHash = await scheduledPaymentModule.createSpHash(
        AddressOne, //token
        "1000000000000", // amount
        AddressOne, //payee
        "10000000000", //maxGasPrice
        AddressOne, //gasToken
        "1659072885", //payAt
        100
      );

      const schedulePayment =
        await scheduledPaymentModule.populateTransaction.cancelScheduledPayment(
          newSPHash
        );
      await expect(
        avatar.execTransaction(
          scheduledPaymentModule.address,
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
      ).to.be.revertedWith("Safe Tx reverted");
    });

    it("should emit event and remove hash from spHash", async () => {
      const schedulePayment =
        await scheduledPaymentModule.populateTransaction.cancelScheduledPayment(
          spHash
        );
      await expect(
        avatar.execTransaction(
          scheduledPaymentModule.address,
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
        .to.emit(scheduledPaymentModule, "ScheduledPaymentCancelled")
        .withArgs(spHash);
      assert.equal((await scheduledPaymentModule.getSpHashes()).length, 0);
    });
  });
});

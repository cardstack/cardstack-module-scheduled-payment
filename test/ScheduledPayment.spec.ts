import assert from "assert";

import { AddressZero } from "@ethersproject/constants";
import { AddressOne } from "@gnosis.pm/safe-contracts";
import { expect } from "chai";
import { Contract } from "ethers";
import hre, { deployments, waffle, ethers, network } from "hardhat";
import "@nomiclabs/hardhat-ethers";

describe("ScheduledPaymentModule", async () => {
  const [user1, user2, user3] = waffle.provider.getWallets();
  const abiCoder = new ethers.utils.AbiCoder();

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture();
    const Token = await hre.ethers.getContractFactory("TestToken");
    const token = await Token.deploy("TestToken", "TestToken");
    const gasToken = await Token.deploy("GasToken", "GasToken");
    const Config = await hre.ethers.getContractFactory("TestConfig");
    const config = await Config.deploy(user1.address, user1.address);
    const avatarFactory = await hre.ethers.getContractFactory("TestAvatar");
    const avatar = await avatarFactory.deploy();
    const ScheduledPaymentModule = await hre.ethers.getContractFactory(
      "ScheduledPaymentModule"
    );
    const scheduledPaymentModule = await ScheduledPaymentModule.deploy(
      user1.address,
      avatar.address,
      avatar.address,
      config.address
    );
    await avatar.enableModule(scheduledPaymentModule.address);
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
      token,
      gasToken,
      config,
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
        await scheduledPaymentModule.nonce(),
        "1659072885" //payAt
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
        nonce,
        "1659072885" //payAt
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
        nonce,
        "1659072885" //payAt
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
        100,
        "1659072885" //payAt
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

  describe("executeScheduledPayment()", async () => {
    let tx: any,
      avatar: Contract,
      scheduledPaymentModule: Contract,
      token: Contract,
      gasToken: Contract,
      config: Contract,
      spHash: any,
      nonce: number,
      payAt: number;
    const tokenAmount = "1000000000000000000"; //1 eth
    const maxGasPrice = "10000000000";

    beforeEach(async () => {
      const setupData = await setupTests();
      tx = setupData.tx;
      avatar = setupData.avatar;
      scheduledPaymentModule = setupData.scheduledPaymentModule;
      token = setupData.token;
      gasToken = setupData.gasToken;
      config = setupData.config;

      const mintAmount = "10000000000000000000"; //10 eth
      await token.mint(avatar.address, mintAmount);
      await gasToken.mint(avatar.address, mintAmount);

      nonce = await scheduledPaymentModule.nonce();
      payAt = Math.floor(Date.now() / 1000) + 86400; //now + 1 day
      spHash = await scheduledPaymentModule.createSpHash(
        token.address, //token
        tokenAmount,
        user3.address, //payee
        maxGasPrice,
        gasToken.address, //gasToken
        nonce,
        payAt
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

    it("throws if caller not a crank", async () => {
      await expect(
        scheduledPaymentModule.connect(user2).executeScheduledPayment(
          token.address, //token
          tokenAmount,
          user3.address, //payee
          maxGasPrice,
          gasToken.address, //gasToken
          nonce,
          payAt,
          maxGasPrice
        )
      ).to.be.revertedWith("caller is not a crank");
    });

    it("throws if hash unknown", async () => {
      const newSPHash = await scheduledPaymentModule.createSpHash(
        AddressOne, //token
        "1000000000000", // amount
        AddressOne, //payee
        "10000000000", //maxGasPrice
        AddressOne, //gasToken,
        100,
        "1659072885" //payAt
      );

      await expect(
        scheduledPaymentModule.connect(user1).executeScheduledPayment(
          AddressOne, //token
          "1000000000000", // amount
          AddressOne, //payee
          "10000000000", //maxGasPrice
          AddressOne, //gasToken,
          100,
          "1659072885", //payAt
          "10000000000"
        )
      ).to.be.revertedWith(`UnknownHash("${newSPHash}")`);
    });

    it("throws if execution before payAt + 1 minutes", async () => {
      await expect(
        scheduledPaymentModule.connect(user1).executeScheduledPayment(
          token.address, //token
          tokenAmount,
          user3.address, //payee
          maxGasPrice,
          gasToken.address, //gasToken
          nonce,
          payAt,
          maxGasPrice
        )
      ).to.be.revertedWith(`InvalidPeriod("${spHash}")`);
    });

    it("throws if payment execution failed", async () => {
      await network.provider.send("evm_increaseTime", [payAt + 60]);

      const newNonce = await scheduledPaymentModule.nonce();
      const newSPHash = await scheduledPaymentModule.createSpHash(
        token.address, //token
        "100000000000000000000", //amount 100 eth
        user3.address, //payee
        maxGasPrice,
        gasToken.address, //gasToken
        newNonce,
        payAt
      );
      const schedulePayment =
        await scheduledPaymentModule.populateTransaction.schedulePayment(
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
      );

      await expect(
        scheduledPaymentModule.connect(user1).executeScheduledPayment(
          token.address, //token
          "100000000000000000000", //amount 100 eth
          user3.address, //payee
          maxGasPrice,
          gasToken.address, //gasToken
          newNonce,
          payAt,
          maxGasPrice
        )
      ).to.be.revertedWith(`PaymentExecutionFailed("${newSPHash}")`);
    });

    it("throws if gas deduction failed", async () => {
      await network.provider.send("evm_increaseTime", [payAt + 60]);

      const newNonce = await scheduledPaymentModule.nonce();
      const newSPHash = await scheduledPaymentModule.createSpHash(
        token.address, //token
        tokenAmount,
        user3.address, //payee
        "100000000000000000000", //maxGasPrice 100 eth
        gasToken.address, //gasToken
        newNonce,
        payAt
      );
      const schedulePayment =
        await scheduledPaymentModule.populateTransaction.schedulePayment(
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
      );

      await expect(
        scheduledPaymentModule.connect(user1).executeScheduledPayment(
          token.address, //token
          tokenAmount,
          user3.address, //payee
          "100000000000000000000", //maxGasPrice 100 eth
          gasToken.address, //gasToken
          newNonce,
          payAt,
          "100000000000000000000"
        )
      ).to.be.revertedWith(`GasDeductionFailed("${newSPHash}")`);
    });

    it("should emit event because of scheduled payment executed", async () => {
      await network.provider.send("evm_increaseTime", [payAt + 60]);
      const payeeBalance = await token.balanceOf(user3.address);
      const feeReceiver = await config.getFeeReceiver();
      const feeReceiverBalance = await gasToken.balanceOf(feeReceiver);

      await expect(
        scheduledPaymentModule.connect(user1).executeScheduledPayment(
          token.address, //token
          tokenAmount,
          user3.address, //payee
          maxGasPrice,
          gasToken.address, //gasToken
          nonce,
          payAt,
          maxGasPrice
        )
      )
        .to.emit(scheduledPaymentModule, "ScheduledPaymentExecuted")
        .withArgs(spHash);
      assert.equal(
        (await token.balanceOf(user3.address)).toString(),
        payeeBalance.add(tokenAmount).toString()
      );
      assert.equal(
        (await gasToken.balanceOf(feeReceiver)).gt(feeReceiverBalance),
        true
      );
    });
  });
});

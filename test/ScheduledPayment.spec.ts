import assert from "assert";

import { AddressZero } from "@ethersproject/constants";
import { AddressOne } from "@gnosis.pm/safe-contracts";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import hre, { deployments, waffle, ethers, network } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import moment from "moment";

describe("ScheduledPaymentModule", async () => {
  const [user1, user2, user3] = waffle.provider.getWallets();
  const abiCoder = new ethers.utils.AbiCoder();
  const transferAmount = "1000000000000";
  const payee = user3.address;
  const fee = {
    fixedUSD: { value: "25000000000000000000" },
    percentage: { value: "100000000000000000" },
  };
  const executionGas = "1000";
  const maxGasPrice = "10000000000";
  const payAt = new Date().getTime() + 86400;
  const DECIMAL_BASE = BigNumber.from("1000000000000000000");

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture();
    const Token = await hre.ethers.getContractFactory("TestToken");
    const token = await Token.deploy("TestToken", "TestToken");
    const gasToken = await Token.deploy("GasToken", "GasToken");
    const Config = await hre.ethers.getContractFactory("TestConfig");
    const config = await Config.deploy(user1.address, user1.address);
    const Exchange = await hre.ethers.getContractFactory("TestExchange");
    const exchange = await Exchange.deploy("23401000000000000000000");
    const avatarFactory = await hre.ethers.getContractFactory("TestAvatar");
    const avatar = await avatarFactory.deploy();
    const ScheduledPaymentModule = await hre.ethers.getContractFactory(
      "ScheduledPaymentModule"
    );
    const scheduledPaymentModule = await ScheduledPaymentModule.deploy(
      user1.address,
      avatar.address,
      avatar.address,
      config.address,
      exchange.address
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
      exchange,
    };
  });

  describe("setUp()", async () => {
    it("throws if module has already been initialized", async () => {
      const { avatar, scheduledPaymentModule } = await setupTests();
      const initializeParams = abiCoder.encode(
        ["address", "address", "address", "address", "address"],
        [user1.address, avatar.address, avatar.address, AddressOne, AddressOne]
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
          AddressZero,
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
          AddressZero,
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
        AddressZero,
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
          AddressZero,
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
      const { scheduledPaymentModule, token, gasToken } = await setupTests();
      const spHash = await scheduledPaymentModule[
        "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256)"
      ](
        token.address,
        transferAmount,
        payee,
        fee,
        executionGas,
        maxGasPrice,
        gasToken.address,
        await scheduledPaymentModule.nonce(),
        payAt
      );
      await expect(
        scheduledPaymentModule.connect(user2).schedulePayment(spHash)
      ).to.be.revertedWith("caller is not the right avatar");
    });

    it("should emit event and add the spHash list", async () => {
      const { tx, avatar, scheduledPaymentModule, token, gasToken } =
        await setupTests();
      const nonce = await scheduledPaymentModule.nonce();
      const spHash = await scheduledPaymentModule[
        "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256)"
      ](
        token.address,
        transferAmount,
        payee,
        fee,
        executionGas,
        maxGasPrice,
        gasToken.address,
        await scheduledPaymentModule.nonce(),
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
      token: Contract,
      gasToken: Contract,
      spHash: any;

    beforeEach(async () => {
      const setupData = await setupTests();
      tx = setupData.tx;
      avatar = setupData.avatar;
      scheduledPaymentModule = setupData.scheduledPaymentModule;
      token = setupData.token;
      gasToken = setupData.token;

      const nonce = await scheduledPaymentModule.nonce();
      spHash = await scheduledPaymentModule[
        "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256)"
      ](
        token.address,
        transferAmount,
        payee,
        fee,
        executionGas,
        maxGasPrice,
        gasToken.address,
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

    it("throws if caller not avatar", async () => {
      await expect(
        scheduledPaymentModule.connect(user2).cancelScheduledPayment(spHash)
      ).to.be.revertedWith("caller is not the right avatar");
    });

    it("throws if hash unknown", async () => {
      const newSPHash = await scheduledPaymentModule[
        "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256)"
      ](
        token.address,
        transferAmount,
        payee,
        fee,
        executionGas,
        maxGasPrice,
        gasToken.address,
        1000,
        payAt
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

  describe("executeScheduledPayment() one-time payment", async () => {
    let tx: any,
      avatar: Contract,
      scheduledPaymentModule: Contract,
      token: Contract,
      gasToken: Contract,
      config: Contract,
      exchange: Contract,
      spHash: any,
      nonce: number,
      payAt: number,
      executionGas: number;

    beforeEach(async () => {
      const setupData = await setupTests();
      tx = setupData.tx;
      avatar = setupData.avatar;
      scheduledPaymentModule = setupData.scheduledPaymentModule;
      token = setupData.token;
      gasToken = setupData.gasToken;
      config = setupData.config;
      exchange = setupData.exchange;

      const mintAmount = "10000000000000000000"; //10 eth
      await token.mint(avatar.address, mintAmount);
      await gasToken.mint(avatar.address, mintAmount);

      nonce = await scheduledPaymentModule.nonce();
      payAt = Math.floor(Date.now() / 1000) + 86400; //now + 1 day

      try {
        await scheduledPaymentModule[
          "estimateExecutionGas(address,uint256,address,((uint256),(uint256)),uint256,address,uint256,uint256,uint256)"
        ](
          token.address,
          transferAmount,
          payee,
          fee,
          maxGasPrice,
          gasToken.address,
          nonce,
          payAt,
          maxGasPrice
        );
      } catch (e: any) {
        const error = e.message.split(" ");
        executionGas = error[error.length - 1].replace(
          /[\'GasEstimation\(|\)\']/g, //eslint-disable-line
          ""
        );
      }

      spHash = await scheduledPaymentModule[
        "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256)"
      ](
        token.address,
        transferAmount,
        payee,
        fee,
        executionGas,
        maxGasPrice,
        gasToken.address,
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
        scheduledPaymentModule
          .connect(user2)
          [
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256,uint256)"
          ](
            token.address,
            transferAmount,
            payee,
            fee,
            executionGas,
            maxGasPrice,
            gasToken.address,
            nonce,
            payAt,
            maxGasPrice
          )
      ).to.be.revertedWith("caller is not a crank");
    });

    it("throws if hash unknown", async () => {
      const newSPHash = await scheduledPaymentModule[
        "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256)"
      ](
        token.address,
        transferAmount,
        payee,
        fee,
        executionGas,
        maxGasPrice,
        gasToken.address,
        1000,
        payAt
      );

      await expect(
        scheduledPaymentModule
          .connect(user1)
          [
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256,uint256)"
          ](
            token.address,
            transferAmount,
            payee,
            fee,
            executionGas,
            maxGasPrice,
            gasToken.address,
            1000,
            payAt,
            maxGasPrice
          )
      ).to.be.revertedWith(`UnknownHash("${newSPHash}")`);
    });

    it("throws if execution before payAt + 1 minutes", async () => {
      await expect(
        scheduledPaymentModule
          .connect(user1)
          [
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256,uint256)"
          ](
            token.address,
            transferAmount,
            payee,
            fee,
            executionGas,
            maxGasPrice,
            gasToken.address,
            nonce,
            payAt,
            maxGasPrice
          )
      ).to.be.revertedWith(`InvalidPeriod("${spHash}")`);
    });

    it("throws if payment execution failed", async () => {
      await network.provider.send("evm_increaseTime", [payAt + 60]);
      const exceedAmount = "1000000000000000000000"; //1000 eth
      const newNonce = await scheduledPaymentModule.nonce();
      const newSPHash = await scheduledPaymentModule[
        "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256)"
      ](
        token.address,
        exceedAmount,
        payee,
        fee,
        executionGas,
        maxGasPrice,
        gasToken.address,
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
        scheduledPaymentModule
          .connect(user1)
          [
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256,uint256)"
          ](
            token.address,
            exceedAmount,
            payee,
            fee,
            executionGas,
            maxGasPrice,
            gasToken.address,
            newNonce,
            payAt,
            maxGasPrice
          )
      ).to.be.revertedWith(`PaymentExecutionFailed("${newSPHash}")`);
    });

    it("throws if gas deduction failed", async () => {
      await network.provider.send("evm_increaseTime", [payAt + 60]);
      const exceedGasAmount = "1000000000000000000000"; //1000 eth
      const newNonce = await scheduledPaymentModule.nonce();
      const newSPHash = await scheduledPaymentModule[
        "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256)"
      ](
        token.address,
        transferAmount,
        payee,
        fee,
        executionGas,
        exceedGasAmount,
        gasToken.address,
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
        scheduledPaymentModule
          .connect(user1)
          [
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256,uint256)"
          ](
            token.address,
            transferAmount,
            payee,
            fee,
            executionGas,
            exceedGasAmount,
            gasToken.address,
            newNonce,
            payAt,
            exceedGasAmount
          )
      ).to.be.revertedWith(`PaymentExecutionFailed("${newSPHash}")`);
    });

    it("throws if execution gas too low", async () => {
      await network.provider.send("evm_increaseTime", [payAt + 60]);
      const lowExecutionGas = "2500";
      const newNonce = await scheduledPaymentModule.nonce();
      const newSPHash = await scheduledPaymentModule[
        "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256)"
      ](
        token.address,
        transferAmount,
        payee,
        fee,
        lowExecutionGas,
        maxGasPrice,
        gasToken.address,
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

      try {
        await scheduledPaymentModule
          .connect(user1)
          [
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256,uint256)"
          ](
            token.address,
            transferAmount,
            payee,
            fee,
            lowExecutionGas,
            maxGasPrice,
            gasToken.address,
            newNonce,
            payAt,
            maxGasPrice
          );
      } catch (e: any) {
        const errors = e.message.split(" '");
        assert.equal(/OutOfGas.*/g.test(errors[errors.length - 1]), true);
      }
    });

    it("should emit event because of scheduled payment executed", async () => {
      await network.provider.send("evm_increaseTime", [payAt + 60]);
      const payeeBalance = await token.balanceOf(user3.address);
      const feeReceiver = await config.getFeeReceiver();

      await expect(
        scheduledPaymentModule
          .connect(user1)
          [
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256,uint256)"
          ](
            token.address,
            transferAmount,
            payee,
            fee,
            executionGas,
            maxGasPrice,
            gasToken.address,
            nonce,
            payAt,
            maxGasPrice
          )
      )
        .to.emit(scheduledPaymentModule, "ScheduledPaymentExecuted")
        .withArgs(spHash);

      const finalPayeeBalance = await token.balanceOf(user3.address);
      expect(finalPayeeBalance).to.be.eq(payeeBalance.add(transferAmount));

      const tokenDecimals = BigNumber.from("1000000000000000000");
      const [usdRate] = await exchange.exchangeRateOf(token.address);
      const fixedFee = BigNumber.from(fee.fixedUSD.value)
        .mul(tokenDecimals)
        .div(usdRate);
      const gasReimbursement = BigNumber.from(executionGas).mul(
        BigNumber.from(maxGasPrice)
      );
      const finalFeeReceiverGasBalance = await gasToken.balanceOf(feeReceiver);
      expect(finalFeeReceiverGasBalance).to.be.eq(
        gasReimbursement.add(fixedFee)
      );

      const percentage = BigNumber.from(fee.percentage.value)
        .mul(BigNumber.from(transferAmount))
        .div(DECIMAL_BASE);
      const finalFeeReceiverBalance = await token.balanceOf(feeReceiver);
      expect(finalFeeReceiverBalance).to.be.eq(percentage);
    });
  });

  describe("estimateExecutionGas() one-time payment", async () => {
    let avatar: Contract,
      scheduledPaymentModule: Contract,
      token: Contract,
      gasToken: Contract;

    beforeEach(async () => {
      const setupData = await setupTests();
      avatar = setupData.avatar;
      scheduledPaymentModule = setupData.scheduledPaymentModule;
      token = setupData.token;
      gasToken = setupData.gasToken;

      const mintAmount = "10000000000000000000"; //10 eth
      await token.mint(avatar.address, mintAmount);
      await gasToken.mint(avatar.address, mintAmount);
    });

    it("should revert estimation gas", async () => {
      try {
        const nonce = await scheduledPaymentModule.nonce();
        await scheduledPaymentModule[
          "estimateExecutionGas(address,uint256,address,((uint256),(uint256)),uint256,address,uint256,uint256,uint256)"
        ](
          token.address,
          transferAmount,
          payee,
          fee,
          maxGasPrice,
          gasToken.address,
          nonce,
          payAt,
          maxGasPrice
        );
      } catch (e: any) {
        const error = e.message.split(" ");
        const gas = error[error.length - 1].replace(
          /[\'GasEstimation\(|\)\']/g, //eslint-disable-line
          ""
        );

        //3200 baseGas
        //2500 emit event cost
        //500 other actions
        const baseGas = 3200 + 2500 + 500;
        expect(Number(gas)).to.be.gte(baseGas);
      }
    });
  });

  describe("executeScheduledPayment() recurring payment", async () => {
    let tx: any,
      avatar: Contract,
      scheduledPaymentModule: Contract,
      token: Contract,
      gasToken: Contract,
      config: Contract,
      exchange: Contract,
      spHash: any,
      nonce: number,
      recursDayOfMonth: number,
      until: number,
      executionGas: number;

    beforeEach(async () => {
      const setupData = await setupTests();
      tx = setupData.tx;
      avatar = setupData.avatar;
      scheduledPaymentModule = setupData.scheduledPaymentModule;
      token = setupData.token;
      gasToken = setupData.gasToken;
      config = setupData.config;
      exchange = setupData.exchange;

      const mintAmount = "10000000000000000000"; //10 eth
      await token.mint(avatar.address, mintAmount);
      await gasToken.mint(avatar.address, mintAmount);

      nonce = await scheduledPaymentModule.nonce();
      recursDayOfMonth = 25;
      until = moment().add(3, "months").set("date", 28).unix(); //until the 28th of the following three months

      try {
        await scheduledPaymentModule[
          "estimateExecutionGas(address,uint256,address,((uint256),(uint256)),uint256,address,uint256,uint256,uint256,uint256)"
        ](
          token.address,
          transferAmount,
          payee,
          fee,
          maxGasPrice,
          gasToken.address,
          nonce,
          recursDayOfMonth,
          until,
          maxGasPrice
        );
      } catch (e: any) {
        const error = e.message.split(" ");
        executionGas = error[error.length - 1].replace(
          /[\'GasEstimation\(|\)\']/g, //eslint-disable-line
          ""
        );
      }

      spHash = await scheduledPaymentModule[
        "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256,uint256)"
      ](
        token.address,
        transferAmount,
        payee,
        fee,
        executionGas,
        maxGasPrice,
        gasToken.address,
        nonce,
        recursDayOfMonth,
        until
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
        scheduledPaymentModule
          .connect(user2)
          [
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256,uint256,uint256)"
          ](
            token.address,
            transferAmount,
            payee,
            fee,
            executionGas,
            maxGasPrice,
            gasToken.address,
            nonce,
            recursDayOfMonth,
            until,
            maxGasPrice
          )
      ).to.be.revertedWith("caller is not a crank");
    });

    it("throws if hash unknown", async () => {
      const newSPHash = await scheduledPaymentModule[
        "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256,uint256)"
      ](
        token.address,
        transferAmount,
        payee,
        fee,
        executionGas,
        maxGasPrice,
        gasToken.address,
        1000,
        recursDayOfMonth,
        until
      );

      await expect(
        scheduledPaymentModule
          .connect(user1)
          [
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256,uint256,uint256)"
          ](
            token.address,
            transferAmount,
            payee,
            fee,
            executionGas,
            maxGasPrice,
            gasToken.address,
            1000,
            recursDayOfMonth,
            until,
            maxGasPrice
          )
      ).to.be.revertedWith(`UnknownHash("${newSPHash}")`);
    });

    it("throws if execution before recurs day", async () => {
      const blockTimestamp = moment.unix(until).set("date", recursDayOfMonth - 2);
      await network.provider.send("evm_setNextBlockTimestamp", [
        blockTimestamp.unix(),
      ]);
      await expect(
        scheduledPaymentModule
          .connect(user1)
          [
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256,uint256,uint256)"
          ](
            token.address,
            transferAmount,
            payee,
            fee,
            executionGas,
            maxGasPrice,
            gasToken.address,
            nonce,
            recursDayOfMonth,
            until,
            maxGasPrice
          )
      ).to.be.revertedWith(`InvalidPeriod("${spHash}")`);
    });

    it("throws if payment has been executed on that month", async () => {
      const blockTimestamp = moment().set("date", recursDayOfMonth);
      await network.provider.send("evm_setNextBlockTimestamp", [
        blockTimestamp.unix(),
      ]);
      await expect(
        scheduledPaymentModule
          .connect(user1)
          [
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256,uint256,uint256)"
          ](
            token.address,
            transferAmount,
            payee,
            fee,
            executionGas,
            maxGasPrice,
            gasToken.address,
            nonce,
            recursDayOfMonth,
            until,
            maxGasPrice
          )
      )
        .to.emit(scheduledPaymentModule, "ScheduledPaymentExecuted")
        .withArgs(spHash);

      const blockTimestamp2 = moment().set("date", recursDayOfMonth + 2);
      await network.provider.send("evm_setNextBlockTimestamp", [
        blockTimestamp2.unix(),
      ]);
      await expect(
        scheduledPaymentModule
          .connect(user1)
          [
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256,uint256,uint256)"
          ](
            token.address,
            transferAmount,
            payee,
            fee,
            executionGas,
            maxGasPrice,
            gasToken.address,
            nonce,
            recursDayOfMonth,
            until,
            maxGasPrice
          )
      ).to.be.revertedWith(`InvalidPeriod("${spHash}")`);
    });

    it('throws if execution after the "until" occurs', async () => {
      await network.provider.send("evm_setNextBlockTimestamp", [until + 60]);
      await expect(
        scheduledPaymentModule
          .connect(user1)
          [
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256,uint256,uint256)"
          ](
            token.address,
            transferAmount,
            payee,
            fee,
            executionGas,
            maxGasPrice,
            gasToken.address,
            nonce,
            recursDayOfMonth,
            until,
            maxGasPrice
          )
      ).to.be.revertedWith(`InvalidPeriod("${spHash}")`);
    });

    it("throws if payment execution failed", async () => {
      const blockTimestamp = moment().set("date", recursDayOfMonth);
      await network.provider.send("evm_setNextBlockTimestamp", [
        blockTimestamp.unix(),
      ]);
      const exceedAmount = "1000000000000000000000"; //1000 eth
      const newNonce = await scheduledPaymentModule.nonce();
      const newSPHash = await scheduledPaymentModule[
        "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256,uint256)"
      ](
        token.address,
        exceedAmount,
        payee,
        fee,
        executionGas,
        maxGasPrice,
        gasToken.address,
        newNonce,
        recursDayOfMonth,
        until
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
        scheduledPaymentModule
          .connect(user1)
          [
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256,uint256,uint256)"
          ](
            token.address,
            exceedAmount,
            payee,
            fee,
            executionGas,
            maxGasPrice,
            gasToken.address,
            newNonce,
            recursDayOfMonth,
            until,
            maxGasPrice
          )
      ).to.be.revertedWith(`PaymentExecutionFailed("${newSPHash}")`);
    });

    it("throws if gas deduction failed", async () => {
      const blockTimestamp = moment().set("date", recursDayOfMonth);
      await network.provider.send("evm_setNextBlockTimestamp", [
        blockTimestamp.unix(),
      ]);
      const exceedGasAmount = "1000000000000000000000"; //1000 eth
      const newNonce = await scheduledPaymentModule.nonce();
      const newSPHash = await scheduledPaymentModule[
        "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256,uint256)"
      ](
        token.address,
        transferAmount,
        payee,
        fee,
        executionGas,
        exceedGasAmount,
        gasToken.address,
        newNonce,
        recursDayOfMonth,
        until
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
        scheduledPaymentModule
          .connect(user1)
          [
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256,uint256,uint256)"
          ](
            token.address,
            transferAmount,
            payee,
            fee,
            executionGas,
            exceedGasAmount,
            gasToken.address,
            newNonce,
            recursDayOfMonth,
            until,
            exceedGasAmount
          )
      ).to.be.revertedWith(`PaymentExecutionFailed("${newSPHash}")`);
    });

    it("throws if execution gas too low", async () => {
      const blockTimestamp = moment().set("date", recursDayOfMonth);
      await network.provider.send("evm_setNextBlockTimestamp", [
        blockTimestamp.unix(),
      ]);
      const lowExecutionGas = "2500";
      const newNonce = await scheduledPaymentModule.nonce();
      const newSPHash = await scheduledPaymentModule[
        "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256,uint256)"
      ](
        token.address,
        transferAmount,
        payee,
        fee,
        lowExecutionGas,
        maxGasPrice,
        gasToken.address,
        newNonce,
        recursDayOfMonth,
        until
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

      try {
        await scheduledPaymentModule
          .connect(user1)
          [
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256,uint256,uint256)"
          ](
            token.address,
            transferAmount,
            payee,
            fee,
            lowExecutionGas,
            maxGasPrice,
            gasToken.address,
            newNonce,
            recursDayOfMonth,
            until,
            maxGasPrice
          );
      } catch (e: any) {
        const errors = e.message.split(" '");
        assert.equal(/OutOfGas.*/g.test(errors[errors.length - 1]), true);
      }
    });

    it("should emit event because of scheduled payment executed", async () => {
      const blockTimestamp = moment().set("date", recursDayOfMonth);
      await network.provider.send("evm_setNextBlockTimestamp", [
        blockTimestamp.unix(),
      ]);
      const payeeBalance = await token.balanceOf(user3.address);
      const feeReceiver = await config.getFeeReceiver();

      await expect(
        scheduledPaymentModule
          .connect(user1)
          [
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256,uint256,uint256)"
          ](
            token.address,
            transferAmount,
            payee,
            fee,
            executionGas,
            maxGasPrice,
            gasToken.address,
            nonce,
            recursDayOfMonth,
            until,
            maxGasPrice
          )
      )
        .to.emit(scheduledPaymentModule, "ScheduledPaymentExecuted")
        .withArgs(spHash);

      const finalPayeeBalance = await token.balanceOf(user3.address);
      expect(finalPayeeBalance).to.be.eq(payeeBalance.add(transferAmount));

      const gasReimbursement = BigNumber.from(executionGas).mul(
        BigNumber.from(maxGasPrice)
      );
      const tokenDecimals = BigNumber.from("1000000000000000000");
      const [usdRate] = await exchange.exchangeRateOf(token.address);
      const fixedFee = BigNumber.from(fee.fixedUSD.value)
        .mul(tokenDecimals)
        .div(usdRate);
      const finalFeeReceiverGasBalance = await gasToken.balanceOf(feeReceiver);
      expect(finalFeeReceiverGasBalance).to.be.eq(
        gasReimbursement.add(fixedFee)
      );

      const percentage = BigNumber.from(fee.percentage.value)
        .mul(BigNumber.from(transferAmount))
        .div(DECIMAL_BASE);
      const finalFeeReceiverBalance = await token.balanceOf(feeReceiver);
      expect(finalFeeReceiverBalance).to.be.eq(percentage);
    });

    it("should emit event and not remove the hash if not the last execution", async () => {
      const blockTimestamp = moment().set("date", recursDayOfMonth);
      await network.provider.send("evm_setNextBlockTimestamp", [
        blockTimestamp.unix(),
      ]);
      const payeeBalance = await token.balanceOf(user3.address);
      const feeReceiver = await config.getFeeReceiver();
      const feeReceiverBalance = await gasToken.balanceOf(feeReceiver);

      await expect(
        scheduledPaymentModule
          .connect(user1)
          [
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256,uint256,uint256)"
          ](
            token.address,
            transferAmount,
            payee,
            fee,
            executionGas,
            maxGasPrice,
            gasToken.address,
            nonce,
            recursDayOfMonth,
            until,
            maxGasPrice
          )
      )
        .to.emit(scheduledPaymentModule, "ScheduledPaymentExecuted")
        .withArgs(spHash);
      assert.equal(
        (await token.balanceOf(user3.address)).toString(),
        payeeBalance.add(transferAmount).toString()
      );
      assert.equal(
        (await gasToken.balanceOf(feeReceiver)).gt(feeReceiverBalance),
        true
      );
      assert.equal(
        (await scheduledPaymentModule.getSpHashes()).includes(spHash),
        true
      );
    });

    it("should emit event and remove the hash if the last execution", async () => {
      const blockTimestamp = moment.unix(until).set("date", recursDayOfMonth);
      await network.provider.send("evm_setNextBlockTimestamp", [
        blockTimestamp.unix(),
      ]);
      const payeeBalance = await token.balanceOf(user3.address);
      const feeReceiver = await config.getFeeReceiver();
      const feeReceiverBalance = await gasToken.balanceOf(feeReceiver);

      await expect(
        scheduledPaymentModule
          .connect(user1)
          [
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,uint256,uint256,uint256,uint256)"
          ](
            token.address,
            transferAmount,
            payee,
            fee,
            executionGas,
            maxGasPrice,
            gasToken.address,
            nonce,
            recursDayOfMonth,
            until,
            maxGasPrice
          )
      )
        .to.emit(scheduledPaymentModule, "ScheduledPaymentExecuted")
        .withArgs(spHash);
      assert.equal(
        (await token.balanceOf(user3.address)).toString(),
        payeeBalance.add(transferAmount).toString()
      );
      assert.equal(
        (await gasToken.balanceOf(feeReceiver)).gt(feeReceiverBalance),
        true
      );
      assert.equal(
        (await scheduledPaymentModule.getSpHashes()).includes(spHash),
        false
      );
    });
  });
});

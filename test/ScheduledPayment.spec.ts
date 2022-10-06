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
  const salt = "uniquesalt";
  const validForDays = 259200; //3 days

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture();
    const Token = await hre.ethers.getContractFactory("TestToken");
    const token = await Token.deploy("TestToken", "TestToken", 18);
    const gasToken = await Token.deploy("GasToken", "GasToken", 18);
    const Config = await hre.ethers.getContractFactory("TestConfig");
    const config = await Config.deploy(
      user1.address,
      user1.address,
      validForDays
    );
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
        "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256)"
      ](
        token.address,
        transferAmount,
        payee,
        fee,
        executionGas,
        maxGasPrice,
        gasToken.address,
        salt,
        payAt
      );
      await expect(
        scheduledPaymentModule.connect(user2).schedulePayment(spHash)
      ).to.be.revertedWith("caller is not the right avatar");
    });

    it("should emit event and add the spHash list", async () => {
      const { tx, avatar, scheduledPaymentModule, token, gasToken } =
        await setupTests();
      const spHash = await scheduledPaymentModule[
        "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256)"
      ](
        token.address,
        transferAmount,
        payee,
        fee,
        executionGas,
        maxGasPrice,
        gasToken.address,
        salt,
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
        .withArgs(spHash);
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

      spHash = await scheduledPaymentModule[
        "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256)"
      ](
        token.address,
        transferAmount,
        payee,
        fee,
        executionGas,
        maxGasPrice,
        gasToken.address,
        salt,
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
        "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256)"
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

      payAt = Math.floor(Date.now() / 1000) + 86400; //now + 1 day

      try {
        await scheduledPaymentModule[
          "estimateExecutionGas(address,uint256,address,((uint256),(uint256)),uint256,address,string,uint256,uint256)"
        ](
          token.address,
          transferAmount,
          payee,
          fee,
          maxGasPrice,
          gasToken.address,
          salt,
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
        "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256)"
      ](
        token.address,
        transferAmount,
        payee,
        fee,
        executionGas,
        maxGasPrice,
        gasToken.address,
        salt,
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
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256)"
          ](
            token.address,
            transferAmount,
            payee,
            fee,
            executionGas,
            maxGasPrice,
            gasToken.address,
            salt,
            payAt,
            maxGasPrice
          )
      ).to.be.revertedWith("caller is not a crank");
    });

    it("throws if hash unknown", async () => {
      const newSPHash = await scheduledPaymentModule[
        "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256)"
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
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256)"
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
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256)"
          ](
            token.address,
            transferAmount,
            payee,
            fee,
            executionGas,
            maxGasPrice,
            gasToken.address,
            salt,
            payAt,
            maxGasPrice
          )
      ).to.be.revertedWith(`InvalidPeriod("${spHash}")`);
    });

    it("throws if execution after valid for days", async () => {
      await network.provider.send("evm_setNextBlockTimestamp", [
        payAt + validForDays + 60,
      ]);
      await expect(
        scheduledPaymentModule
          .connect(user1)
          [
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256)"
          ](
            token.address,
            transferAmount,
            payee,
            fee,
            executionGas,
            maxGasPrice,
            gasToken.address,
            salt,
            payAt,
            maxGasPrice
          )
      ).to.be.revertedWith(`InvalidPeriod("${spHash}")`);
    });

    it("throws if payment execution failed", async () => {
      await network.provider.send("evm_setNextBlockTimestamp", [payAt + 60]);
      const exceedAmount = "1000000000000000000000"; //1000 eth
      const newSPHash = await scheduledPaymentModule[
        "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256)"
      ](
        token.address,
        exceedAmount,
        payee,
        fee,
        executionGas,
        maxGasPrice,
        gasToken.address,
        salt,
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
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256)"
          ](
            token.address,
            exceedAmount,
            payee,
            fee,
            executionGas,
            maxGasPrice,
            gasToken.address,
            salt,
            payAt,
            maxGasPrice
          )
      ).to.be.revertedWith(`PaymentExecutionFailed("${newSPHash}")`);
    });

    it("throws if gas deduction failed", async () => {
      await network.provider.send("evm_setNextBlockTimestamp", [payAt + 60]);
      const exceedGasAmount = "1000000000000000000000"; //1000 eth
      const newSPHash = await scheduledPaymentModule[
        "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256)"
      ](
        token.address,
        transferAmount,
        payee,
        fee,
        executionGas,
        exceedGasAmount,
        gasToken.address,
        salt,
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
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256)"
          ](
            token.address,
            transferAmount,
            payee,
            fee,
            executionGas,
            exceedGasAmount,
            gasToken.address,
            salt,
            payAt,
            exceedGasAmount
          )
      ).to.be.revertedWith(`PaymentExecutionFailed("${newSPHash}")`);
    });

    it("throws if execution gas too low", async () => {
      await network.provider.send("evm_setNextBlockTimestamp", [payAt + 60]);
      const lowExecutionGas = "2500";
      const newSPHash = await scheduledPaymentModule[
        "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256)"
      ](
        token.address,
        transferAmount,
        payee,
        fee,
        lowExecutionGas,
        maxGasPrice,
        gasToken.address,
        salt,
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
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256)"
          ](
            token.address,
            transferAmount,
            payee,
            fee,
            lowExecutionGas,
            maxGasPrice,
            gasToken.address,
            salt,
            payAt,
            maxGasPrice
          );
      } catch (e: any) {
        const errors = e.message.split(" '");
        assert.equal(/OutOfGas.*/g.test(errors[errors.length - 1]), true);
      }
    });

    it("should emit event because of scheduled payment executed", async () => {
      await network.provider.send("evm_setNextBlockTimestamp", [payAt + 60]);
      const payeeBalance = await token.balanceOf(user3.address);
      const feeReceiver = await config.getFeeReceiver();

      await expect(
        scheduledPaymentModule
          .connect(user1)
          [
            "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256)"
          ](
            token.address,
            transferAmount,
            payee,
            fee,
            executionGas,
            maxGasPrice,
            gasToken.address,
            salt,
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
        await scheduledPaymentModule[
          "estimateExecutionGas(address,uint256,address,((uint256),(uint256)),uint256,address,string,uint256,uint256)"
        ](
          token.address,
          transferAmount,
          payee,
          fee,
          maxGasPrice,
          gasToken.address,
          salt,
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
    const recurringDays = [1, 2, 3, 15, 26, 27, 28]; //Cover different cases on early, middle and end of month
    let tx: any,
      avatar: Contract,
      scheduledPaymentModule: Contract,
      token: Contract,
      gasToken: Contract,
      config: Contract,
      exchange: Contract,
      spHash: any,
      recursDayOfMonth: number,
      until: number,
      executionGas: number,
      validExecutionTimestamp: moment.Moment;

    async function initialization(_recursDayOfMonth: number) {
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

      recursDayOfMonth = _recursDayOfMonth;
      validExecutionTimestamp = moment()
        .add(1, "months")
        .set("date", recursDayOfMonth)
        .set("hours", 0)
        .set("minutes", 0)
        .set("seconds", 0)
        .utc(true);
      until = moment
        .unix(validExecutionTimestamp.unix())
        .add(5, "months")
        .unix(); //until the 28th of the following five months at 00:00:00Z

      try {
        await scheduledPaymentModule[
          "estimateExecutionGas(address,uint256,address,((uint256),(uint256)),uint256,address,string,uint256,uint256,uint256)"
        ](
          token.address,
          transferAmount,
          payee,
          fee,
          maxGasPrice,
          gasToken.address,
          salt,
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
        "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256)"
      ](
        token.address,
        transferAmount,
        payee,
        fee,
        executionGas,
        maxGasPrice,
        gasToken.address,
        salt,
        recursDayOfMonth,
        until
      );
      const schedulePayment =
        await scheduledPaymentModule.populateTransaction.schedulePayment(
          spHash
        );
      expect(
        await avatar.execTransaction(
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
    }

    it("throws if caller not a crank", async () => {
      for (const recurringDay of recurringDays) {
        await initialization(recurringDay);
        await expect(
          scheduledPaymentModule
            .connect(user2)
            [
              "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256,uint256)"
            ](
              token.address,
              transferAmount,
              payee,
              fee,
              executionGas,
              maxGasPrice,
              gasToken.address,
              salt,
              recursDayOfMonth,
              until,
              maxGasPrice
            )
        ).to.be.revertedWith("caller is not a crank");
      }
    });

    it("throws if hash unknown", async () => {
      for (const recurringDay of recurringDays) {
        await initialization(recurringDay);
        const newSPHash = await scheduledPaymentModule[
          "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256)"
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
              "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256,uint256)"
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
      }
    });

    it("throws if execution before recurs day", async () => {
      for (const recurringDay of recurringDays) {
        await initialization(recurringDay);
        await network.provider.send("evm_setNextBlockTimestamp", [
          validExecutionTimestamp.unix() - 60, //60 seconds before recurring day
        ]);
        await expect(
          scheduledPaymentModule
            .connect(user1)
            [
              "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256,uint256)"
            ](
              token.address,
              transferAmount,
              payee,
              fee,
              executionGas,
              maxGasPrice,
              gasToken.address,
              salt,
              recursDayOfMonth,
              until,
              maxGasPrice
            )
        ).to.be.revertedWith(`InvalidPeriod("${spHash}")`);
      }
    });

    it("throws if execution after valid for days", async () => {
      for (const recurringDay of recurringDays) {
        await initialization(recurringDay);
        await network.provider.send("evm_setNextBlockTimestamp", [
          validExecutionTimestamp.add(validForDays, "seconds").unix() + 60, //60 seconds after recurring valid days
        ]);
        await expect(
          scheduledPaymentModule
            .connect(user1)
            [
              "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256,uint256)"
            ](
              token.address,
              transferAmount,
              payee,
              fee,
              executionGas,
              maxGasPrice,
              gasToken.address,
              salt,
              recursDayOfMonth,
              until,
              maxGasPrice
            )
        ).to.be.revertedWith(`InvalidPeriod("${spHash}")`);
      }
    });

    it("throws if payment has been executed on that month, although still in the `valid for days` period", async () => {
      for (const recurringDay of recurringDays) {
        await initialization(recurringDay);
        await network.provider.send("evm_setNextBlockTimestamp", [
          validExecutionTimestamp.unix(),
        ]);
        await expect(
          scheduledPaymentModule
            .connect(user1)
            [
              "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256,uint256)"
            ](
              token.address,
              transferAmount,
              payee,
              fee,
              executionGas,
              maxGasPrice,
              gasToken.address,
              salt,
              recursDayOfMonth,
              until,
              maxGasPrice
            )
        )
          .to.emit(scheduledPaymentModule, "ScheduledPaymentExecuted")
          .withArgs(spHash);

        await network.provider.send("evm_setNextBlockTimestamp", [
          validExecutionTimestamp.add(validForDays, "seconds").unix(), //execution in the same month in the last valid days
        ]);
        await expect(
          scheduledPaymentModule
            .connect(user1)
            [
              "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256,uint256)"
            ](
              token.address,
              transferAmount,
              payee,
              fee,
              executionGas,
              maxGasPrice,
              gasToken.address,
              salt,
              recursDayOfMonth,
              until,
              maxGasPrice
            )
        ).to.be.revertedWith(`InvalidPeriod("${spHash}")`);
      }
    });

    it('throws if execution after the "until" occurs', async () => {
      for (const recurringDay of recurringDays) {
        await initialization(recurringDay);
        const invalidExecutionTimestamp =
          moment.unix(until).add(validForDays, "seconds").unix() + 60;
        await network.provider.send("evm_setNextBlockTimestamp", [
          invalidExecutionTimestamp,
        ]);
        await expect(
          scheduledPaymentModule
            .connect(user1)
            [
              "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256,uint256)"
            ](
              token.address,
              transferAmount,
              payee,
              fee,
              executionGas,
              maxGasPrice,
              gasToken.address,
              salt,
              recursDayOfMonth,
              until,
              maxGasPrice
            )
        ).to.be.revertedWith(`InvalidPeriod("${spHash}")`);
      }
    });

    it("throws if payment execution failed", async () => {
      for (const recurringDay of recurringDays) {
        await initialization(recurringDay);
        await network.provider.send("evm_setNextBlockTimestamp", [
          validExecutionTimestamp.unix(),
        ]);
        const exceedAmount = "1000000000000000000000"; //1000 eth
        const newSPHash = await scheduledPaymentModule[
          "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256)"
        ](
          token.address,
          exceedAmount,
          payee,
          fee,
          executionGas,
          maxGasPrice,
          gasToken.address,
          salt,
          recursDayOfMonth,
          until
        );
        const schedulePayment =
          await scheduledPaymentModule.populateTransaction.schedulePayment(
            newSPHash
          );
        expect(
          await avatar.execTransaction(
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
              "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256,uint256)"
            ](
              token.address,
              exceedAmount,
              payee,
              fee,
              executionGas,
              maxGasPrice,
              gasToken.address,
              salt,
              recursDayOfMonth,
              until,
              maxGasPrice
            )
        ).to.be.revertedWith(`PaymentExecutionFailed("${newSPHash}")`);
      }
    });

    it("throws if gas deduction failed", async () => {
      for (const recurringDay of recurringDays) {
        await initialization(recurringDay);
        await network.provider.send("evm_setNextBlockTimestamp", [
          validExecutionTimestamp.unix(),
        ]);
        const exceedGasAmount = "1000000000000000000000"; //1000 eth
        const newSPHash = await scheduledPaymentModule[
          "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256)"
        ](
          token.address,
          transferAmount,
          payee,
          fee,
          executionGas,
          exceedGasAmount,
          gasToken.address,
          salt,
          recursDayOfMonth,
          until
        );
        const schedulePayment =
          await scheduledPaymentModule.populateTransaction.schedulePayment(
            newSPHash
          );
        expect(
          await avatar.execTransaction(
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
              "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256,uint256)"
            ](
              token.address,
              transferAmount,
              payee,
              fee,
              executionGas,
              exceedGasAmount,
              gasToken.address,
              salt,
              recursDayOfMonth,
              until,
              exceedGasAmount
            )
        ).to.be.revertedWith(`PaymentExecutionFailed("${newSPHash}")`);
      }
    });

    it("throws if execution gas too low", async () => {
      for (const recurringDay of recurringDays) {
        await initialization(recurringDay);
        await network.provider.send("evm_setNextBlockTimestamp", [
          validExecutionTimestamp.unix(),
        ]);
        const lowExecutionGas = "2500";
        const newSPHash = await scheduledPaymentModule[
          "createSpHash(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256)"
        ](
          token.address,
          transferAmount,
          payee,
          fee,
          lowExecutionGas,
          maxGasPrice,
          gasToken.address,
          salt,
          recursDayOfMonth,
          until
        );
        const schedulePayment =
          await scheduledPaymentModule.populateTransaction.schedulePayment(
            newSPHash
          );
        expect(
          await avatar.execTransaction(
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
              "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256,uint256)"
            ](
              token.address,
              transferAmount,
              payee,
              fee,
              lowExecutionGas,
              maxGasPrice,
              gasToken.address,
              salt,
              recursDayOfMonth,
              until,
              maxGasPrice
            );
        } catch (e: any) {
          const errors = e.message.split(" '");
          assert.equal(/OutOfGas.*/g.test(errors[errors.length - 1]), true);
        }
      }
    });

    it("should emit event and remove the hash if the execution in the valid days", async () => {
      const validDays = Array(validForDays / 86400)
        .fill(0)
        .map((e, i) => i);
      for (const recurringDay of recurringDays) {
        for (const validDay of validDays) {
          await initialization(recurringDay);
          const payeeBalance = await token.balanceOf(user3.address);
          const feeReceiver = await config.getFeeReceiver();
          const untiLastValidDays = moment
            .unix(until)
            .add(validForDays, "seconds")
            .unix();
          let month = 1;
          let _validExecutionTimestamp = moment
            .unix(validExecutionTimestamp.unix())
            .add(validDay, "days");
          do {
            await network.provider.send("evm_setNextBlockTimestamp", [
              _validExecutionTimestamp.unix(),
            ]);

            await expect(
              scheduledPaymentModule
                .connect(user1)
                [
                  "executeScheduledPayment(address,uint256,address,((uint256),(uint256)),uint256,uint256,address,string,uint256,uint256,uint256)"
                ](
                  token.address,
                  transferAmount,
                  payee,
                  fee,
                  executionGas,
                  maxGasPrice,
                  gasToken.address,
                  salt,
                  recursDayOfMonth,
                  until,
                  maxGasPrice
                )
            )
              .to.emit(scheduledPaymentModule, "ScheduledPaymentExecuted")
              .withArgs(spHash);
            month++;
            _validExecutionTimestamp = _validExecutionTimestamp
              .subtract(validDay, "days")
              .add(1, "months")
              .add(validDay, "days");
          } while (untiLastValidDays >= _validExecutionTimestamp.unix());
          const totalMonth = BigNumber.from(month - 1);
          expect(totalMonth).to.be.eq(BigNumber.from(6));

          const finalPayeeBalance = await token.balanceOf(user3.address);
          expect(finalPayeeBalance).to.be.eq(
            payeeBalance.add(totalMonth.mul(transferAmount))
          );

          const gasReimbursement = BigNumber.from(executionGas).mul(
            BigNumber.from(maxGasPrice)
          );
          const tokenDecimals = BigNumber.from("1000000000000000000");
          const [usdRate] = await exchange.exchangeRateOf(token.address);
          const fixedFee = BigNumber.from(fee.fixedUSD.value)
            .mul(tokenDecimals)
            .div(usdRate);
          const finalFeeReceiverGasBalance = await gasToken.balanceOf(
            feeReceiver
          );
          expect(finalFeeReceiverGasBalance).to.be.eq(
            gasReimbursement.add(fixedFee).mul(totalMonth)
          );

          const percentage = BigNumber.from(fee.percentage.value)
            .mul(BigNumber.from(transferAmount))
            .div(DECIMAL_BASE);
          const finalFeeReceiverBalance = await token.balanceOf(feeReceiver);
          expect(finalFeeReceiverBalance).to.be.eq(percentage.mul(totalMonth));

          const spHashes = await scheduledPaymentModule.getSpHashes();
          expect(spHashes.includes(spHash)).to.be.false;
        }
      }
    });
  });
});

import assert from "assert";

import { AddressZero } from "@ethersproject/constants";
import { AddressOne } from "@gnosis.pm/safe-contracts";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { setNextBlockTimestamp } from "@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time";
import "@nomiclabs/hardhat-ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, BigNumberish, BytesLike } from "ethers";
import hre, { ethers } from "hardhat";
import moment from "moment";

import {
  ScheduledPaymentModule,
  TestAvatar,
  TestConfig,
  TestExchange,
  TestToken,
} from "../typechain-types";

import { getErrorMessageAndStack } from "./helpers";

type TX = {
  to: string;
  value: BigNumberish;
  data: BytesLike;
  operation: BigNumberish;
  avatarTxGas: BigNumberish;
  baseGas: BigNumberish;
  gasPrice: BigNumberish;
  gasToken: string;
  refundReceiver: string;
  signatures: BytesLike;
};
describe("ScheduledPaymentModule", async () => {
  const abiCoder = new ethers.utils.AbiCoder();
  const transferAmount = "1000000000000";
  const fee = {
    fixedUSD: { value: "25000000000000000000" },
    percentage: { value: "100000000000000000" },
  };
  const executionGas = "1000";
  const maxGasPrice = "10000000000";
  const payAt = new Date().getTime() + 86400;
  const DECIMAL_BASE = BigNumber.from("1000000000000000000");
  const salt = "uniquesalt";
  const validForDays = 3;

  async function setupFixture() {
    const [user1, user2, user3] = await ethers.getSigners();

    const payee = user3.address;

    const Token = await hre.ethers.getContractFactory("TestToken");
    const token = await Token.deploy("TestToken", "TestToken", 18);
    const gasToken = await Token.deploy("GasToken", "GasToken", 18);
    const usdToken = await Token.deploy("USDToken", "USDToken", 6);
    const Config = await hre.ethers.getContractFactory("TestConfig");
    const config = await Config.deploy(
      user1.address,
      user1.address,
      validForDays
    );
    const Exchange = await hre.ethers.getContractFactory("TestExchange");
    const exchange = await Exchange.deploy(
      "23401000000000000000000",
      usdToken.address
    );
    const avatarFactory = await hre.ethers.getContractFactory("TestAvatar");
    const avatar = await avatarFactory.deploy();
    const ScheduledPaymentModule = await hre.ethers.getContractFactory(
      "ScheduledPaymentModule"
    );
    const scheduledPaymentModule = await ScheduledPaymentModule.deploy(
      user1.address,
      avatar.address,
      [user1.address],
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
      user1,
      user2,
      user3,
      avatar,
      scheduledPaymentModule,
      tx,
      token,
      gasToken,
      usdToken,
      config,
      exchange,
      payee,
    };
  }

  let avatar: TestAvatar,
    payee: string,
    user1: SignerWithAddress,
    user2: SignerWithAddress,
    user3: SignerWithAddress,
    scheduledPaymentModule: ScheduledPaymentModule,
    tx: TX,
    token: TestToken,
    gasToken: TestToken,
    usdToken: TestToken,
    config: TestConfig,
    exchange: TestExchange;

  beforeEach(async function () {
    ({
      payee,
      avatar,
      user1,
      user2,
      user3,
      scheduledPaymentModule,
      token,
      gasToken,
      usdToken,
      config,
      exchange,
      tx,
    } = await loadFixture(setupFixture));
  });

  describe("setUp()", async () => {
    it("throws if module has already been initialized", async () => {
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
          [AddressZero],
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
          [user1.address],
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
          [user1.address],
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
        [user1.address],
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
          [user1.address],
          avatar.address,
          AddressZero,
          AddressZero,
          scheduledPaymentModule.address
        );
    });
  });

  describe("setConfig", async () => {
    it("throws if caller not owner", async () => {
      await expect(
        scheduledPaymentModule.connect(user2).setConfig(AddressOne)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("should emit event and update config value", async () => {
      await expect(scheduledPaymentModule.setConfig(AddressOne))
        .to.emit(scheduledPaymentModule, "ConfigSet")
        .withArgs(AddressOne);
      assert.equal(await scheduledPaymentModule.config(), AddressOne);
    });
  });

  describe("schedulePayment()", async () => {
    it("throws if caller not avatar", async () => {
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
          schedulePayment.data || "0x",
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
    let spHash: string;
    beforeEach(async () => {
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
      await avatar.execTransaction(
        scheduledPaymentModule.address,
        tx.value,
        schedulePayment.data || "0x",
        tx.operation,
        tx.avatarTxGas,
        tx.baseGas,
        tx.gasPrice,
        tx.gasToken,
        tx.refundReceiver,
        tx.signatures
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
        "1000",
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
          schedulePayment.data || "0x",
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
          schedulePayment.data || "0x",
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
    let spHash: string, executionGas: number, payAt: number;

    beforeEach(async () => {
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
      } catch (e) {
        const error = getErrorMessageAndStack(e).message.split(" ");
        executionGas = parseInt(
          error[error.length - 1].replace(/['GasEstimation(|)']/g, "")
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
      avatar.execTransaction(
        scheduledPaymentModule.address,
        tx.value,
        schedulePayment.data || "0x",
        tx.operation,
        tx.avatarTxGas,
        tx.baseGas,
        tx.gasPrice,
        tx.gasToken,
        tx.refundReceiver,
        tx.signatures
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
        "1000",
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
            "1000",
            payAt,
            maxGasPrice
          )
      )
        .to.be.revertedWithCustomError(scheduledPaymentModule, `UnknownHash`)
        .withArgs(newSPHash);
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
      )
        .to.be.revertedWithCustomError(scheduledPaymentModule, `InvalidPeriod`)
        .withArgs(spHash);
    });

    it("throws if execution after valid for days", async () => {
      await setNextBlockTimestamp(payAt + validForDays * 86400 + 60);

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
        .to.be.revertedWithCustomError(scheduledPaymentModule, `InvalidPeriod`)
        .withArgs(spHash);
    });

    it("throws if payment execution failed", async () => {
      await setNextBlockTimestamp(payAt + 60);

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
      expect(
        avatar.execTransaction(
          scheduledPaymentModule.address,
          tx.value,
          schedulePayment.data || "0x",
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
      )
        .to.be.revertedWithCustomError(
          scheduledPaymentModule,
          "PaymentExecutionFailed"
        )
        .withArgs(newSPHash);
    });

    it("throws if gas deduction failed", async () => {
      await setNextBlockTimestamp(payAt + 60);

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

      await avatar.execTransaction(
        scheduledPaymentModule.address,
        tx.value,
        schedulePayment.data || "0x",
        tx.operation,
        tx.avatarTxGas,
        tx.baseGas,
        tx.gasPrice,
        tx.gasToken,
        tx.refundReceiver,
        tx.signatures
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
      )
        .to.be.revertedWithCustomError(
          scheduledPaymentModule,
          `PaymentExecutionFailed`
        )
        .withArgs(newSPHash);
    });

    it("throws if execution gas too low", async () => {
      await setNextBlockTimestamp(payAt + 60);

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
      await avatar.execTransaction(
        scheduledPaymentModule.address,
        tx.value,
        schedulePayment.data || "0x",
        tx.operation,
        tx.avatarTxGas,
        tx.baseGas,
        tx.gasPrice,
        tx.gasToken,
        tx.refundReceiver,
        tx.signatures
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
      } catch (e) {
        const errors = getErrorMessageAndStack(e).message.split(" '");

        assert.equal(/OutOfGas.*/g.test(errors[errors.length - 1]), true);
      }
    });

    it("should emit event because of scheduled payment executed", async () => {
      await setNextBlockTimestamp(payAt + 60);

      const payeeBalance = await token.balanceOf(user3.address);
      const feeReceiver = await config.feeReceiver();

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
    beforeEach(async () => {
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
      } catch (e) {
        const error = getErrorMessageAndStack(e).message.split(" ");
        const gas = error[error.length - 1].replace(
          /['GasEstimation(|)']/g,
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
    const recurringDays = [1, 2, 3, 15, 26, 27, 28, 29, 30, 31]; //Cover different cases on early, middle and end of month
    let spHash: string,
      until: number,
      executionGas: number,
      validExecutionTimestamp: moment.Moment;

    async function initialization(_recurringDay: number) {
      const mintAmount = "10000000000000000000"; //10 eth
      await token.mint(avatar.address, mintAmount);
      await gasToken.mint(avatar.address, mintAmount);

      validExecutionTimestamp = moment()
        .add(1, "months")
        .set("hours", 0)
        .set("minutes", 0)
        .set("seconds", 0)
        .utc(true);
      const daysInMonth = validExecutionTimestamp.daysInMonth();
      validExecutionTimestamp.set(
        "date",
        _recurringDay > daysInMonth ? daysInMonth : _recurringDay
      );

      until = moment()
        .set("date", _recurringDay)
        .add(6, "months")
        .set("hours", 0)
        .set("minutes", 0)
        .set("seconds", 0)
        .utc(true)
        .unix(); //until the 28th of the following six months at 00:00:00Z

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
          _recurringDay,
          until,
          maxGasPrice
        );
      } catch (e) {
        const error = getErrorMessageAndStack(e).message.split(" ");

        executionGas = parseInt(
          error[error.length - 1].replace(/['GasEstimation(|)']/g, "")
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
        _recurringDay,
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
          schedulePayment.data || "0x",
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
    for (const recurringDay of recurringDays) {
      describe(`Recurring day ${recurringDay}`, function () {
        it("throws if caller not a crank", async () => {
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
                recurringDay,
                until,
                maxGasPrice
              )
          ).to.be.revertedWith("caller is not a crank");
        });

        it("throws if hash unknown", async () => {
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
            "1000",
            recurringDay,
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
                "1000",
                recurringDay,
                until,
                maxGasPrice
              )
          )
            .to.be.revertedWithCustomError(
              scheduledPaymentModule,
              `UnknownHash`
            )
            .withArgs(newSPHash);
        });
        it("throws if execution before recurs day", async () => {
          await initialization(recurringDay);

          await setNextBlockTimestamp(
            validExecutionTimestamp
              .clone()
              .subtract(60, "seconds")
              .toDate()
              .valueOf()
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
                salt,
                recurringDay,
                until,
                maxGasPrice
              )
          )
            .to.be.revertedWithCustomError(
              scheduledPaymentModule,
              `InvalidPeriod`
            )
            .withArgs(spHash);
        });

        it("throws if execution after valid for days", async () => {
          await initialization(recurringDay);

          await setNextBlockTimestamp(
            validExecutionTimestamp
              .clone()
              .add(validForDays, "days")
              .valueOf() + 60 //60 seconds after recurring valid days
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
                salt,
                recurringDay,
                until,
                maxGasPrice
              )
          )
            .to.be.revertedWithCustomError(
              scheduledPaymentModule,
              `InvalidPeriod`
            )
            .withArgs(spHash);
        });

        it("throws if payment has been executed on that month, although still in the `valid for days` period", async () => {
          await initialization(recurringDay);

          await setNextBlockTimestamp(validExecutionTimestamp.unix());

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
                recurringDay,
                until,
                maxGasPrice
              )
          )
            .to.emit(scheduledPaymentModule, "ScheduledPaymentExecuted")
            .withArgs(spHash);

          await setNextBlockTimestamp(
            validExecutionTimestamp.add(validForDays, "days").unix() //execution in the same month in the last valid days
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
                salt,
                recurringDay,
                until,
                maxGasPrice
              )
          )
            .to.be.revertedWithCustomError(
              scheduledPaymentModule,
              `InvalidPeriod`
            )
            .withArgs(spHash);
        });

        it('throws if execution after the "until" occurs', async () => {
          await initialization(recurringDay);
          const invalidExecutionTimestamp =
            moment.unix(until).add(validForDays, "days").unix() + 60;

          await setNextBlockTimestamp(invalidExecutionTimestamp);

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
                recurringDay,
                until,
                maxGasPrice
              )
          )
            .to.be.revertedWithCustomError(
              scheduledPaymentModule,
              `InvalidPeriod`
            )
            .withArgs(spHash);
        });

        it("throws if payment execution failed", async () => {
          await initialization(recurringDay);
          await setNextBlockTimestamp(validExecutionTimestamp.unix());

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
            recurringDay,
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
              schedulePayment.data || "0x",
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
                recurringDay,
                until,
                maxGasPrice
              )
          )
            .to.be.revertedWithCustomError(
              scheduledPaymentModule,
              `PaymentExecutionFailed`
            )
            .withArgs(newSPHash);
        });

        it("throws if gas deduction failed", async () => {
          await initialization(recurringDay);

          await setNextBlockTimestamp(validExecutionTimestamp.unix());

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
            recurringDay,
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
              schedulePayment.data || "0x",
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
                recurringDay,
                until,
                exceedGasAmount
              )
          )
            .to.be.revertedWithCustomError(
              scheduledPaymentModule,
              `PaymentExecutionFailed`
            )
            .withArgs(newSPHash);
        });

        it("throws if execution gas too low", async () => {
          await initialization(recurringDay);

          await setNextBlockTimestamp(validExecutionTimestamp.unix());

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
            recurringDay,
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
              schedulePayment.data || "0x",
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
                recurringDay,
                until,
                maxGasPrice
              );
          } catch (e) {
            const errors = getErrorMessageAndStack(e).message.split(" '");
            assert.equal(/OutOfGas.*/g.test(errors[errors.length - 1]), true);
          }
        });

        const validDays = Array(validForDays)
          .fill(0)
          .map((_e, i) => i);
        for (const validDay of validDays) {
          it(`should emit event and remove the hash if the execution in the valid day ${validDay}`, async () => {
            await initialization(recurringDay);
            const payeeBalance = await token.balanceOf(user3.address);
            const feeReceiver = await config.feeReceiver();
            const untiLastValidDays = moment
              .unix(until)
              .utc(true)
              .add(validForDays, "days")
              .unix();
            let month = 1;
            let _validExecutionTimestamp = moment
              .unix(validExecutionTimestamp.unix())
              .utc(true)
              .add(validDay, "days");

            do {
              await setNextBlockTimestamp(_validExecutionTimestamp.unix());

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
                    recurringDay,
                    until,
                    maxGasPrice
                  )
              )
                .to.emit(scheduledPaymentModule, "ScheduledPaymentExecuted")
                .withArgs(spHash);
              month++;
              _validExecutionTimestamp = _validExecutionTimestamp
                .subtract(validDay, "days")
                .add(1, "months");
              const daysInMonth = _validExecutionTimestamp.daysInMonth();
              _validExecutionTimestamp
                .set(
                  "date",
                  recurringDay > daysInMonth ? daysInMonth : recurringDay
                )
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
            expect(finalFeeReceiverBalance).to.be.eq(
              percentage.mul(totalMonth)
            );

            const spHashes = await scheduledPaymentModule.getSpHashes();
            expect(spHashes.includes(spHash)).to.be.false;
          });
        }
      });
    }
  });

  describe("executeScheduledPayment() one-time payment when gas token is usd token", async () => {
    let spHash: string, executionGas: number, payAt: number;
    const maxGasPrice = "10000"; //0.01 USD

    beforeEach(async () => {
      const mintAmount = "10000000000000000000"; //10 eth
      const usdAmount = "10000000000"; //10000 USD
      await token.mint(avatar.address, mintAmount);
      await usdToken.mint(avatar.address, usdAmount);

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
          usdToken.address,
          salt,
          payAt,
          maxGasPrice
        );
      } catch (e) {
        const error = getErrorMessageAndStack(e).message.split(" ");
        executionGas = parseInt(
          error[error.length - 1].replace(/['GasEstimation(|)']/g, "")
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
        usdToken.address,
        salt,
        payAt
      );
      const schedulePayment =
        await scheduledPaymentModule.populateTransaction.schedulePayment(
          spHash
        );
      avatar.execTransaction(
        scheduledPaymentModule.address,
        tx.value,
        schedulePayment.data || "0x",
        tx.operation,
        tx.avatarTxGas,
        tx.baseGas,
        tx.gasPrice,
        usdToken.address,
        tx.refundReceiver,
        tx.signatures
      );
    });

    it("should transfer fee in USD amount", async () => {
      await setNextBlockTimestamp(payAt + 60);

      const payeeBalance = await token.balanceOf(user3.address);
      const feeReceiver = await config.feeReceiver();

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
            usdToken.address,
            salt,
            payAt,
            maxGasPrice
          )
      )
        .to.emit(scheduledPaymentModule, "ScheduledPaymentExecuted")
        .withArgs(spHash);

      const finalPayeeBalance = await token.balanceOf(user3.address);
      expect(finalPayeeBalance).to.be.eq(payeeBalance.add(transferAmount));

      const tokenDecimals = BigNumber.from("1000000"); //USD decimals is 6
      const fixedFee = BigNumber.from(fee.fixedUSD.value)
        .mul(tokenDecimals)
        .div(DECIMAL_BASE);
      const gasReimbursement = BigNumber.from(executionGas).mul(
        BigNumber.from(maxGasPrice)
      );
      const finalFeeReceiverGasBalance = await usdToken.balanceOf(feeReceiver);
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
});

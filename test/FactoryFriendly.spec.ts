import { AddressOne } from "@gnosis.pm/safe-contracts";
import { expect } from "chai";
import { AbiCoder, BytesLike } from "ethers/lib/utils";
import hre, { ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

import { ModuleProxyFactory, ScheduledPaymentModule } from "../typechain-types";

const saltNonce = "0xfa";

describe("Module works with factory", () => {
  const paramsTypes = ["address", "address", "address", "address", "address"];

  async function setupFixture() {
    const Factory = await hre.ethers.getContractFactory("ModuleProxyFactory");
    const ScheduledPaymentModule = await hre.ethers.getContractFactory(
      "ScheduledPaymentModule"
    );
    const factory = await Factory.deploy();

    const masterCopy = await ScheduledPaymentModule.deploy(
      AddressOne,
      AddressOne,
      AddressOne,
      AddressOne,
      AddressOne
    );

    return { factory, masterCopy };
  }

  let factory: ModuleProxyFactory, masterCopy: ScheduledPaymentModule;

  beforeEach(async function () {
    ({ factory, masterCopy } = await loadFixture(setupFixture));
  });

  it("should throw because master copy is already initialized", async () => {
    const encodedParams = new AbiCoder().encode(paramsTypes, [
      AddressOne,
      AddressOne,
      AddressOne,
      AddressOne,
      AddressOne,
    ]);
    await expect(masterCopy.setUp(encodedParams)).to.be.revertedWith(
      "Initializable: contract is already initialized"
    );
  });

  it("should deploy new protect module proxy", async () => {
    const [owner] = await ethers.getSigners();
    const paramsValues = [
      owner.address,
      owner.address,
      AddressOne,
      AddressOne,
      AddressOne,
    ];
    const encodedParams = new AbiCoder().encode(paramsTypes, paramsValues);
    const initParams = masterCopy.interface.encodeFunctionData("setUp", [
      encodedParams,
    ]);
    const receipt = await factory
      .deployModule(masterCopy.address, initParams, saltNonce)
      .then((tx: any) => tx.wait());

    // retrieve new address from event
    const {
      args: [newProxyAddress],
    } = receipt.events.find(
      ({ event }: { event: string }) => event === "ModuleProxyCreation"
    );

    const newProxy = await hre.ethers.getContractAt(
      "ScheduledPaymentModule",
      newProxyAddress
    );
    expect(await newProxy.owner()).to.be.eq(owner.address);
  });
});

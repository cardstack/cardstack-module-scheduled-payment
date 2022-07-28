import { AddressOne } from "@gnosis.pm/safe-contracts";
import { expect } from "chai";
import { AbiCoder } from "ethers/lib/utils";
import hre, { deployments, ethers } from "hardhat";
import "@nomiclabs/hardhat-ethers";

const saltNonce = "0xfa";

describe("Module works with factory", () => {
  const paramsTypes = ["address", "address", "address", "address"];

  const baseSetup = deployments.createFixture(async () => {
    await deployments.fixture();
    const Factory = await hre.ethers.getContractFactory("ModuleProxyFactory");
    const ScheduledPayment = await hre.ethers.getContractFactory(
      "ScheduledPayment"
    );
    const factory = await Factory.deploy();

    const masterCopy = await ScheduledPayment.deploy(
      AddressOne,
      AddressOne,
      AddressOne,
      AddressOne
    );

    return { factory, masterCopy };
  });

  it("should throw because master copy is already initialized", async () => {
    const { masterCopy } = await baseSetup();
    const encodedParams = new AbiCoder().encode(paramsTypes, [
      AddressOne,
      AddressOne,
      AddressOne,
      AddressOne,
    ]);
    await expect(masterCopy.setUp(encodedParams)).to.be.revertedWith(
      "Initializable: contract is already initialized"
    );
  });

  it("should deploy new protect meta guard proxy", async () => {
    const { factory, masterCopy } = await baseSetup();
    const [owner] = await ethers.getSigners();
    const paramsValues = [owner.address, owner.address, AddressOne, AddressOne];
    const encodedParams = [new AbiCoder().encode(paramsTypes, paramsValues)];
    const initParams = masterCopy.interface.encodeFunctionData(
      "setUp",
      encodedParams
    );
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
      "ScheduledPayment",
      newProxyAddress
    );
    expect(await newProxy.owner()).to.be.eq(owner.address);
  });
});

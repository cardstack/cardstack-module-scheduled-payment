import { expect } from "chai";
import hre, { deployments, waffle } from "hardhat";
import "@nomiclabs/hardhat-ethers";

describe("Exchange", async () => {
  const [user1] = waffle.provider.getWallets();

  const setupTests = deployments.createFixture(async ({ deployments }) => {
    await deployments.fixture();
    const Pool = await hre.ethers.getContractFactory("TestUniswapPool");
    const pool = await Pool.deploy();
    const Factory = await hre.ethers.getContractFactory("TestUniswapFactory");
    const factory = await Factory.deploy(pool.address);
    const Token = await hre.ethers.getContractFactory("TestToken");
    const token0 = await Token.deploy("Token0", "Token0", 18);
    const token1 = await Token.deploy("Token1", "Token1", 18);
    const Exchange = await hre.ethers.getContractFactory("Exchange");
    const exchange = await Exchange.deploy();
    await exchange.initialize(user1.address);
    await exchange.setUp(factory.address, 3000, token0.address, 60);
    return {
      exchange,
      pool,
      token0,
      token1,
    };
  });

  describe("exchangeRateOf()", () => {
    it("should return usd rate equal to 3000", async () => {
      const { exchange, pool, token1 } = await setupTests();
      /*
      Price(k) = 1.0001**Tick(k)
      Tick = 80067, Price = 3000
      
      tickCumulatives 60 seconds ago = 80067;
      tickCumulatives 0 second ago = tickCumulatives 60 seconds ago + ( 80067 * 60 ) = 4884087;
      */
      await pool.setTickCumulatives(["80067", "4884087"]);
      const price = Number(
        (await exchange.exchangeRateOf(token1.address)).value
      );
      expect(Math.round(price / 10 ** 18)).to.be.eq(3000);
    });

    it("should return usd rate greater than 3000", async () => {
      const { exchange, pool, token1 } = await setupTests();
      /*
      Price(k) = 1.0001**Tick(k)
      Tick = 80067, Price = 3000
      Tick = 82944, Price = 4000
      Tick = 85176, Price = 5000
      
      tickCumulatives 60 seconds ago = 80067;
      tickCumulatives 30 seconds ago = tickCumulatives 60 seconds ago + ( 82944 * 30 ) = 2568387;
      tickCumulatives 0 second ago = tickCumulatives 30 seconds ago  + ( 85176 * 30 ) = 4970397;
      */
      await pool.setTickCumulatives(["80067", "5123667"]);
      const price = Number(
        (await exchange.exchangeRateOf(token1.address)).value
      );
      expect(Math.round(price / 10 ** 18)).to.be.gt(3000);
    });

    it("should return usd rate lower than 3000", async () => {
      const { exchange, pool, token1 } = await setupTests();
      /*
      Price(k) = 1.0001**Tick(k)
      Tick = 80067, Price = 3000
      Tick = 76012, Price = 2000
      Tick = 69081, Price = 1000
      
      tickCumulatives 60 seconds ago = 80067;
      tickCumulatives 30 seconds ago = tickCumulatives 60 seconds ago + ( 76012 * 30 ) = 2360427;
      tickCumulatives 0 second ago = tickCumulatives 30 seconds ago  + ( 69081 * 30 ) = 4432857;
      */
      await pool.setTickCumulatives(["80067", "4432857"]);
      const price = Number(
        (await exchange.exchangeRateOf(token1.address)).value
      );
      expect(Math.round(price / 10 ** 18)).to.be.lt(3000);
    });
  });
});

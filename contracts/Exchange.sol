// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.9;

import "./interfaces/IExchange.sol";
import "./utils/Decimal.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import "./utils/OracleLibrary.sol";

contract Exchange is IExchange, OwnableUpgradeable {
    event ExchangeSetup(address factory, uint24 fee, address usdToken, uint32 secondsAgo);

    address public factory;
    uint24 public fee;
    address public usdToken;
    //desired time to retrieve the price history in seconds
    uint32 public secondsAgo;

    function initialize(address _owner) external initializer {
        __Ownable_init();
        transferOwnership(_owner);
    }

    function setUp(
        address _factory,
        uint24 _fee,
        address _usdToken,
        uint32 _secondsAgo
    ) external onlyOwner {
        factory = _factory;
        fee = _fee;
        usdToken = _usdToken;
        secondsAgo = _secondsAgo;

        emit ExchangeSetup(factory, fee, usdToken, secondsAgo);
    }

    function exchangeRateOf(address token)
        external
        view
        returns (Decimal.D256 memory)
    {
        address pool = token < usdToken
            ? IUniswapV3Factory(factory).getPool(token, usdToken, fee)
            : IUniswapV3Factory(factory).getPool(usdToken, token, fee);
        require(pool != address(0), "pool not found");

        int24 tick = OracleLibrary.consult(pool, secondsAgo);
        uint256 ten = 10;
        uint256 amountOut = OracleLibrary.getQuoteAtTick(
            tick,
            uint128(ten**ERC20(token).decimals()),
            token,
            usdToken
        );

        Decimal.D256 memory usdRate;
        usdRate.value =
            amountOut *
            (ten**(Decimal.BASE_POW - ERC20(usdToken).decimals()));

        return usdRate;
    }
}

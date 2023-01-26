// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import "../interfaces/IExchange.sol";

contract TestExchange is IExchange {
    address public usdToken;
    Decimal.D256 public price;

    constructor(uint256 _price, address _usdToken) {
        price.value = _price;
        usdToken = _usdToken;
    }

    function exchangeRateOf(address token)
        external
        view
        returns (Decimal.D256 memory)
    {
        require(token != usdToken, "cannot find the pool");
        return price;
    }
}

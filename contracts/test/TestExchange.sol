// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import "../interfaces/IExchange.sol";

contract TestExchange is IExchange {
    Decimal.D256 public price;

    constructor(uint256 _price) {
        price.value = _price;
    }

    function exchangeRateOf(address)
        external
        view
        returns (Decimal.D256 memory)
    {
        return price;
    }
}

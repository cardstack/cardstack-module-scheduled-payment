// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

contract TestUniswapFactory {
    address public pool;

    constructor(address _pool) {
        pool = _pool;
    }

    function getPool(address, address, uint24) external view returns (address) {
        return pool;
    }
}

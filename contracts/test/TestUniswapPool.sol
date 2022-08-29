// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

contract TestUniswapPool {
    int56[] public tickCumulatives;

    function setTickCumulatives(int56[] memory _tickCumulatives) external {
        tickCumulatives = _tickCumulatives;
    }

    function observe(uint32[] calldata)
        external
        view
        returns (int56[] memory, uint160[] memory)
    {
        uint160[] memory tickCumulativesPerSeconds;
        return (tickCumulatives, tickCumulativesPerSeconds);
    }
}

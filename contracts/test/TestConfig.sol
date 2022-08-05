// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import "../interfaces/IConfig.sol";

contract TestConfig is IConfig {
    address public crankAddress;
    address public feeReceiver;

    constructor(address _crankAddress, address _feeReceiver) {
        crankAddress = _crankAddress;
        feeReceiver = _feeReceiver;
    }

    function getCrankAddress() external view override returns (address) {
        return crankAddress;
    }

    function getFeeReceiver() external view override returns (address) {
        return feeReceiver;
    }
}
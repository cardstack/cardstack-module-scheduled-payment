// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import "../interfaces/IConfig.sol";

contract TestConfig is IConfig {
    address public crankAddress;
    address public feeReceiver;
    uint256 public validForSeconds;

    constructor(
        address _crankAddress,
        address _feeReceiver,
        uint8 _validForDays
    ) {
        crankAddress = _crankAddress;
        feeReceiver = _feeReceiver;
        validForSeconds = uint256(_validForDays * 86400);
    }

    function validForDays() external view override returns (uint8) {
        return uint8(validForSeconds / 86400);
    }
}

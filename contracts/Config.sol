// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.9;

import "./interfaces/IConfig.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract Config is IConfig, OwnableUpgradeable {
    event ConfigSetup(address crankAddress, address feeReceiver);

    address public crankAddress;
    address public feeReceiver;
    uint256 public validForSeconds;

    function initialize(address _owner) public initializer {
        __Ownable_init();
        transferOwnership(_owner);
    }

    function setUp(
        address _crankAddress,
        address _feeReceiver,
        uint8 _validForDays
    ) external onlyOwner {
        crankAddress = _crankAddress;
        feeReceiver = _feeReceiver;
        validForSeconds = _validForDays * 86400;

        emit ConfigSetup(crankAddress, feeReceiver);
    }

    function validForDays() external view returns (uint8) {
        return uint8(validForSeconds / 86400);
    }
}

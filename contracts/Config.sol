// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.9;

import "./interfaces/IConfig.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract Config is IConfig, OwnableUpgradeable {

    event ConfigSetup(address crankAddress, address feeReceiver);

    address private crankAddress;
    address private feeReceiver;

    function initialize(address _owner) public initializer {
        __Ownable_init();
        transferOwnership(_owner);
    }

    function setUp(address _crankAddress, address _feeReceiver)
        external
        onlyOwner
    {
        crankAddress = _crankAddress;
        feeReceiver = _feeReceiver;

        emit ConfigSetup(crankAddress, feeReceiver);
    }

    function getCrankAddress() external view returns (address) {
        return crankAddress;
    }

    function getFeeReceiver() external view returns (address) {
        return feeReceiver;
    }
}

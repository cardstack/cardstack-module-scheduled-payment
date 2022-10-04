// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.9;

interface IConfig {
    function getCrankAddress() external view returns (address);

    function getFeeReceiver() external view returns (address);

    function getValidForDays() external view returns (uint256);
}

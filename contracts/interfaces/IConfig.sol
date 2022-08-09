// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.9;

interface IConfig {
    function getCrankAddress() external returns (address);

    function getFeeReceiver() external returns (address);
}

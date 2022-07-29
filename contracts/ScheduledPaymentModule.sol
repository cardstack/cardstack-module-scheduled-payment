// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.9;

import "@gnosis.pm/zodiac/contracts/core/Module.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

contract ScheduledPaymentModule is Module {
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.Bytes32Set;

    event ScheduledPaymentModuleSetup(
        address indexed initiator,
        address indexed owner,
        address indexed avatar,
        address target,
        address config
    );
    event PaymentScheduled(uint256 nonce, bytes32 spHash);
    event ScheduledPaymentCancelled(bytes32 spHash);
    event ConfigSet(address config);

    error UnknownHash(bytes32 spHash);

    address public config;
    uint256 public nonce;
    EnumerableSetUpgradeable.Bytes32Set private spHashes;

    modifier onlyAvatar() {
        require(msg.sender == avatar, "caller is not the right avatar");
        _;
    }

    constructor(
        address _owner,
        address _avatar,
        address _target,
        address _config
    ) {
        bytes memory initParams = abi.encode(_owner, _avatar, _target, _config);
        setUp(initParams);
    }

    function setUp(bytes memory initParams) public override initializer {
        (
            address _owner,
            address _avatar,
            address _target,
            address _config
        ) = abi.decode(initParams, (address, address, address, address));
        __Ownable_init();
        require(_avatar != address(0), "Avatar can not be zero address");
        require(_target != address(0), "Target can not be zero address");

        avatar = _avatar;
        target = _target;
        config = _config;

        transferOwnership(_owner);

        emit ScheduledPaymentModuleSetup(
            msg.sender,
            _owner,
            _avatar,
            _target,
            _config
        );
    }

    function schedulePayment(bytes32 spHash) external onlyAvatar {
        spHashes.add(spHash);
        emit PaymentScheduled(nonce, spHash);
        nonce++;
    }

    function cancelScheduledPayment(bytes32 spHash) external onlyAvatar {
        if (!spHashes.contains(spHash)) revert UnknownHash(spHash);

        spHashes.remove(spHash);
        emit ScheduledPaymentCancelled(spHash);
    }

    function setConfig(address _config) external onlyOwner {
        config = _config;
        emit ConfigSet(_config);
    }

    function createSpHash(
        address token,
        uint256 amount,
        address payee,
        uint256 maxGasPrice,
        address gasToken,
        uint256 _nonce,
        uint256 payAt
    ) public pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    token,
                    amount,
                    payee,
                    maxGasPrice,
                    gasToken,
                    _nonce,
                    payAt
                )
            );
    }

    function getSpHashes() public view returns (bytes32[] memory) {
        return spHashes.values();
    }
}

// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.9;

import "@gnosis.pm/zodiac/contracts/core/Module.sol";

contract ScheduledPayment is Module {
    event ScheduledPaymentSetup(
        address indexed initiator,
        address indexed owner,
        address indexed avatar,
        address target,
        address config
    );
    event PaymentScheduled(uint256 nonce, bytes32 spHash);

    event ConfigSet(address config);

    address public config;
    uint256 public nonce;
    // Mapping of nonce to SP hash.
    mapping(uint256 => bytes32) public spHash;

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

        emit ScheduledPaymentSetup(
            msg.sender,
            _owner,
            _avatar,
            _target,
            _config
        );
    }

    function schedulePayment(bytes32 _spHash) external onlyAvatar {
        spHash[nonce] = _spHash;
        emit PaymentScheduled(nonce, spHash[nonce]);
        nonce++;
    }

    function setConfig(address _config) external onlyOwner {
        config = _config;
        emit ConfigSet(_config);
    }

    function getSpHash(uint256 _nonce) public view returns (bytes32) {
        return (spHash[_nonce]);
    }
}

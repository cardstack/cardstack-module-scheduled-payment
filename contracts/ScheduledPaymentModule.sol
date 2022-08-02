// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.9;

import "@gnosis.pm/zodiac/contracts/core/Module.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "./interfaces/IConfig.sol";

contract ScheduledPaymentModule is Module {
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.Bytes32Set;
    using SafeMathUpgradeable for uint256;

    event ScheduledPaymentModuleSetup(
        address indexed initiator,
        address indexed owner,
        address indexed avatar,
        address target,
        address config
    );
    event PaymentScheduled(uint256 nonce, bytes32 spHash);
    event ScheduledPaymentCancelled(bytes32 spHash);
    event ScheduledPaymentExecuted(bytes32 spHash);
    event ConfigSet(address config);

    error UnknownHash(bytes32 spHash);
    error InvalidPeriod(bytes32 spHash);
    error ExceedMaxGasPrice(bytes32 spHash);
    error PaymentExecutionFailed(bytes32 spHash);
    error GasDeductionFailed(bytes32 spHash);

    bytes4 public constant TRANSFER =
        bytes4(keccak256("transfer(address,uint256)"));

    address public config;
    uint256 public nonce;
    EnumerableSetUpgradeable.Bytes32Set private spHashes;

    modifier onlyAvatar() {
        require(msg.sender == avatar, "caller is not the right avatar");
        _;
    }

    modifier onlyCrank() {
        require(
            msg.sender == IConfig(config).getCrankAddress(),
            "caller is not a crank"
        );
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

    function executeScheduledPayment(
        address token,
        uint256 amount,
        address payee,
        uint256 baseGas,
        uint256 executionGas,
        uint256 maxGasPrice,
        address gasToken,
        uint256 _nonce,
        uint256 payAt,
        uint256 gasPrice
    ) external onlyCrank {
        bytes32 spHash = createSpHash(
            token,
            amount,
            payee,
            baseGas,
            executionGas,
            maxGasPrice,
            gasToken,
            _nonce,
            payAt
        );
        if (!spHashes.contains(spHash)) revert UnknownHash(spHash);

        //1 minute is buffer to protect against miners gaming block time
        //The recommended time for POW consensus finality is 1 minute
        if (block.timestamp < payAt.add(1 minutes)) revert InvalidPeriod(spHash);
        if (gasPrice > maxGasPrice) revert ExceedMaxGasPrice(spHash);
        // execTransactionFromModule to execute the sheduled payment
        bytes memory spTxData = abi.encodeWithSelector(
            0xa9059cbb,
            payee,
            amount
        );
        if (!exec(token, 0, spTxData, Enum.Operation.Call))
            revert PaymentExecutionFailed(spHash);

        // execTransactionFromModule for gas reimbursement
        bytes memory gasTxData = abi.encodeWithSelector(
            0xa9059cbb,
            IConfig(config).getFeeReceiver(),
            baseGas.add(executionGas).mul(gasPrice)
        );
        if (!exec(gasToken, 0, gasTxData, Enum.Operation.Call))
            revert GasDeductionFailed(spHash);

        spHashes.remove(spHash);
        emit ScheduledPaymentExecuted(spHash);
    }

    function estimateExecutionGas(
        address token,
        uint256 amount,
        address payee,
        uint256 baseGas,
        uint256 gasPrice,
        address gasToken
    ) external returns (uint256) {
        uint256 startGas = gasleft();
        bytes memory spTxData = abi.encodeWithSelector(
            0xa9059cbb,
            payee,
            amount
        );
        require(exec(token, 0, spTxData, Enum.Operation.Call));

        uint256 gasUsed = startGas.sub(gasleft());
        bytes memory gasTxData = abi.encodeWithSelector(
            0xa9059cbb,
            IConfig(config).getFeeReceiver(),
            baseGas.add(gasUsed).mul(gasPrice)
        );
        require(exec(gasToken, 0, gasTxData, Enum.Operation.Call));

        uint256 requiredGas = startGas - gasleft();
        // Convert response to string and return via error message
        revert(string(abi.encodePacked(requiredGas)));
    }

    function setConfig(address _config) external onlyOwner {
        config = _config;
        emit ConfigSet(_config);
    }

    function createSpHash(
        address token,
        uint256 amount,
        address payee,
        uint256 baseGas,
        uint256 executionGas,
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
                    baseGas,
                    executionGas,
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

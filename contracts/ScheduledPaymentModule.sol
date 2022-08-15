// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity ^0.8.9;

import "@gnosis.pm/zodiac/contracts/core/Module.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "./interfaces/IConfig.sol";
import "./utils/BokkyPooBahsDateTimeLibrary.sol";

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

    error AlreadyScheduled(bytes32 spHash);
    error UnknownHash(bytes32 spHash);
    error InvalidPeriod(bytes32 spHash);
    error ExceedMaxGasPrice(bytes32 spHash);
    error PaymentExecutionFailed(bytes32 spHash);
    error OutOfGas(bytes32 spHash, uint256 gasUsed);
    error GasEstimation(uint256 gas);

    bytes4 public constant TRANSFER =
        bytes4(keccak256("transfer(address,uint256)"));

    address public config;
    uint256 public nonce;
    EnumerableSetUpgradeable.Bytes32Set private spHashes;
    //Mapping RSP hash to last paid at
    mapping(bytes32 => uint256) public lastPaidAt;

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
        if (spHashes.contains(spHash)) revert AlreadyScheduled(spHash);

        spHashes.add(spHash);
        emit PaymentScheduled(nonce, spHash);
        nonce++;
    }

    function cancelScheduledPayment(bytes32 spHash) external onlyAvatar {
        if (!spHashes.contains(spHash)) revert UnknownHash(spHash);

        spHashes.remove(spHash);
        emit ScheduledPaymentCancelled(spHash);
    }

    // Execute scheduled one-time payment
    function executeScheduledPayment(
        address token,
        uint256 amount,
        address payee,
        uint256 executionGas,
        uint256 maxGasPrice,
        address gasToken,
        uint256 _nonce,
        uint256 payAt,
        uint256 gasPrice
    ) external onlyCrank {
        uint256 startGas = gasleft();
        bytes32 spHash = createSpHash(
            token,
            amount,
            payee,
            executionGas,
            maxGasPrice,
            gasToken,
            _nonce,
            payAt
        );

        if (!spHashes.contains(spHash)) revert UnknownHash(spHash);
        // 1 minute is buffer to protect against miners gaming block time
        // The recommended time for POW consensus finality is 1 minute
        if (block.timestamp < payAt.add(1 minutes))
            revert InvalidPeriod(spHash);
        if (gasPrice > maxGasPrice) revert ExceedMaxGasPrice(spHash);
        if (
            !_executeOneTimePayment(
                spHash,
                token,
                amount,
                payee,
                executionGas,
                gasToken,
                gasPrice
            )
        ) revert PaymentExecutionFailed(spHash);

        uint256 gasUsed = startGas - gasleft();
        if (gasUsed > executionGas) revert OutOfGas(spHash, gasUsed);
    }

    // Estimate scheduled one-time payment execution
    function estimateExecutionGas(
        address token,
        uint256 amount,
        address payee,
        uint256 maxGasPrice,
        address gasToken,
        uint256 _nonce,
        uint256 payAt,
        uint256 gasPrice
    ) external returns (uint256) {
        uint256 startGas = gasleft();
        // This executionGas calculation only for estimation purpose
        // 32000 base cost, base transfer cost, etc
        // 1500 keccak hash cost
        // 95225  standard 2x ERC20 transfer cost
        // 2500 emit event cost
        uint256 executionGas = 32000 + 1500 + 95225 + 2500;
        bytes32 spHash = createSpHash(
            token,
            amount,
            payee,
            executionGas,
            maxGasPrice,
            gasToken,
            _nonce,
            payAt
        );

        // We don't provide an error message here, as we use it to return the estimate
        require(
            _executeOneTimePayment(
                spHash,
                token,
                amount,
                payee,
                executionGas,
                gasToken,
                gasPrice
            )
        );

        // 500 required checks cost
        // 9500 remove value from set cost
        // 500 other cost
        uint256 requiredGas = startGas - gasleft() + 9500 + 500 + 500;
        // Return gas estimation result via error message
        revert GasEstimation(requiredGas);
    }

    // Execute scheduled recurring payment
    function executeScheduledPayment(
        address token,
        uint256 amount,
        address payee,
        uint256 executionGas,
        uint256 maxGasPrice,
        address gasToken,
        uint256 _nonce,
        uint256 recursDayOfMonth,
        uint256 until,
        uint256 gasPrice
    ) external onlyCrank {
        uint256 startGas = gasleft();
        bytes32 spHash = createSpHash(
            token,
            amount,
            payee,
            executionGas,
            maxGasPrice,
            gasToken,
            _nonce,
            recursDayOfMonth,
            until
        );
        if (!spHashes.contains(spHash)) revert UnknownHash(spHash);
        if (
            BokkyPooBahsDateTimeLibrary.getDay(block.timestamp) <
            recursDayOfMonth ||
            block.timestamp.sub(lastPaidAt[spHash]) < 28 days || //recursDayOfMont value range 1-28
            block.timestamp > until
        ) revert InvalidPeriod(spHash);
        if (gasPrice > maxGasPrice) revert ExceedMaxGasPrice(spHash);

        if (
            !_executeRecurringPayment(
                spHash,
                token,
                amount,
                payee,
                executionGas,
                gasToken,
                gasPrice
            )
        ) revert PaymentExecutionFailed(spHash);
        if (startGas - gasleft() > executionGas)
            revert OutOfGas(spHash, startGas - gasleft());
    }

    // Estimate scheduled recurring payment execution
    function estimateExecutionGas(
        address token,
        uint256 amount,
        address payee,
        uint256 maxGasPrice,
        address gasToken,
        uint256 _nonce,
        uint256 recursDayOfMonth,
        uint256 until,
        uint256 gasPrice
    ) external returns (uint256) {
        uint256 startGas = gasleft();
        // This executionGas calculation only for estimation purpose
        // 32000 base cost, base transfer cost, etc
        // 1500 keccak hash cost
        // 95225  standard 2x ERC20 transfer cost
        // 2500 emit event cost
        uint256 executionGas = 32000 + 1500 + 95225 + 2500;
        bytes32 spHash = createSpHash(
            token,
            amount,
            payee,
            executionGas,
            maxGasPrice,
            gasToken,
            _nonce,
            recursDayOfMonth,
            until
        );

        // We don't provide an error message here, as we use it to return the estimate
        require(
            _executeRecurringPayment(
                spHash,
                token,
                amount,
                payee,
                executionGas,
                gasToken,
                gasPrice
            )
        );

        // 500 required checks cost
        // 9000 convert timestamp to day
        // 500 other cost
        uint256 requiredGas = startGas - gasleft() + 9000 + 500 + 500;
        // Return gas estimation result via error message
        revert GasEstimation(requiredGas);
    }

    function setConfig(address _config) external onlyOwner {
        config = _config;
        emit ConfigSet(_config);
    }

    // Create a one-time payment hash
    function createSpHash(
        address token,
        uint256 amount,
        address payee,
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
                    executionGas,
                    maxGasPrice,
                    gasToken,
                    _nonce,
                    payAt
                )
            );
    }

    // Create recurring payment hash
    function createSpHash(
        address token,
        uint256 amount,
        address payee,
        uint256 executionGas,
        uint256 maxGasPrice,
        address gasToken,
        uint256 _nonce,
        uint256 recursDayOfMonth,
        uint256 until
    ) public pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    token,
                    amount,
                    payee,
                    executionGas,
                    maxGasPrice,
                    gasToken,
                    _nonce,
                    recursDayOfMonth,
                    until
                )
            );
    }

    function getSpHashes() public view returns (bytes32[] memory) {
        return spHashes.values();
    }

    function _executeOneTimePayment(
        bytes32 spHash,
        address token,
        uint256 amount,
        address payee,
        uint256 executionGas,
        address gasToken,
        uint256 gasPrice
    ) private returns (bool status) {
        status = executePayment(
            token,
            amount,
            payee,
            executionGas,
            gasPrice,
            gasToken
        );

        spHashes.remove(spHash);
        emit ScheduledPaymentExecuted(spHash);
    }

    function _executeRecurringPayment(
        bytes32 spHash,
        address token,
        uint256 amount,
        address payee,
        uint256 executionGas,
        address gasToken,
        uint256 gasPrice
    ) private returns (bool status) {
        status = executePayment(
            token,
            amount,
            payee,
            executionGas,
            gasPrice,
            gasToken
        );

        lastPaidAt[spHash] = block.timestamp;
        emit ScheduledPaymentExecuted(spHash);
    }

    function executePayment(
        address token,
        uint256 amount,
        address payee,
        uint256 executionGas,
        uint256 gasPrice,
        address gasToken
    ) private returns (bool) {
        // execTransactionFromModule to execute the sheduled payment
        bytes memory spTxData = abi.encodeWithSelector(
            0xa9059cbb,
            payee,
            amount
        );
        bool spTxStatus = exec(token, 0, spTxData, Enum.Operation.Call);

        // execTransactionFromModule for gas reimbursement
        bytes memory gasTxData = abi.encodeWithSelector(
            0xa9059cbb,
            IConfig(config).getFeeReceiver(),
            executionGas.mul(gasPrice)
        );
        bool gasTxStatus = exec(gasToken, 0, gasTxData, Enum.Operation.Call);

        return spTxStatus && gasTxStatus;
    }
}

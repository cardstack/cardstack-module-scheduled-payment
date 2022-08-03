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
    error OutOfGas(bytes32 spHash);
    error GasEstimation(uint256 gas);

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
            !executePayment(
                token,
                amount,
                payee,
                executionGas,
                gasPrice,
                gasToken
            )
        ) revert PaymentExecutionFailed(spHash);
        if (startGas - gasleft() + 2500 + 500 > executionGas)
            revert OutOfGas(spHash);

        spHashes.remove(spHash);
        emit ScheduledPaymentExecuted(spHash);
    }

    function estimateExecutionGas(
        address token,
        uint256 amount,
        address payee,
        uint256 executionGas,
        uint256 maxGasPrice,
        address gasToken,
        uint256 _nonce,
        uint256 payAt,
        uint256 gasPrice
    ) external returns (uint256) {
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

        // This executionGas calculation only for estimation purpose
        // 32000 base cost, base transfer cost, etc
        // 1500 keccak hash cost
        // 95225  standard 2x ERC20 transfer cost
        // 2500 emit event cost
        executionGas = executionGas > 0
            ? executionGas
            : 32000 + 1500 + 95225 + 2500;
        require(
            executePayment(
                token,
                amount,
                payee,
                executionGas,
                gasPrice,
                gasToken
            )
        );
        spHashes.remove(spHash);

        // Add with emit event cost and other cost
        uint256 requiredGas = startGas - gasleft() + 2500 + 500;

        // Convert response to string and return via error message
        revert GasEstimation(requiredGas);
    }

    function setConfig(address _config) external onlyOwner {
        config = _config;
        emit ConfigSet(_config);
    }

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

    function getSpHashes() public view returns (bytes32[] memory) {
        return spHashes.values();
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

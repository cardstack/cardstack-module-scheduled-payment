# Scheduled Payment Module

This module allows safe owners to schedule a payment by providing a payment hash. This module will use the payment hash during the execution process to validate the payment. We will refer to the service provider that will trigger the execution process as a “crank.” To execute the payment, the crank will provide the payment details, such as a token address, amount, payment at, gas token, fee, and gas reimbursement. This module will compare those details with the payment hash to ensure that the payment details can be used to spend some tokens from the safe.

This module works with the other two contracts that are also part of this repository, the config contract, and the exchange contract.

The config contract stores the data needed by this module to perform the execution of the payment. It stores the crank address, fee receiver address, and payment valid for days. This module will verify that the caller address of the execution process is equal to the crank address in the config contract. The fee receiver address set in the config contract will be used to receive fees and gas reimbursement from the payment execution process. The payment can only be executed between the pay-at and the valid period. The safe owners set up the pay-at data, and the module owner sets up the valid period in the config contract.

This module uses the exchange contract to get a rate of USD to the gas token since one of the fees to the crank that can be configured is a fixed fee in USD that will be deducted using the gas token specified in the payment. 

This module is intended to be used with [Gnosis Safe](https://github.com/safe-global/safe-contracts).

## Features

- Scheduling a one-time payment.
- Scheduling a recurring payment.
- Cancellation of a scheduled payment.
- Set crank and fee receiver.
- Execution of a scheduled payment by the crank.
- Fee deduction.
- Gas reimbursement.

## Flow

Module owner sets crank, fee receiver, and valid for days in config contract.
Module owner sets exchange contract.
Safe owners create a safe transaction to schedule a payment by providing a payment hash.
a. Safe owners can cancel a scheduled payment before the payment is executed.
      b. Crank executes a scheduled payment by providing the payment details.

## Solidity Compiler

The contracts have been developed with [Solidity 0.8.9](https://github.com/ethereum/solidity/releases/tag/v0.8.9) in mind. This version of Solidity made all arithmetic checked by default, therefore eliminating the need for explicit overflow or underflow (or other arithmetic) checks.

## Setup Guide

### Building
To build this project execute:
```
yarn install
yarn build 
```

### Testing
To run all the tests execute:
```sh
yarn test
```

To generate the test coverage report execute:
```sh
yarn test:coverage
```

This module has been deployed to goerli. You could use [cardpay-cli](https://github.com/cardstack/cardstack/tree/main/packages/cardpay-cli#cardpay-scheduled-payment-create-safe) to interact with this module through the command line.

### Deployment
We use [upgrade manager](https://github.com/cardstack/upgrade-manager) library to deploy these contracts. You can check how to deploy or update the contract on [upgrade manager](https://github.com/cardstack/upgrade-manager). 

## Security and Liability

All contracts are WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

## License

Created under the [LGPL-3.0+ license](LICENSE).

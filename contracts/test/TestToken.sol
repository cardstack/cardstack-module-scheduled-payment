// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TestToken is ERC20, Ownable {
    constructor(string memory name_, string memory symbol_)
        ERC20(name_, symbol_)
    {}

    function mint(address account, uint256 amount) external onlyOwner {
        _mint(account, amount);
    }
}

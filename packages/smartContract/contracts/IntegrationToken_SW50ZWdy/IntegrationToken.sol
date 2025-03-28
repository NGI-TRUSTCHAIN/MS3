// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.22;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract IntegrationToken is ERC20, Ownable, ERC20Permit {
    constructor(address recipient, address initialOwner)
        ERC20("IntegrationToken", "ITK")
        Ownable(initialOwner)
        ERC20Permit("IntegrationToken")
    {
        _mint(recipient, 1000 * 10 ** decimals());
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}

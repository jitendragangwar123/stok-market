// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20, IERC20Metadata} from "../interfaces/IERC20.sol";

/// @title MockERC20
/// @notice A simple ERC20 token for testing purposes
/// @dev Includes mint and burn functions for testing
contract MockERC20 is IERC20Metadata {
    string private _name;
    string private _symbol;
    uint8 private _decimals;
    uint256 private _totalSupply;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    /// @notice Initializes the mock token
    /// @param name_ Token name
    /// @param symbol_ Token symbol
    /// @param decimals_ Token decimals
    /// @param initialSupply Initial supply to mint to deployer
    constructor(string memory name_, string memory symbol_, uint8 decimals_, uint256 initialSupply) {
        _name = name_;
        _symbol = symbol_;
        _decimals = decimals_;

        if (initialSupply > 0) {
            _mint(msg.sender, initialSupply);
        }
    }

    /// @notice Returns the token name
    function name() external view override returns (string memory) {
        return _name;
    }

    /// @notice Returns the token symbol
    function symbol() external view override returns (string memory) {
        return _symbol;
    }

    /// @notice Returns the token decimals
    function decimals() external view override returns (uint8) {
        return _decimals;
    }

    /// @notice Returns the total supply
    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    /// @notice Returns the balance of an account
    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    /// @notice Transfers tokens to a recipient
    function transfer(address to, uint256 amount) external override returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    /// @notice Returns the allowance for a spender
    function allowance(address owner, address spender) external view override returns (uint256) {
        return _allowances[owner][spender];
    }

    /// @notice Approves a spender to spend tokens
    function approve(address spender, uint256 amount) external override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    /// @notice Transfers tokens from one address to another
    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= amount, "ERC20: insufficient allowance");
            unchecked {
                _approve(from, msg.sender, currentAllowance - amount);
            }
        }
        _transfer(from, to, amount);
        return true;
    }

    /// @notice Mints tokens to an address (for testing)
    /// @param to Address to mint to
    /// @param amount Amount to mint
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Burns tokens from an address (for testing)
    /// @param from Address to burn from
    /// @param amount Amount to burn
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }

    /// @dev Internal transfer function
    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");

        uint256 fromBalance = _balances[from];
        require(fromBalance >= amount, "ERC20: transfer amount exceeds balance");
        unchecked {
            _balances[from] = fromBalance - amount;
            _balances[to] += amount;
        }

        emit Transfer(from, to, amount);
    }

    /// @dev Internal mint function
    function _mint(address to, uint256 amount) internal {
        require(to != address(0), "ERC20: mint to the zero address");

        _totalSupply += amount;
        unchecked {
            _balances[to] += amount;
        }

        emit Transfer(address(0), to, amount);
    }

    /// @dev Internal burn function
    function _burn(address from, uint256 amount) internal {
        require(from != address(0), "ERC20: burn from the zero address");

        uint256 fromBalance = _balances[from];
        require(fromBalance >= amount, "ERC20: burn amount exceeds balance");
        unchecked {
            _balances[from] = fromBalance - amount;
            _totalSupply -= amount;
        }

        emit Transfer(from, address(0), amount);
    }

    /// @dev Internal approve function
    function _approve(address owner, address spender, uint256 amount) internal {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }
}
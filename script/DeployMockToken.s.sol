// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";

/// @title DeployMockTokenScript
/// @notice Deploys a MockERC20 (test stablecoin) and mints initial supply to the deployer
/// @dev Required env vars:
///        PRIVATE_KEY          — deployer private key
///      Optional env vars:
///        TOKEN_NAME           — token name (default "Mock USDC")
///        TOKEN_SYMBOL         — token symbol (default "mUSDC")
///        TOKEN_DECIMALS       — token decimals (default 6)
///        TOKEN_INITIAL_SUPPLY — supply in WHOLE units, scaled by decimals (default 1_000_000)
/// @dev Example:
///        forge script script/DeployMockToken.s.sol:DeployMockTokenScript \
///          --rpc-url $RPC_URL --broadcast
contract DeployMockTokenScript is Script {
    function run() external returns (MockERC20 token) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        string memory name = vm.envOr("TOKEN_NAME", string("Mock USDC"));
        string memory symbol = vm.envOr("TOKEN_SYMBOL", string("mUSDC"));
        uint8 decimals = uint8(vm.envOr("TOKEN_DECIMALS", uint256(6)));
        uint256 supplyWhole = vm.envOr("TOKEN_INITIAL_SUPPLY", uint256(1_000_000));
        uint256 initialSupply = supplyWhole * (10 ** decimals);

        console.log("=== DeployMockTokenScript ===");
        console.log("Deployer:       ", deployer);
        console.log("Name:           ", name);
        console.log("Symbol:         ", symbol);
        console.log("Decimals:       ", uint256(decimals));
        console.log("Initial supply: ", initialSupply);

        vm.startBroadcast(deployerKey);
        token = new MockERC20(name, symbol, decimals, initialSupply);
        vm.stopBroadcast();

        console.log("MockERC20 deployed at:", address(token));
    }
}

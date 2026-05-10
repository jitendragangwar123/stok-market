// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";
import {IERC20Metadata} from "../src/interfaces/IERC20.sol";

/// @title DeployScript
/// @notice Deploys the PredictionMarket contract
/// @dev Required env vars:
///        PRIVATE_KEY        — deployer private key
///        STABLECOIN_ADDRESS — ERC20 stablecoin address used for betting
///      Optional env vars:
///        ADMIN_ADDRESS      — admin (defaults to deployer)
///        FEE_RECIPIENT      — fee recipient (defaults to deployer)
///        MAX_FEE_BPS        — max fee in basis points (defaults to 500 = 5%)
/// @dev Example:
///        forge script script/Deploy.s.sol:DeployScript --rpc-url $RPC_URL --broadcast
contract DeployScript is Script {
    function run() external returns (PredictionMarket market) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address stablecoin = vm.envAddress("STABLECOIN_ADDRESS");
        uint8 decimals = IERC20Metadata(stablecoin).decimals();

        address admin = vm.envOr("ADMIN_ADDRESS", deployer);
        address feeRecipient = vm.envOr("FEE_RECIPIENT", deployer);
        uint256 maxFeeBps = vm.envOr("MAX_FEE_BPS", uint256(500));

        console.log("=== DeployScript ===");
        console.log("Deployer:           ", deployer);
        console.log("Stablecoin:         ", stablecoin);
        console.log("Stablecoin decimals:", uint256(decimals));
        console.log("Admin:              ", admin);
        console.log("Fee recipient:      ", feeRecipient);
        console.log("Max fee (bps):      ", maxFeeBps);

        vm.startBroadcast(deployerKey);
        market = new PredictionMarket(stablecoin, decimals, admin, feeRecipient, maxFeeBps);
        vm.stopBroadcast();

        console.log("PredictionMarket deployed at:", address(market));
    }
}

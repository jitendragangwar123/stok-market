// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";

/// @title CreateMarketScript
/// @notice Creates a new prediction market on a deployed PredictionMarket contract
/// @dev Required env vars:
///        PRIVATE_KEY            — creator private key
///        PREDICTION_MARKET      — PredictionMarket contract address
///        MARKET_QUESTION        — market question text
///        MARKET_RESOLUTION_TIME — unix timestamp when betting closes
///      Optional env vars:
///        MARKET_CREATION_FEE    — creation fee with token decimals (default 0)
/// @dev Example:
///        forge script script/CreateMarket.s.sol:CreateMarketScript \
///          --rpc-url $RPC_URL --broadcast
contract CreateMarketScript is Script {
    function run() external returns (uint256 marketId) {
        uint256 creatorKey = vm.envUint("PRIVATE_KEY");
        address creator = vm.addr(creatorKey);

        PredictionMarket market = PredictionMarket(vm.envAddress("PREDICTION_MARKET"));
        string memory question = vm.envString("MARKET_QUESTION");
        uint256 resolutionTime = vm.envUint("MARKET_RESOLUTION_TIME");
        uint256 fee = vm.envOr("MARKET_CREATION_FEE", uint256(0));

        require(resolutionTime > block.timestamp, "MARKET_RESOLUTION_TIME must be in the future");

        console.log("=== CreateMarketScript ===");
        console.log("Creator:         ", creator);
        console.log("PredictionMarket:", address(market));
        console.log("Question:        ", question);
        console.log("Resolution time: ", resolutionTime);
        console.log("Creation fee:    ", fee);

        vm.startBroadcast(creatorKey);

        if (fee > 0) {
            IERC20 stablecoin = market.stablecoin();
            stablecoin.approve(address(market), fee);
        }

        marketId = market.createMarket(question, resolutionTime, fee);
        vm.stopBroadcast();

        console.log("Market created with ID:", marketId);
    }
}

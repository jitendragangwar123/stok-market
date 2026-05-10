// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {PredictionMarket} from "../src/PredictionMarket.sol";
import {IERC20} from "../src/interfaces/IERC20.sol";

/// @title InteractScript
/// @notice User and admin interactions with a deployed PredictionMarket
/// @dev Common env vars (write actions): PRIVATE_KEY, PREDICTION_MARKET
///      Outcome encoding: 1 = Yes, 2 = No
///
/// Examples (all require --rpc-url $RPC_URL --broadcast for state-changing calls):
///
///   Place a bet (env: MARKET_ID, BET_OUTCOME, BET_AMOUNT):
///     forge script script/Interact.s.sol:InteractScript --sig "placeBet()"
///
///   Claim winnings (env: MARKET_ID):
///     forge script script/Interact.s.sol:InteractScript --sig "claim()"
///
///   Claim multiple (env: MARKET_IDS as comma-separated, e.g. "1,2,3"):
///     forge script script/Interact.s.sol:InteractScript --sig "claimMultiple()"
///
///   Admin resolve (env: MARKET_ID, RESOLVE_OUTCOME):
///     forge script script/Interact.s.sol:InteractScript --sig "resolve()"
///
///   Admin cancel (env: MARKET_ID):
///     forge script script/Interact.s.sol:InteractScript --sig "cancel()"
///
///   Permissionless emergency cancel after grace period (env: MARKET_ID):
///     forge script script/Interact.s.sol:InteractScript --sig "emergencyCancel()"
///
///   View market — read-only, broadcast not needed (env: MARKET_ID, optional USER_ADDRESS):
///     forge script script/Interact.s.sol:InteractScript --sig "viewMarket()"
contract InteractScript is Script {
    function _market() internal view returns (PredictionMarket) {
        return PredictionMarket(vm.envAddress("PREDICTION_MARKET"));
    }

    function _key() internal view returns (uint256) {
        return vm.envUint("PRIVATE_KEY");
    }

    /// @notice Place a bet. Env: MARKET_ID, BET_OUTCOME (1=Yes,2=No), BET_AMOUNT (with decimals)
    function placeBet() external {
        uint256 key = _key();
        PredictionMarket market = _market();

        uint256 marketId = vm.envUint("MARKET_ID");
        uint8 outcome = uint8(vm.envUint("BET_OUTCOME"));
        uint256 amount = vm.envUint("BET_AMOUNT");
        require(outcome == 1 || outcome == 2, "BET_OUTCOME must be 1 (Yes) or 2 (No)");

        console.log("=== placeBet ===");
        console.log("Bettor:    ", vm.addr(key));
        console.log("Market ID: ", marketId);
        console.log("Outcome:   ", outcome == 1 ? "Yes" : "No");
        console.log("Amount:    ", amount);

        vm.startBroadcast(key);
        market.stablecoin().approve(address(market), amount);
        market.placeBet(marketId, PredictionMarket.Outcome(outcome), amount);
        vm.stopBroadcast();

        console.log("Bet placed.");
    }

    /// @notice Claim winnings. Env: MARKET_ID
    function claim() external {
        uint256 key = _key();
        uint256 marketId = vm.envUint("MARKET_ID");

        console.log("=== claim ===");
        console.log("Caller:    ", vm.addr(key));
        console.log("Market ID: ", marketId);

        vm.startBroadcast(key);
        _market().claimWinnings(marketId);
        vm.stopBroadcast();

        console.log("Claim submitted.");
    }

    /// @notice Claim across multiple markets. Env: MARKET_IDS as comma-separated list, e.g. "1,2,3"
    function claimMultiple() external {
        uint256 key = _key();
        uint256[] memory ids = vm.envUint("MARKET_IDS", ",");

        console.log("=== claimMultiple ===");
        console.log("Caller:        ", vm.addr(key));
        console.log("Market count:  ", ids.length);

        vm.startBroadcast(key);
        _market().claimMultipleWinnings(ids);
        vm.stopBroadcast();

        console.log("Batch claim submitted.");
    }

    /// @notice Admin: resolve a market. Env: MARKET_ID, RESOLVE_OUTCOME (1=Yes,2=No)
    function resolve() external {
        uint256 key = _key();
        uint256 marketId = vm.envUint("MARKET_ID");
        uint8 outcome = uint8(vm.envUint("RESOLVE_OUTCOME"));
        require(outcome == 1 || outcome == 2, "RESOLVE_OUTCOME must be 1 (Yes) or 2 (No)");

        console.log("=== resolve ===");
        console.log("Admin:     ", vm.addr(key));
        console.log("Market ID: ", marketId);
        console.log("Outcome:   ", outcome == 1 ? "Yes" : "No");

        vm.startBroadcast(key);
        _market().resolveMarket(marketId, PredictionMarket.Outcome(outcome));
        vm.stopBroadcast();

        console.log("Resolved.");
    }

    /// @notice Admin: cancel a market (post resolutionTime). Env: MARKET_ID
    function cancel() external {
        uint256 key = _key();
        uint256 marketId = vm.envUint("MARKET_ID");

        console.log("=== cancel ===");
        console.log("Admin:     ", vm.addr(key));
        console.log("Market ID: ", marketId);

        vm.startBroadcast(key);
        _market().cancelMarket(marketId);
        vm.stopBroadcast();

        console.log("Cancelled.");
    }

    /// @notice Permissionless emergency cancel after EMERGENCY_CANCEL_GRACE_PERIOD. Env: MARKET_ID
    function emergencyCancel() external {
        uint256 key = _key();
        uint256 marketId = vm.envUint("MARKET_ID");

        console.log("=== emergencyCancel ===");
        console.log("Caller:    ", vm.addr(key));
        console.log("Market ID: ", marketId);

        vm.startBroadcast(key);
        _market().emergencyCancel(marketId);
        vm.stopBroadcast();

        console.log("Emergency cancellation submitted.");
    }

    /// @notice Read-only: print a market's state. Env: MARKET_ID, optional USER_ADDRESS to also print position.
    function viewMarket() external view {
        PredictionMarket market = _market();
        uint256 marketId = vm.envUint("MARKET_ID");

        PredictionMarket.Market memory m = market.getMarket(marketId);
        console.log("=== Market ===");
        console.log("ID:              ", m.id);
        console.log("Question:        ", m.question);
        console.log("Resolution time: ", m.resolutionTime);
        console.log("State:           ", _stateName(m.state));
        console.log("Winning outcome: ", _outcomeName(m.winningOutcome));
        console.log("YES pool:        ", m.yesPool);
        console.log("NO pool:         ", m.noPool);
        console.log("Creator:         ", m.creator);
        console.log("Created at:      ", m.createdAt);

        address user = vm.envOr("USER_ADDRESS", address(0));
        if (user != address(0)) {
            PredictionMarket.UserPosition memory p = market.getUserPosition(marketId, user);
            console.log("=== Position ===");
            console.log("User:            ", user);
            console.log("YES bet:         ", p.yesBet);
            console.log("NO bet:          ", p.noBet);
            console.log("Claimed:         ", p.claimed);

            uint256 payout = market.calculatePayout(marketId, user);
            console.log("Pending payout:  ", payout);
        }
    }

    function _stateName(PredictionMarket.MarketState s) internal pure returns (string memory) {
        if (s == PredictionMarket.MarketState.Active) return "Active";
        if (s == PredictionMarket.MarketState.Resolved) return "Resolved";
        return "Cancelled";
    }

    function _outcomeName(PredictionMarket.Outcome o) internal pure returns (string memory) {
        if (o == PredictionMarket.Outcome.Yes) return "Yes";
        if (o == PredictionMarket.Outcome.No) return "No";
        return "None";
    }
}

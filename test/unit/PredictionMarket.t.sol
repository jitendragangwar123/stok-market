// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {PredictionMarket} from "../../src/PredictionMarket.sol";
import {MockERC20} from "../../src/mocks/MockERC20.sol";
import {IERC20} from "../../src/interfaces/IERC20.sol";



/// @title PredictionMarketTest
/// @notice Comprehensive unit tests for PredictionMarket
contract PredictionMarketTest is Test {
    PredictionMarket internal pm;
    MockERC20 internal token;

    address internal admin = makeAddr("admin");
    address internal feeRecipient = makeAddr("feeRecipient");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal dave = makeAddr("dave");
    address internal stranger = makeAddr("stranger");

    uint8 internal constant DECIMALS = 6;
    uint256 internal constant ONE = 10 ** DECIMALS; // 1 token
    uint256 internal constant MINT_AMOUNT = 1_000_000 * ONE;
    uint256 internal constant MAX_FEE_BPS = 500;

    // Events (must match the contract exactly to be expectable)
    event MarketCreated(
        uint256 indexed marketId, string question, uint256 resolutionTime, address indexed creator, uint256 fee
    );
    event MarketResolved(
        uint256 indexed marketId,
        PredictionMarket.Outcome winningOutcome,
        uint256 yesPool,
        uint256 noPool,
        uint256 timestamp
    );
    event MarketCancelled(uint256 indexed marketId, uint256 yesPool, uint256 noPool, uint256 timestamp);
    event BetPlaced(
        uint256 indexed marketId,
        address indexed bettor,
        PredictionMarket.Outcome outcome,
        uint256 amount,
        uint256 timestamp
    );
    event WinningsClaimed(uint256 indexed marketId, address indexed bettor, uint256 amount, uint256 timestamp);
    event ConfigUpdated(address indexed admin, address feeRecipient, uint256 maxFeePercentage);
    event ContractPaused(address indexed admin);
    event ContractUnpaused(address indexed admin);

    function setUp() public virtual {
        token = new MockERC20("Mock USDC", "mUSDC", DECIMALS, 0);
        pm = new PredictionMarket(address(token), DECIMALS, admin, feeRecipient, MAX_FEE_BPS);

        // Fund users
        token.mint(alice, MINT_AMOUNT);
        token.mint(bob, MINT_AMOUNT);
        token.mint(carol, MINT_AMOUNT);
        token.mint(dave, MINT_AMOUNT);
    }

    // ============ Helpers ============

    function _approve(address user, uint256 amount) internal {
        vm.prank(user);
        token.approve(address(pm), amount);
    }

    function _createMarket(string memory question, uint256 secondsUntilEnd) internal returns (uint256 marketId) {
        vm.prank(alice);
        marketId = pm.createMarket(question, block.timestamp + secondsUntilEnd, 0);
    }

    function _placeBet(address user, uint256 marketId, PredictionMarket.Outcome outcome, uint256 amount) internal {
        _approve(user, amount);
        vm.prank(user);
        pm.placeBet(marketId, outcome, amount);
    }

    function _setupResolvedYesMarket(uint256 yesAmt, uint256 noAmt) internal returns (uint256 marketId) {
        marketId = _createMarket("Will it rain?", 1 days);
        _placeBet(alice, marketId, PredictionMarket.Outcome.Yes, yesAmt);
        _placeBet(bob, marketId, PredictionMarket.Outcome.No, noAmt);
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(admin);
        pm.resolveMarket(marketId, PredictionMarket.Outcome.Yes);
    }
}

// ============================================================
//                 Constructor
// ============================================================
contract ConstructorTests is PredictionMarketTest {
    function test_Constructor_DeploysWithCorrectConfig() public view {
        PredictionMarket.Config memory cfg = pm.getConfig();
        assertEq(cfg.admin, admin);
        assertEq(cfg.feeRecipient, feeRecipient);
        assertEq(cfg.maxFeePercentage, MAX_FEE_BPS);
        assertFalse(cfg.paused);
        assertEq(address(pm.stablecoin()), address(token));
        assertEq(pm.stablecoinDecimals(), DECIMALS);
        assertEq(pm.marketCounter(), 0);
    }

    function test_Constructor_RevertsOnZeroStablecoin() public {
        vm.expectRevert(PredictionMarket.InvalidMarket.selector);
        new PredictionMarket(address(0), DECIMALS, admin, feeRecipient, MAX_FEE_BPS);
    }

    function test_Constructor_RevertsOnZeroAdmin() public {
        vm.expectRevert(PredictionMarket.NotAdmin.selector);
        new PredictionMarket(address(token), DECIMALS, address(0), feeRecipient, MAX_FEE_BPS);
    }

    function test_Constructor_RevertsOnZeroFeeRecipient() public {
        vm.expectRevert(PredictionMarket.InvalidAddress.selector);
        new PredictionMarket(address(token), DECIMALS, admin, address(0), MAX_FEE_BPS);
    }

    function test_Constructor_RevertsOnFeeOverLimit() public {
        uint256 limit = pm.MAX_FEE_LIMIT();
        vm.expectRevert(PredictionMarket.InvalidFee.selector);
        new PredictionMarket(address(token), DECIMALS, admin, feeRecipient, limit + 1);
    }

    function test_Constructor_AcceptsMaxFee() public {
        uint256 limit = pm.MAX_FEE_LIMIT();
        PredictionMarket p = new PredictionMarket(address(token), DECIMALS, admin, feeRecipient, limit);
        assertEq(p.getConfig().maxFeePercentage, limit);
    }
}

// ============================================================
//                 updateConfig / pause / unpause
// ============================================================
contract AdminConfigTests is PredictionMarketTest {
    function test_UpdateConfig_Succeeds() public {
        address newRecipient = makeAddr("newRecipient");
        uint256 newFee = 250;

        vm.expectEmit(true, false, false, true);
        emit ConfigUpdated(admin, newRecipient, newFee);

        vm.prank(admin);
        pm.updateConfig(newRecipient, newFee);

        PredictionMarket.Config memory cfg = pm.getConfig();
        assertEq(cfg.feeRecipient, newRecipient);
        assertEq(cfg.maxFeePercentage, newFee);
    }

    function test_UpdateConfig_RevertsForNonAdmin() public {
        vm.expectRevert(PredictionMarket.NotAdmin.selector);
        vm.prank(stranger);
        pm.updateConfig(stranger, 100);
    }

    function test_UpdateConfig_RevertsOnZeroRecipient() public {
        vm.expectRevert(PredictionMarket.InvalidAddress.selector);
        vm.prank(admin);
        pm.updateConfig(address(0), 100);
    }

    function test_UpdateConfig_RevertsOnFeeOverLimit() public {
        uint256 limit = pm.MAX_FEE_LIMIT();
        vm.expectRevert(PredictionMarket.InvalidFee.selector);
        vm.prank(admin);
        pm.updateConfig(feeRecipient, limit + 1);
    }

    function test_Pause_Succeeds() public {
        vm.expectEmit(true, false, false, false);
        emit ContractPaused(admin);

        vm.prank(admin);
        pm.pause();

        assertTrue(pm.getConfig().paused);
    }

    function test_Pause_RevertsForNonAdmin() public {
        vm.expectRevert(PredictionMarket.NotAdmin.selector);
        vm.prank(stranger);
        pm.pause();
    }

    function test_Pause_RevertsIfAlreadyPaused() public {
        vm.prank(admin);
        pm.pause();

        vm.expectRevert(PredictionMarket.AlreadyPaused.selector);
        vm.prank(admin);
        pm.pause();
    }

    function test_Unpause_Succeeds() public {
        vm.startPrank(admin);
        pm.pause();

        vm.expectEmit(true, false, false, false);
        emit ContractUnpaused(admin);
        pm.unpause();
        vm.stopPrank();

        assertFalse(pm.getConfig().paused);
    }

    function test_Unpause_RevertsForNonAdmin() public {
        vm.prank(admin);
        pm.pause();

        vm.expectRevert(PredictionMarket.NotAdmin.selector);
        vm.prank(stranger);
        pm.unpause();
    }

    function test_Unpause_RevertsIfNotPaused() public {
        vm.expectRevert(PredictionMarket.NotPaused.selector);
        vm.prank(admin);
        pm.unpause();
    }
}

// ============================================================
//                 createMarket
// ============================================================
contract CreateMarketTests is PredictionMarketTest {
    function test_CreateMarket_NoFee_Succeeds() public {
        uint256 endTime = block.timestamp + 1 days;

        vm.expectEmit(true, false, false, true);
        emit MarketCreated(1, "Q?", endTime, alice, 0);

        vm.prank(alice);
        uint256 id = pm.createMarket("Q?", endTime, 0);

        assertEq(id, 1);
        assertEq(pm.marketCounter(), 1);

        PredictionMarket.Market memory m = pm.getMarket(id);
        assertEq(m.id, 1);
        assertEq(m.question, "Q?");
        assertEq(m.resolutionTime, endTime);
        assertEq(uint256(m.state), uint256(PredictionMarket.MarketState.Active));
        assertEq(uint256(m.winningOutcome), uint256(PredictionMarket.Outcome.None));
        assertEq(m.yesPool, 0);
        assertEq(m.noPool, 0);
        assertEq(m.creationFee, 0);
        assertEq(m.creator, alice);
        assertEq(m.createdAt, block.timestamp);
        assertEq(m.configSnapshot.feeRecipient, feeRecipient);
        assertEq(m.configSnapshot.maxFeePercentage, MAX_FEE_BPS);
    }

    function test_CreateMarket_WithFee_TransfersFee() public {
        uint256 fee = 5 * ONE;
        _approve(alice, fee);

        uint256 aliceBalBefore = token.balanceOf(alice);
        uint256 recipientBalBefore = token.balanceOf(feeRecipient);

        vm.prank(alice);
        pm.createMarket("Q?", block.timestamp + 1 days, fee);

        assertEq(token.balanceOf(alice), aliceBalBefore - fee);
        assertEq(token.balanceOf(feeRecipient), recipientBalBefore + fee);
    }

    function test_CreateMarket_RevertsOnEmptyQuestion() public {
        vm.expectRevert(PredictionMarket.EmptyQuestion.selector);
        vm.prank(alice);
        pm.createMarket("", block.timestamp + 1 days, 0);
    }

    function test_CreateMarket_RevertsOnPastResolutionTime() public {
        vm.expectRevert(PredictionMarket.InvalidResolutionTime.selector);
        vm.prank(alice);
        pm.createMarket("Q?", block.timestamp, 0);
    }

    function test_CreateMarket_RevertsWhenPaused() public {
        vm.prank(admin);
        pm.pause();

        vm.expectRevert(PredictionMarket.Paused.selector);
        vm.prank(alice);
        pm.createMarket("Q?", block.timestamp + 1 days, 0);
    }

    function test_CreateMarket_RevertsOnInsufficientBalance() public {
        uint256 fee = MINT_AMOUNT + 1;
        _approve(alice, fee);

        vm.expectRevert(PredictionMarket.InsufficientBalance.selector);
        vm.prank(alice);
        pm.createMarket("Q?", block.timestamp + 1 days, fee);
    }

    function test_CreateMarket_RevertsOnInsufficientAllowance() public {
        uint256 fee = 5 * ONE;
        // No approval

        vm.expectRevert(PredictionMarket.InsufficientAllowance.selector);
        vm.prank(alice);
        pm.createMarket("Q?", block.timestamp + 1 days, fee);
    }

    function test_CreateMarket_IncrementsCounterAcrossMultiple() public {
        _createMarket("Q1", 1 days);
        _createMarket("Q2", 1 days);
        uint256 id3 = _createMarket("Q3", 1 days);

        assertEq(id3, 3);
        assertEq(pm.marketCounter(), 3);
    }
}

// ============================================================
//                 placeBet
// ============================================================
contract PlaceBetTests is PredictionMarketTest {
    uint256 internal mid;

    function setUp() public override {
        super.setUp();
        mid = _createMarket("Will it rain?", 1 days);
    }

    function test_PlaceBet_Yes_Succeeds() public {
        uint256 amount = 10 * ONE;
        _approve(alice, amount);

        vm.expectEmit(true, true, false, true);
        emit BetPlaced(mid, alice, PredictionMarket.Outcome.Yes, amount, block.timestamp);

        vm.prank(alice);
        pm.placeBet(mid, PredictionMarket.Outcome.Yes, amount);

        PredictionMarket.Market memory m = pm.getMarket(mid);
        assertEq(m.yesPool, amount);
        assertEq(m.noPool, 0);

        PredictionMarket.UserPosition memory p = pm.getUserPosition(mid, alice);
        assertEq(p.yesBet, amount);
        assertEq(p.noBet, 0);
        assertFalse(p.claimed);

        assertEq(token.balanceOf(address(pm)), amount);
    }

    function test_PlaceBet_No_Succeeds() public {
        _placeBet(bob, mid, PredictionMarket.Outcome.No, 7 * ONE);

        PredictionMarket.Market memory m = pm.getMarket(mid);
        assertEq(m.yesPool, 0);
        assertEq(m.noPool, 7 * ONE);
    }

    function test_PlaceBet_AccumulatesAcrossSameUser() public {
        _placeBet(alice, mid, PredictionMarket.Outcome.Yes, 3 * ONE);
        _placeBet(alice, mid, PredictionMarket.Outcome.Yes, 4 * ONE);
        _placeBet(alice, mid, PredictionMarket.Outcome.No, 1 * ONE);

        PredictionMarket.UserPosition memory p = pm.getUserPosition(mid, alice);
        assertEq(p.yesBet, 7 * ONE);
        assertEq(p.noBet, 1 * ONE);

        PredictionMarket.Market memory m = pm.getMarket(mid);
        assertEq(m.yesPool, 7 * ONE);
        assertEq(m.noPool, 1 * ONE);
    }

    function test_PlaceBet_RevertsOnZeroAmount() public {
        vm.expectRevert(PredictionMarket.ZeroAmount.selector);
        vm.prank(alice);
        pm.placeBet(mid, PredictionMarket.Outcome.Yes, 0);
    }

    function test_PlaceBet_RevertsOnInvalidOutcome() public {
        vm.expectRevert(PredictionMarket.InvalidOutcome.selector);
        vm.prank(alice);
        pm.placeBet(mid, PredictionMarket.Outcome.None, 1 * ONE);
    }

    function test_PlaceBet_RevertsOnNonExistentMarket() public {
        vm.expectRevert(PredictionMarket.InvalidMarket.selector);
        vm.prank(alice);
        pm.placeBet(0, PredictionMarket.Outcome.Yes, 1 * ONE);

        vm.expectRevert(PredictionMarket.InvalidMarket.selector);
        vm.prank(alice);
        pm.placeBet(999, PredictionMarket.Outcome.Yes, 1 * ONE);
    }

    function test_PlaceBet_RevertsAfterResolutionTime() public {
        vm.warp(block.timestamp + 1 days + 1);
        _approve(alice, 1 * ONE);
        vm.expectRevert(PredictionMarket.MarketExpired.selector);
        vm.prank(alice);
        pm.placeBet(mid, PredictionMarket.Outcome.Yes, 1 * ONE);
    }

    function test_PlaceBet_RevertsAtExactResolutionTime() public {
        PredictionMarket.Market memory m = pm.getMarket(mid);
        vm.warp(m.resolutionTime);
        _approve(alice, 1 * ONE);
        vm.expectRevert(PredictionMarket.MarketExpired.selector);
        vm.prank(alice);
        pm.placeBet(mid, PredictionMarket.Outcome.Yes, 1 * ONE);
    }

    function test_PlaceBet_RevertsWhenPaused() public {
        vm.prank(admin);
        pm.pause();

        _approve(alice, 1 * ONE);
        vm.expectRevert(PredictionMarket.Paused.selector);
        vm.prank(alice);
        pm.placeBet(mid, PredictionMarket.Outcome.Yes, 1 * ONE);
    }

    function test_PlaceBet_RevertsWhenMarketResolved() public {
        _placeBet(alice, mid, PredictionMarket.Outcome.Yes, 1 * ONE);
        _placeBet(bob, mid, PredictionMarket.Outcome.No, 1 * ONE);
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(admin);
        pm.resolveMarket(mid, PredictionMarket.Outcome.Yes);

        // Need to rewind beyond resolution check — but state check fires first only if state != Active.
        // Here state is Resolved so MarketNotActive fires. But block.timestamp >= resolutionTime so MarketExpired
        // would also be true. The state check happens first.
        _approve(carol, 1 * ONE);
        vm.expectRevert(PredictionMarket.MarketNotActive.selector);
        vm.prank(carol);
        pm.placeBet(mid, PredictionMarket.Outcome.Yes, 1 * ONE);
    }

    function test_PlaceBet_RevertsOnInsufficientBalance() public {
        _approve(alice, MINT_AMOUNT + 1);
        vm.expectRevert(PredictionMarket.InsufficientBalance.selector);
        vm.prank(alice);
        pm.placeBet(mid, PredictionMarket.Outcome.Yes, MINT_AMOUNT + 1);
    }

    function test_PlaceBet_RevertsOnInsufficientAllowance() public {
        // No approval at all
        vm.expectRevert(PredictionMarket.InsufficientAllowance.selector);
        vm.prank(alice);
        pm.placeBet(mid, PredictionMarket.Outcome.Yes, 1 * ONE);
    }
}

// ============================================================
//                 resolveMarket
// ============================================================
contract ResolveMarketTests is PredictionMarketTest {
    uint256 internal mid;

    function setUp() public override {
        super.setUp();
        mid = _createMarket("Will it rain?", 1 days);
    }

    function test_ResolveMarket_Yes_Succeeds() public {
        _placeBet(alice, mid, PredictionMarket.Outcome.Yes, 10 * ONE);
        _placeBet(bob, mid, PredictionMarket.Outcome.No, 5 * ONE);
        vm.warp(block.timestamp + 1 days + 1);

        vm.expectEmit(true, false, false, true);
        emit MarketResolved(mid, PredictionMarket.Outcome.Yes, 10 * ONE, 5 * ONE, block.timestamp);

        vm.prank(admin);
        pm.resolveMarket(mid, PredictionMarket.Outcome.Yes);

        PredictionMarket.Market memory m = pm.getMarket(mid);
        assertEq(uint256(m.state), uint256(PredictionMarket.MarketState.Resolved));
        assertEq(uint256(m.winningOutcome), uint256(PredictionMarket.Outcome.Yes));
    }

    function test_ResolveMarket_No_Succeeds() public {
        _placeBet(alice, mid, PredictionMarket.Outcome.Yes, 10 * ONE);
        _placeBet(bob, mid, PredictionMarket.Outcome.No, 5 * ONE);
        vm.warp(block.timestamp + 1 days + 1);

        vm.prank(admin);
        pm.resolveMarket(mid, PredictionMarket.Outcome.No);

        PredictionMarket.Market memory m = pm.getMarket(mid);
        assertEq(uint256(m.winningOutcome), uint256(PredictionMarket.Outcome.No));
    }

    function test_ResolveMarket_RevertsForNonAdmin() public {
        vm.warp(block.timestamp + 1 days + 1);
        vm.expectRevert(PredictionMarket.NotAdmin.selector);
        vm.prank(stranger);
        pm.resolveMarket(mid, PredictionMarket.Outcome.Yes);
    }

    function test_ResolveMarket_RevertsBeforeResolutionTime() public {
        _placeBet(alice, mid, PredictionMarket.Outcome.Yes, 1 * ONE);
        _placeBet(bob, mid, PredictionMarket.Outcome.No, 1 * ONE);

        vm.expectRevert(PredictionMarket.MarketNotActive.selector);
        vm.prank(admin);
        pm.resolveMarket(mid, PredictionMarket.Outcome.Yes);
    }

    function test_ResolveMarket_RevertsOnInvalidOutcome() public {
        _placeBet(alice, mid, PredictionMarket.Outcome.Yes, 1 * ONE);
        _placeBet(bob, mid, PredictionMarket.Outcome.No, 1 * ONE);
        vm.warp(block.timestamp + 1 days + 1);

        vm.expectRevert(PredictionMarket.InvalidOutcome.selector);
        vm.prank(admin);
        pm.resolveMarket(mid, PredictionMarket.Outcome.None);
    }

    function test_ResolveMarket_RevertsOnInvalidMarketId() public {
        vm.expectRevert(PredictionMarket.InvalidMarket.selector);
        vm.prank(admin);
        pm.resolveMarket(0, PredictionMarket.Outcome.Yes);

        vm.expectRevert(PredictionMarket.InvalidMarket.selector);
        vm.prank(admin);
        pm.resolveMarket(999, PredictionMarket.Outcome.Yes);
    }

    function test_ResolveMarket_RevertsIfAlreadyResolved() public {
        _placeBet(alice, mid, PredictionMarket.Outcome.Yes, 1 * ONE);
        _placeBet(bob, mid, PredictionMarket.Outcome.No, 1 * ONE);
        vm.warp(block.timestamp + 1 days + 1);

        vm.prank(admin);
        pm.resolveMarket(mid, PredictionMarket.Outcome.Yes);

        vm.expectRevert(PredictionMarket.MarketAlreadyFinalized.selector);
        vm.prank(admin);
        pm.resolveMarket(mid, PredictionMarket.Outcome.No);
    }

    function test_ResolveMarket_AutoCancelsWhenYesPoolEmpty() public {
        _placeBet(bob, mid, PredictionMarket.Outcome.No, 5 * ONE);
        vm.warp(block.timestamp + 1 days + 1);

        vm.expectEmit(true, false, false, true);
        emit MarketCancelled(mid, 0, 5 * ONE, block.timestamp);

        vm.prank(admin);
        pm.resolveMarket(mid, PredictionMarket.Outcome.Yes);

        PredictionMarket.Market memory m = pm.getMarket(mid);
        assertEq(uint256(m.state), uint256(PredictionMarket.MarketState.Cancelled));
    }

    function test_ResolveMarket_AutoCancelsWhenNoPoolEmpty() public {
        _placeBet(alice, mid, PredictionMarket.Outcome.Yes, 5 * ONE);
        vm.warp(block.timestamp + 1 days + 1);

        vm.prank(admin);
        pm.resolveMarket(mid, PredictionMarket.Outcome.Yes);

        PredictionMarket.Market memory m = pm.getMarket(mid);
        assertEq(uint256(m.state), uint256(PredictionMarket.MarketState.Cancelled));
    }

    function test_ResolveMarket_AutoCancelRefundsBettors() public {
        _placeBet(alice, mid, PredictionMarket.Outcome.Yes, 5 * ONE);
        vm.warp(block.timestamp + 1 days + 1);

        vm.prank(admin);
        pm.resolveMarket(mid, PredictionMarket.Outcome.Yes);

        uint256 balBefore = token.balanceOf(alice);
        vm.prank(alice);
        pm.claimWinnings(mid);
        assertEq(token.balanceOf(alice), balBefore + 5 * ONE);
    }
}

// ============================================================
//                 cancelMarket
// ============================================================
contract CancelMarketTests is PredictionMarketTest {
    uint256 internal mid;

    function setUp() public override {
        super.setUp();
        mid = _createMarket("Will it rain?", 1 days);
        _placeBet(alice, mid, PredictionMarket.Outcome.Yes, 5 * ONE);
        _placeBet(bob, mid, PredictionMarket.Outcome.No, 3 * ONE);
    }

    function test_CancelMarket_Succeeds() public {
        vm.warp(block.timestamp + 1 days + 1);

        vm.expectEmit(true, false, false, true);
        emit MarketCancelled(mid, 5 * ONE, 3 * ONE, block.timestamp);

        vm.prank(admin);
        pm.cancelMarket(mid);

        PredictionMarket.Market memory m = pm.getMarket(mid);
        assertEq(uint256(m.state), uint256(PredictionMarket.MarketState.Cancelled));
    }

    function test_CancelMarket_RevertsForNonAdmin() public {
        vm.warp(block.timestamp + 1 days + 1);
        vm.expectRevert(PredictionMarket.NotAdmin.selector);
        vm.prank(stranger);
        pm.cancelMarket(mid);
    }

    function test_CancelMarket_RevertsBeforeResolutionTime() public {
        vm.expectRevert(PredictionMarket.MarketNotActive.selector);
        vm.prank(admin);
        pm.cancelMarket(mid);
    }

    function test_CancelMarket_RevertsIfAlreadyFinalized() public {
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(admin);
        pm.cancelMarket(mid);

        vm.expectRevert(PredictionMarket.MarketAlreadyFinalized.selector);
        vm.prank(admin);
        pm.cancelMarket(mid);
    }

    function test_CancelMarket_RevertsOnInvalidMarketId() public {
        vm.expectRevert(PredictionMarket.InvalidMarket.selector);
        vm.prank(admin);
        pm.cancelMarket(999);
    }
}

// ============================================================
//                 emergencyCancel
// ============================================================
contract EmergencyCancelTests is PredictionMarketTest {
    uint256 internal mid;

    function setUp() public override {
        super.setUp();
        mid = _createMarket("Will it rain?", 1 days);
        _placeBet(alice, mid, PredictionMarket.Outcome.Yes, 5 * ONE);
        _placeBet(bob, mid, PredictionMarket.Outcome.No, 3 * ONE);
    }

    function test_EmergencyCancel_AnyoneCanCallAfterGracePeriod() public {
        vm.warp(block.timestamp + 1 days + pm.EMERGENCY_CANCEL_GRACE_PERIOD() + 1);

        vm.expectEmit(true, false, false, true);
        emit MarketCancelled(mid, 5 * ONE, 3 * ONE, block.timestamp);

        vm.prank(stranger);
        pm.emergencyCancel(mid);

        PredictionMarket.Market memory m = pm.getMarket(mid);
        assertEq(uint256(m.state), uint256(PredictionMarket.MarketState.Cancelled));
    }

    function test_EmergencyCancel_RevertsBeforeGracePeriod() public {
        // Just past resolutionTime, but before grace period elapses
        vm.warp(block.timestamp + 1 days + 1);

        vm.expectRevert(PredictionMarket.GracePeriodNotElapsed.selector);
        vm.prank(stranger);
        pm.emergencyCancel(mid);
    }

    function test_EmergencyCancel_RevertsAtExactGracePeriodBoundary() public {
        PredictionMarket.Market memory m = pm.getMarket(mid);
        vm.warp(m.resolutionTime + pm.EMERGENCY_CANCEL_GRACE_PERIOD() - 1);

        vm.expectRevert(PredictionMarket.GracePeriodNotElapsed.selector);
        vm.prank(stranger);
        pm.emergencyCancel(mid);
    }

    function test_EmergencyCancel_RevertsIfAlreadyResolved() public {
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(admin);
        pm.resolveMarket(mid, PredictionMarket.Outcome.Yes);

        vm.warp(block.timestamp + pm.EMERGENCY_CANCEL_GRACE_PERIOD() + 1);
        vm.expectRevert(PredictionMarket.MarketAlreadyFinalized.selector);
        vm.prank(stranger);
        pm.emergencyCancel(mid);
    }

    function test_EmergencyCancel_RevertsOnInvalidMarketId() public {
        vm.expectRevert(PredictionMarket.InvalidMarket.selector);
        vm.prank(stranger);
        pm.emergencyCancel(999);
    }

    function test_EmergencyCancel_RefundsBettorsViaClaim() public {
        vm.warp(block.timestamp + 1 days + pm.EMERGENCY_CANCEL_GRACE_PERIOD() + 1);
        vm.prank(stranger);
        pm.emergencyCancel(mid);

        uint256 aliceBefore = token.balanceOf(alice);
        uint256 bobBefore = token.balanceOf(bob);

        vm.prank(alice);
        pm.claimWinnings(mid);
        vm.prank(bob);
        pm.claimWinnings(mid);

        assertEq(token.balanceOf(alice), aliceBefore + 5 * ONE);
        assertEq(token.balanceOf(bob), bobBefore + 3 * ONE);
    }
}

// ============================================================
//                 claimWinnings
// ============================================================
contract ClaimWinningsTests is PredictionMarketTest {
    function test_Claim_YesWins_PaysProportionalShare() public {
        // Alice bets 10 YES, Carol bets 5 YES, Bob bets 15 NO. YES wins.
        uint256 mid = _createMarket("Q?", 1 days);
        _placeBet(alice, mid, PredictionMarket.Outcome.Yes, 10 * ONE);
        _placeBet(carol, mid, PredictionMarket.Outcome.Yes, 5 * ONE);
        _placeBet(bob, mid, PredictionMarket.Outcome.No, 15 * ONE);

        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(admin);
        pm.resolveMarket(mid, PredictionMarket.Outcome.Yes);

        // Alice's share: 10 + (10 * 15) / 15 = 10 + 10 = 20
        // Carol's share: 5 + (5 * 15) / 15 = 5 + 5 = 10
        uint256 aliceBefore = token.balanceOf(alice);
        uint256 carolBefore = token.balanceOf(carol);

        vm.prank(alice);
        pm.claimWinnings(mid);
        vm.prank(carol);
        pm.claimWinnings(mid);

        assertEq(token.balanceOf(alice) - aliceBefore, 20 * ONE);
        assertEq(token.balanceOf(carol) - carolBefore, 10 * ONE);
    }

    function test_Claim_NoWins_PaysProportionalShare() public {
        uint256 mid = _createMarket("Q?", 1 days);
        _placeBet(alice, mid, PredictionMarket.Outcome.Yes, 20 * ONE);
        _placeBet(bob, mid, PredictionMarket.Outcome.No, 10 * ONE);

        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(admin);
        pm.resolveMarket(mid, PredictionMarket.Outcome.No);

        // Bob's payout: 10 + (10 * 20) / 10 = 30
        uint256 bobBefore = token.balanceOf(bob);
        vm.prank(bob);
        pm.claimWinnings(mid);
        assertEq(token.balanceOf(bob) - bobBefore, 30 * ONE);
    }

    function test_Claim_LoserGetsZero_ButCanStillClaim() public {
        uint256 mid = _createMarket("Q?", 1 days);
        _placeBet(alice, mid, PredictionMarket.Outcome.Yes, 10 * ONE);
        _placeBet(bob, mid, PredictionMarket.Outcome.No, 10 * ONE);

        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(admin);
        pm.resolveMarket(mid, PredictionMarket.Outcome.Yes);

        uint256 bobBefore = token.balanceOf(bob);
        vm.expectEmit(true, true, false, true);
        emit WinningsClaimed(mid, bob, 0, block.timestamp);

        vm.prank(bob);
        pm.claimWinnings(mid);

        assertEq(token.balanceOf(bob), bobBefore); // no payout
        PredictionMarket.UserPosition memory p = pm.getUserPosition(mid, bob);
        assertTrue(p.claimed);
    }

    function test_Claim_BetOnBothSides_OnlyWinningSidePays() public {
        uint256 mid = _createMarket("Q?", 1 days);
        _placeBet(alice, mid, PredictionMarket.Outcome.Yes, 10 * ONE);
        _placeBet(alice, mid, PredictionMarket.Outcome.No, 5 * ONE);
        _placeBet(bob, mid, PredictionMarket.Outcome.No, 5 * ONE);

        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(admin);
        pm.resolveMarket(mid, PredictionMarket.Outcome.Yes);

        // YES pool = 10, NO pool = 10
        // Alice yes payout: 10 + (10 * 10) / 10 = 20. Her No bet (5) is forfeited.
        uint256 aliceBefore = token.balanceOf(alice);
        vm.prank(alice);
        pm.claimWinnings(mid);
        assertEq(token.balanceOf(alice) - aliceBefore, 20 * ONE);
    }

    function test_Claim_Cancelled_RefundsAllBets() public {
        uint256 mid = _createMarket("Q?", 1 days);
        _placeBet(alice, mid, PredictionMarket.Outcome.Yes, 4 * ONE);
        _placeBet(alice, mid, PredictionMarket.Outcome.No, 6 * ONE);
        _placeBet(bob, mid, PredictionMarket.Outcome.No, 3 * ONE);

        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(admin);
        pm.cancelMarket(mid);

        uint256 aliceBefore = token.balanceOf(alice);
        vm.prank(alice);
        pm.claimWinnings(mid);
        assertEq(token.balanceOf(alice) - aliceBefore, 10 * ONE);

        uint256 bobBefore = token.balanceOf(bob);
        vm.prank(bob);
        pm.claimWinnings(mid);
        assertEq(token.balanceOf(bob) - bobBefore, 3 * ONE);
    }

    function test_Claim_RevertsIfMarketStillActive() public {
        uint256 mid = _createMarket("Q?", 1 days);
        _placeBet(alice, mid, PredictionMarket.Outcome.Yes, 1 * ONE);

        vm.expectRevert(PredictionMarket.MarketNotFinalized.selector);
        vm.prank(alice);
        pm.claimWinnings(mid);
    }

    function test_Claim_RevertsIfAlreadyClaimed() public {
        uint256 mid = _setupResolvedYesMarket(10 * ONE, 10 * ONE);
        vm.prank(alice);
        pm.claimWinnings(mid);

        vm.expectRevert(PredictionMarket.AlreadyClaimed.selector);
        vm.prank(alice);
        pm.claimWinnings(mid);
    }

    function test_Claim_RevertsIfNoPosition() public {
        uint256 mid = _setupResolvedYesMarket(10 * ONE, 10 * ONE);

        vm.expectRevert(PredictionMarket.NoPosition.selector);
        vm.prank(carol);
        pm.claimWinnings(mid);
    }

    function test_Claim_RevertsOnInvalidMarketId() public {
        vm.expectRevert(PredictionMarket.InvalidMarket.selector);
        vm.prank(alice);
        pm.claimWinnings(0);

        vm.expectRevert(PredictionMarket.InvalidMarket.selector);
        vm.prank(alice);
        pm.claimWinnings(999);
    }

    function test_Claim_WorksWhilePaused() public {
        uint256 mid = _setupResolvedYesMarket(10 * ONE, 10 * ONE);

        vm.prank(admin);
        pm.pause();

        vm.prank(alice);
        pm.claimWinnings(mid); // should not revert
    }

    function test_Claim_DustRoundingDoesNotExceedPool() public {
        // Picks pool sizes so division loses some dust to ensure invariant holds.
        uint256 mid = _createMarket("Q?", 1 days);
        _placeBet(alice, mid, PredictionMarket.Outcome.Yes, 3 * ONE);
        _placeBet(carol, mid, PredictionMarket.Outcome.Yes, 7 * ONE);
        _placeBet(bob, mid, PredictionMarket.Outcome.No, 11 * ONE);

        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(admin);
        pm.resolveMarket(mid, PredictionMarket.Outcome.Yes);

        uint256 contractBefore = token.balanceOf(address(pm));
        vm.prank(alice);
        pm.claimWinnings(mid);
        vm.prank(carol);
        pm.claimWinnings(mid);

        // Total paid out must not exceed pool
        uint256 paidOut = contractBefore - token.balanceOf(address(pm));
        assertLe(paidOut, contractBefore);
    }
}

// ============================================================
//                 claimMultipleWinnings
// ============================================================
contract ClaimMultipleWinningsTests is PredictionMarketTest {
    function test_ClaimMultiple_BatchClaimsAcrossMarkets() public {
        uint256 m1 = _setupResolvedYesMarket(10 * ONE, 10 * ONE); // alice wins 20
        uint256 m2 = _setupResolvedYesMarket(5 * ONE, 5 * ONE); // alice wins 10

        uint256[] memory ids = new uint256[](2);
        ids[0] = m1;
        ids[1] = m2;

        uint256 aliceBefore = token.balanceOf(alice);
        vm.prank(alice);
        pm.claimMultipleWinnings(ids);

        assertEq(token.balanceOf(alice) - aliceBefore, 30 * ONE);
    }

    function test_ClaimMultiple_SkipsInvalidIds() public {
        uint256 m1 = _setupResolvedYesMarket(10 * ONE, 10 * ONE);

        uint256[] memory ids = new uint256[](3);
        ids[0] = 0; // invalid (zero)
        ids[1] = m1;
        ids[2] = 999; // invalid (out of range)

        uint256 aliceBefore = token.balanceOf(alice);
        vm.prank(alice);
        pm.claimMultipleWinnings(ids);

        assertEq(token.balanceOf(alice) - aliceBefore, 20 * ONE);
    }

    function test_ClaimMultiple_SkipsAlreadyClaimed() public {
        uint256 m1 = _setupResolvedYesMarket(10 * ONE, 10 * ONE);

        vm.prank(alice);
        pm.claimWinnings(m1);

        uint256[] memory ids = new uint256[](1);
        ids[0] = m1;

        uint256 aliceBefore = token.balanceOf(alice);
        vm.prank(alice);
        pm.claimMultipleWinnings(ids); // should be a no-op
        assertEq(token.balanceOf(alice), aliceBefore);
    }

    function test_ClaimMultiple_SkipsActiveMarkets() public {
        uint256 m1 = _setupResolvedYesMarket(10 * ONE, 10 * ONE);

        // Active market created at the same time-warped state — make a new one
        vm.prank(alice);
        uint256 m2 = pm.createMarket("Active?", block.timestamp + 1 days, 0);
        _placeBet(alice, m2, PredictionMarket.Outcome.Yes, 1 * ONE);

        uint256[] memory ids = new uint256[](2);
        ids[0] = m1;
        ids[1] = m2;

        uint256 aliceBefore = token.balanceOf(alice);
        vm.prank(alice);
        pm.claimMultipleWinnings(ids);

        // Only m1 paid out
        assertEq(token.balanceOf(alice) - aliceBefore, 20 * ONE);
        assertFalse(pm.getUserPosition(m2, alice).claimed);
    }

    function test_ClaimMultiple_SkipsNoPosition() public {
        uint256 m1 = _setupResolvedYesMarket(10 * ONE, 10 * ONE);

        // Carol has no position. Calling shouldn't revert nor pay anything.
        uint256[] memory ids = new uint256[](1);
        ids[0] = m1;

        uint256 carolBefore = token.balanceOf(carol);
        vm.prank(carol);
        pm.claimMultipleWinnings(ids);
        assertEq(token.balanceOf(carol), carolBefore);
    }

    function test_ClaimMultiple_DoubleIdInArray_OnlyClaimsOnce() public {
        uint256 m1 = _setupResolvedYesMarket(10 * ONE, 10 * ONE);

        uint256[] memory ids = new uint256[](3);
        ids[0] = m1;
        ids[1] = m1;
        ids[2] = m1;

        uint256 aliceBefore = token.balanceOf(alice);
        vm.prank(alice);
        pm.claimMultipleWinnings(ids);
        assertEq(token.balanceOf(alice) - aliceBefore, 20 * ONE);
    }

    function test_ClaimMultiple_EmptyArray_DoesNothing() public {
        uint256[] memory ids = new uint256[](0);
        vm.prank(alice);
        pm.claimMultipleWinnings(ids); // should not revert
    }
}

// ============================================================
//                 View functions
// ============================================================
contract ViewFunctionTests is PredictionMarketTest {
    function test_GetMarket_RevertsOnInvalidId() public {
        vm.expectRevert(PredictionMarket.InvalidMarket.selector);
        pm.getMarket(0);

        vm.expectRevert(PredictionMarket.InvalidMarket.selector);
        pm.getMarket(999);
    }

    function test_GetUserPosition_RevertsOnInvalidId() public {
        vm.expectRevert(PredictionMarket.InvalidMarket.selector);
        pm.getUserPosition(0, alice);

        vm.expectRevert(PredictionMarket.InvalidMarket.selector);
        pm.getUserPosition(999, alice);
    }

    function test_CalculatePayout_ReturnsZeroWhileActive() public {
        uint256 mid = _createMarket("Q?", 1 days);
        _placeBet(alice, mid, PredictionMarket.Outcome.Yes, 10 * ONE);
        assertEq(pm.calculatePayout(mid, alice), 0);
    }

    function test_CalculatePayout_ReturnsZeroForUserWithoutPosition() public {
        uint256 mid = _setupResolvedYesMarket(10 * ONE, 10 * ONE);
        assertEq(pm.calculatePayout(mid, carol), 0);
    }

    function test_CalculatePayout_ReturnsZeroAfterClaim() public {
        uint256 mid = _setupResolvedYesMarket(10 * ONE, 10 * ONE);
        vm.prank(alice);
        pm.claimWinnings(mid);
        assertEq(pm.calculatePayout(mid, alice), 0);
    }

    function test_CalculatePayout_MatchesActualPayout_Resolved() public {
        uint256 mid = _setupResolvedYesMarket(10 * ONE, 10 * ONE);
        uint256 expected = pm.calculatePayout(mid, alice);

        uint256 before = token.balanceOf(alice);
        vm.prank(alice);
        pm.claimWinnings(mid);
        assertEq(token.balanceOf(alice) - before, expected);
    }

    function test_CalculatePayout_MatchesActualPayout_Cancelled() public {
        uint256 mid = _createMarket("Q?", 1 days);
        _placeBet(alice, mid, PredictionMarket.Outcome.Yes, 4 * ONE);
        _placeBet(alice, mid, PredictionMarket.Outcome.No, 6 * ONE);
        _placeBet(bob, mid, PredictionMarket.Outcome.No, 1 * ONE);
        vm.warp(block.timestamp + 1 days + 1);
        vm.prank(admin);
        pm.cancelMarket(mid);

        uint256 expected = pm.calculatePayout(mid, alice);
        assertEq(expected, 10 * ONE);

        uint256 before = token.balanceOf(alice);
        vm.prank(alice);
        pm.claimWinnings(mid);
        assertEq(token.balanceOf(alice) - before, expected);
    }

    function test_CalculatePayout_RevertsOnInvalidId() public {
        vm.expectRevert(PredictionMarket.InvalidMarket.selector);
        pm.calculatePayout(0, alice);
    }

    function test_GetConfig_ReturnsCurrent() public {
        PredictionMarket.Config memory cfg = pm.getConfig();
        assertEq(cfg.admin, admin);

        vm.prank(admin);
        pm.updateConfig(stranger, 100);

        cfg = pm.getConfig();
        assertEq(cfg.feeRecipient, stranger);
        assertEq(cfg.maxFeePercentage, 100);
    }

    function test_GetMarketCount_ReflectsCreations() public {
        assertEq(pm.getMarketCount(), 0);
        _createMarket("Q1", 1 days);
        assertEq(pm.getMarketCount(), 1);
        _createMarket("Q2", 1 days);
        assertEq(pm.getMarketCount(), 2);
    }
}

// ============================================================
//                 Reentrancy
// ============================================================

/// @notice Minimal ERC20 with a hook on transfer that lets us simulate a
/// reentrant ERC20 callback (similar to ERC777's tokensReceived).
contract ReentrantToken is IERC20 {
    string public name = "Reentrant";
    string public symbol = "REE";
    uint8 public decimals = 6;
    uint256 public override totalSupply;

    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    PredictionMarket public target;
    bool public attacking;
    uint256 public attackMarketId;

    function setTarget(PredictionMarket _target) external {
        target = _target;
    }

    function setAttack(bool _attack, uint256 _marketId) external {
        attacking = _attack;
        attackMarketId = _marketId;
    }

    function mint(address to, uint256 amount) external {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external override returns (bool) {
        if (attacking) {
            attacking = false; // prevent infinite loop
            // Reentrancy attempt — should revert inside the guarded call
            target.claimWinnings(attackMarketId);
        }
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        uint256 a = allowance[from][msg.sender];
        require(a >= amount, "allowance");
        if (a != type(uint256).max) allowance[from][msg.sender] = a - amount;
        _move(from, to, amount);
        return true;
    }

    function _move(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "balance");
        unchecked {
            balanceOf[from] -= amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }
}

    contract ReentrancyTests is Test {
        PredictionMarket internal pm;
        ReentrantToken internal evilToken;

        address internal admin = makeAddr("admin");
        address internal feeRecipient = makeAddr("feeRecipient");
        address internal attacker = makeAddr("attacker");
        address internal honest = makeAddr("honest");

        function setUp() public {
            evilToken = new ReentrantToken();
            pm = new PredictionMarket(address(evilToken), 6, admin, feeRecipient, 500);
            evilToken.setTarget(pm);

            evilToken.mint(attacker, 1_000 * 1e6);
            evilToken.mint(honest, 1_000 * 1e6);
        }

        function test_Reentrancy_BlocksClaimReentry() public {
            // Setup market with attacker on YES, honest on NO. YES wins.
            vm.prank(attacker);
            uint256 mid = pm.createMarket("Q?", block.timestamp + 1 days, 0);

            vm.prank(attacker);
            evilToken.approve(address(pm), 10 * 1e6);
            vm.prank(attacker);
            pm.placeBet(mid, PredictionMarket.Outcome.Yes, 10 * 1e6);

            vm.prank(honest);
            evilToken.approve(address(pm), 10 * 1e6);
            vm.prank(honest);
            pm.placeBet(mid, PredictionMarket.Outcome.No, 10 * 1e6);

            vm.warp(block.timestamp + 1 days + 1);
            vm.prank(admin);
            pm.resolveMarket(mid, PredictionMarket.Outcome.Yes);

            evilToken.setAttack(true, mid);

            // Re-entered claimWinnings inside transfer should revert with ReentrancyGuard,
            // bubbling up the failure to the outer call
            vm.expectRevert(PredictionMarket.ReentrancyGuard.selector);
            vm.prank(attacker);
            pm.claimWinnings(mid);
        }
    }

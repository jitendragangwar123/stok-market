// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

/// @title PredictionMarket:Simple Binary Prediction Markets
/// @author Jitendra Kumar
/// @notice A simple pot-based binary prediction market contract
/// @dev Implements pot-based binary markets with manual resolution
/// @custom:security-contact security@example.com
/// @custom:disclaimer THIS CONTRACT IS FOR EDUCATIONAL PURPOSES ONLY. IT IS UNAUDITED AND
/// SHOULD NOT BE USED IN PRODUCTION. THE AUTHORS ARE NOT RESPONSIBLE FOR ANY DAMAGES OR
/// LOSSES THAT MAY RESULT FROM ITS USE. ALWAYS CONDUCT YOUR OWN SECURITY AUDIT.
contract PredictionMarket {
    // ============ Enums ============

    /// @notice Market state enumeration
    enum MarketState {
        Active, // Market is open for betting
        Resolved, // Market has been resolved
        Cancelled // Market has been cancelled
    }

    /// @notice Outcome enumeration
    enum Outcome {
        None, // No outcome set
        Yes, // YES outcome
        No // NO outcome
    }

    // ============ Structs ============

    /// @notice Global configuration
    struct Config {
        address admin; // Contract admin address
        address feeRecipient; // Fee recipient address
        uint256 maxFeePercentage; // Max fee percentage (basis points, 100 = 1%)
        bool paused; // Emergency pause flag
    }

    /// @notice Configuration snapshot at market creation
    struct ConfigSnapshot {
        address feeRecipient; // Fee recipient at creation
        uint256 maxFeePercentage; // Max fee percentage at creation
    }

    /// @notice Market data structure
    struct Market {
        uint256 id; // Unique market ID
        string question; // Market question
        uint256 resolutionTime; // Betting end time (unix timestamp)
        MarketState state; // Current market state
        Outcome winningOutcome; // Winning outcome (if resolved)
        uint256 yesPool; // Total YES pool amount
        uint256 noPool; // Total NO pool amount
        uint256 creationFee; // Fee paid on creation
        address creator; // Market creator address
        uint256 createdAt; // Creation timestamp
        ConfigSnapshot configSnapshot; // Config snapshot at creation
    }

    /// @notice User position in a market
    struct UserPosition {
        uint256 yesBet; // Amount bet on YES
        uint256 noBet; // Amount bet on NO
        bool claimed; // Has user claimed winnings?
    }

    // ============ Errors ============

    error AlreadyClaimed();
    error AlreadyPaused();
    error EmptyQuestion();
    error GracePeriodNotElapsed();
    error InsufficientAllowance();
    error InsufficientBalance();
    error InvalidAddress();
    error InvalidFee();
    error InvalidMarket();
    error InvalidOutcome();
    error InvalidResolutionTime();
    error MarketAlreadyFinalized();
    error MarketExpired();
    error MarketNotActive();
    error MarketNotFinalized();
    error NoPosition();
    error NotAdmin();
    error NotPaused();
    error Paused();
    error ReentrancyGuard();
    error TransferFailed();
    error ZeroAmount();

    // ============ Events ============

    /// @notice Emitted when a new market is created
    event MarketCreated(
        uint256 indexed marketId, string question, uint256 resolutionTime, address indexed creator, uint256 fee
    );

    /// @notice Emitted when a market is resolved
    event MarketResolved(
        uint256 indexed marketId, Outcome winningOutcome, uint256 yesPool, uint256 noPool, uint256 timestamp
    );

    /// @notice Emitted when a market is cancelled
    event MarketCancelled(uint256 indexed marketId, uint256 yesPool, uint256 noPool, uint256 timestamp);

    /// @notice Emitted when a bet is placed
    event BetPlaced(
        uint256 indexed marketId, address indexed bettor, Outcome outcome, uint256 amount, uint256 timestamp
    );

    /// @notice Emitted when winnings are claimed
    event WinningsClaimed(uint256 indexed marketId, address indexed bettor, uint256 amount, uint256 timestamp);

    /// @notice Emitted when configuration is updated
    event ConfigUpdated(address indexed admin, address feeRecipient, uint256 maxFeePercentage);

    /// @notice Emitted when contract is paused
    event ContractPaused(address indexed admin);

    /// @notice Emitted when contract is unpaused
    event ContractUnpaused(address indexed admin);

    // ============ Constants ============

    /// @notice Maximum fee percentage allowed (10% = 1000 basis points)
    uint256 public constant MAX_FEE_LIMIT = 1000;

    /// @notice Grace period after resolutionTime during which only the admin
    /// can resolve or cancel a market. After this period elapses, anyone may
    /// trigger an emergency cancellation so user funds are not held hostage
    /// by an unresponsive or disappeared admin.
    uint256 public constant EMERGENCY_CANCEL_GRACE_PERIOD = 90 days;

    // ============ State Variables ============

    /// @notice Global configuration
    Config public config;

    /// @notice Total number of markets created
    uint256 public marketCounter;

    /// @notice Stablecoin token used for betting
    IERC20 public immutable stablecoin;

    /// @notice Stablecoin decimals
    uint8 public immutable stablecoinDecimals;

    /// @notice Reentrancy lock
    uint256 private _locked = 1;

    /// @notice Mapping of market ID to Market data
    mapping(uint256 => Market) public markets;

    /// @notice Mapping of market ID to user address to position
    mapping(uint256 => mapping(address => UserPosition)) public userPositions;

    // ============ Modifiers ============

    /// @notice Ensures caller is admin
    modifier onlyAdmin() {
        if (msg.sender != config.admin) revert NotAdmin();
        _;
    }

    /// @notice Ensures contract is not paused
    modifier whenNotPaused() {
        if (config.paused) revert Paused();
        _;
    }

    /// @notice Prevents reentrancy
    modifier nonReentrant() {
        if (_locked == 2) revert ReentrancyGuard();
        _locked = 2;
        _;
        _locked = 1;
    }

    /// @notice Ensures market exists
    modifier marketExists(uint256 _marketId) {
        if (_marketId == 0 || _marketId > marketCounter) revert InvalidMarket();
        _;
    }

    // ============ Constructor ============

    /// @notice Initializes the prediction market contract
    /// @param _stablecoin Address of the stablecoin token
    /// @param _stablecoinDecimals Decimal places of the stablecoin
    /// @param _admin Admin address for contract control
    /// @param _feeRecipient Address to receive creation fees
    /// @param _maxFeePercentage Maximum fee percentage in basis points (100 = 1%)
    constructor(
        address _stablecoin,
        uint8 _stablecoinDecimals,
        address _admin,
        address _feeRecipient,
        uint256 _maxFeePercentage
    ) {
        if (_stablecoin == address(0)) revert InvalidMarket();
        if (_admin == address(0)) revert NotAdmin();
        if (_feeRecipient == address(0)) revert InvalidAddress();
        if (_maxFeePercentage > MAX_FEE_LIMIT) revert InvalidFee();

        stablecoin = IERC20(_stablecoin);
        stablecoinDecimals = _stablecoinDecimals;

        config =
            Config({admin: _admin, feeRecipient: _feeRecipient, maxFeePercentage: _maxFeePercentage, paused: false});
    }

    // ============ Admin Functions ============

    /// @notice Updates the global configuration
    /// @param _feeRecipient New fee recipient address
    /// @param _maxFeePercentage New max fee percentage in basis points
    function updateConfig(address _feeRecipient, uint256 _maxFeePercentage) external onlyAdmin {
        if (_feeRecipient == address(0)) revert InvalidAddress();
        if (_maxFeePercentage > MAX_FEE_LIMIT) revert InvalidFee();

        config.feeRecipient = _feeRecipient;
        config.maxFeePercentage = _maxFeePercentage;

        emit ConfigUpdated(msg.sender, _feeRecipient, _maxFeePercentage);
    }

    /// @notice Pauses the contract
    function pause() external onlyAdmin {
        if (config.paused) revert AlreadyPaused();
        config.paused = true;
        emit ContractPaused(msg.sender);
    }

    /// @notice Unpauses the contract
    function unpause() external onlyAdmin {
        if (!config.paused) revert NotPaused();
        config.paused = false;
        emit ContractUnpaused(msg.sender);
    }

    /// @notice Resolves a market with a winning outcome
    /// @param _marketId ID of the market to resolve
    /// @param _winningOutcome Winning outcome (Yes or No)
    function resolveMarket(uint256 _marketId, Outcome _winningOutcome)
        external
        onlyAdmin
        nonReentrant
        marketExists(_marketId)
    {
        Market storage market = markets[_marketId];

        // Validations
        if (market.state != MarketState.Active) revert MarketAlreadyFinalized();
        if (block.timestamp < market.resolutionTime) revert MarketNotActive();
        if (_winningOutcome != Outcome.Yes && _winningOutcome != Outcome.No) {
            revert InvalidOutcome();
        }

        // If one side has no liquidity, there is no opposition to win against.
        // Auto-cancel and refund instead of reverting — otherwise the only way
        // out is admin calling cancelMarket, and an unresponsive admin would
        // permanently lock bettor funds.
        if (market.yesPool == 0 || market.noPool == 0) {
            market.state = MarketState.Cancelled;
            emit MarketCancelled(_marketId, market.yesPool, market.noPool, block.timestamp);
            return;
        }

        // Resolve market
        market.state = MarketState.Resolved;
        market.winningOutcome = _winningOutcome;

        emit MarketResolved(_marketId, _winningOutcome, market.yesPool, market.noPool, block.timestamp);
    }

    /// @notice Cancels a market
    /// @param _marketId ID of the market to cancel
    function cancelMarket(uint256 _marketId) external onlyAdmin nonReentrant marketExists(_marketId) {
        Market storage market = markets[_marketId];

        // Validations
        if (market.state != MarketState.Active) revert MarketAlreadyFinalized();
        if (block.timestamp < market.resolutionTime) revert MarketNotActive();

        // Cancel market
        market.state = MarketState.Cancelled;

        emit MarketCancelled(_marketId, market.yesPool, market.noPool, block.timestamp);
    }

    // ============ Emergency Functions ============

    /// @notice Permissionless emergency cancellation for markets that the admin
    /// has failed to finalize within the grace period after `resolutionTime`.
    /// Lets bettors recover their stake (via `claimWinnings`) without depending
    /// on admin liveness.
    /// @param _marketId ID of the market to cancel
    function emergencyCancel(uint256 _marketId) external nonReentrant marketExists(_marketId) {
        Market storage market = markets[_marketId];

        if (market.state != MarketState.Active) revert MarketAlreadyFinalized();
        if (block.timestamp < market.resolutionTime + EMERGENCY_CANCEL_GRACE_PERIOD) {
            revert GracePeriodNotElapsed();
        }

        market.state = MarketState.Cancelled;

        emit MarketCancelled(_marketId, market.yesPool, market.noPool, block.timestamp);
    }

    // ============ Market Functions ============

    /// @notice Creates a new prediction market
    /// @param _question Market question
    /// @param _resolutionTime Unix timestamp when betting ends
    /// @param _feeAmount Creation fee amount (with decimals)
    /// @return marketId ID of the created market
    function createMarket(string calldata _question, uint256 _resolutionTime, uint256 _feeAmount)
        external
        nonReentrant
        whenNotPaused
        returns (uint256 marketId)
    {
        // Validations
        if (bytes(_question).length == 0) revert EmptyQuestion();
        if (_resolutionTime <= block.timestamp) revert InvalidResolutionTime();

        // Calculate max allowed fee based on basis points
        // We don't enforce fee amount against maxFeePercentage here since
        // there's no bet amount to calculate percentage from.
        // The fee is a flat amount paid by the creator.

        // Transfer fee if applicable
        if (_feeAmount > 0) {
            if (stablecoin.balanceOf(msg.sender) < _feeAmount) revert InsufficientBalance();
            if (stablecoin.allowance(msg.sender, address(this)) < _feeAmount) {
                revert InsufficientAllowance();
            }

            bool success = stablecoin.transferFrom(msg.sender, config.feeRecipient, _feeAmount);
            if (!success) revert TransferFailed();
        }

        // Create market
        marketCounter++;
        marketId = marketCounter;

        markets[marketId] = Market({
            id: marketId,
            question: _question,
            resolutionTime: _resolutionTime,
            state: MarketState.Active,
            winningOutcome: Outcome.None,
            yesPool: 0,
            noPool: 0,
            creationFee: _feeAmount,
            creator: msg.sender,
            createdAt: block.timestamp,
            configSnapshot: ConfigSnapshot({
                feeRecipient: config.feeRecipient, maxFeePercentage: config.maxFeePercentage
            })
        });

        emit MarketCreated(marketId, _question, _resolutionTime, msg.sender, _feeAmount);

        return marketId;
    }

    // ============ Betting Functions ============

    /// @notice Places a bet on a market outcome
    /// @param _marketId ID of the market
    /// @param _outcome Bet outcome (Yes or No)
    /// @param _amount Amount to bet (with decimals)
    function placeBet(uint256 _marketId, Outcome _outcome, uint256 _amount)
        external
        nonReentrant
        whenNotPaused
        marketExists(_marketId)
    {
        // Validations
        if (_amount == 0) revert ZeroAmount();
        if (_outcome != Outcome.Yes && _outcome != Outcome.No) revert InvalidOutcome();

        Market storage market = markets[_marketId];

        if (market.state != MarketState.Active) revert MarketNotActive();
        if (block.timestamp >= market.resolutionTime) revert MarketExpired();

        // Check balance and allowance
        if (stablecoin.balanceOf(msg.sender) < _amount) revert InsufficientBalance();
        if (stablecoin.allowance(msg.sender, address(this)) < _amount) {
            revert InsufficientAllowance();
        }

        // Transfer tokens
        bool success = stablecoin.transferFrom(msg.sender, address(this), _amount);
        if (!success) revert TransferFailed();

        // Update pool and position
        UserPosition storage position = userPositions[_marketId][msg.sender];

        if (_outcome == Outcome.Yes) {
            market.yesPool += _amount;
            position.yesBet += _amount;
        } else {
            market.noPool += _amount;
            position.noBet += _amount;
        }

        emit BetPlaced(_marketId, msg.sender, _outcome, _amount, block.timestamp);
    }

    // ============ Claim Functions ============

    /// @notice Claims winnings from a resolved or cancelled market
    /// @param _marketId ID of the market
    function claimWinnings(uint256 _marketId) external nonReentrant marketExists(_marketId) {
        Market storage market = markets[_marketId];
        UserPosition storage position = userPositions[_marketId][msg.sender];

        // Validations
        if (market.state == MarketState.Active) revert MarketNotFinalized();
        if (position.claimed) revert AlreadyClaimed();
        if (position.yesBet == 0 && position.noBet == 0) revert NoPosition();

        uint256 payout = 0;

        if (market.state == MarketState.Resolved) {
            // Calculate winning payout
            if (market.winningOutcome == Outcome.Yes && position.yesBet > 0) {
                // User bet on YES and YES won
                uint256 winningPool = market.yesPool;
                uint256 losingPool = market.noPool;
                payout = position.yesBet + (position.yesBet * losingPool) / winningPool;
            } else if (market.winningOutcome == Outcome.No && position.noBet > 0) {
                // User bet on NO and NO won
                uint256 winningPool = market.noPool;
                uint256 losingPool = market.yesPool;
                payout = position.noBet + (position.noBet * losingPool) / winningPool;
            }
            // If user bet on losing side, payout remains 0
        } else {
            // Cancelled - full refund of all bets
            payout = position.yesBet + position.noBet;
        }

        // Mark as claimed
        position.claimed = true;

        // Transfer payout
        if (payout > 0) {
            bool success = stablecoin.transfer(msg.sender, payout);
            if (!success) revert TransferFailed();
        }

        emit WinningsClaimed(_marketId, msg.sender, payout, block.timestamp);
    }

    /// @notice Claims winnings from multiple markets at once
    /// @param _marketIds Array of market IDs
    function claimMultipleWinnings(uint256[] calldata _marketIds) external nonReentrant {
        for (uint256 i = 0; i < _marketIds.length; i++) {
            uint256 marketId = _marketIds[i];

            // Skip invalid markets
            if (marketId == 0 || marketId > marketCounter) continue;

            Market storage market = markets[marketId];
            UserPosition storage position = userPositions[marketId][msg.sender];

            // Skip if not finalized, already claimed, or no position
            if (market.state == MarketState.Active) continue;
            if (position.claimed) continue;
            if (position.yesBet == 0 && position.noBet == 0) continue;

            uint256 payout = 0;

            if (market.state == MarketState.Resolved) {
                if (market.winningOutcome == Outcome.Yes && position.yesBet > 0) {
                    uint256 winningPool = market.yesPool;
                    uint256 losingPool = market.noPool;
                    payout = position.yesBet + (position.yesBet * losingPool) / winningPool;
                } else if (market.winningOutcome == Outcome.No && position.noBet > 0) {
                    uint256 winningPool = market.noPool;
                    uint256 losingPool = market.yesPool;
                    payout = position.noBet + (position.noBet * losingPool) / winningPool;
                }
            } else {
                payout = position.yesBet + position.noBet;
            }

            position.claimed = true;

            if (payout > 0) {
                bool success = stablecoin.transfer(msg.sender, payout);
                if (!success) revert TransferFailed();
            }

            emit WinningsClaimed(marketId, msg.sender, payout, block.timestamp);
        }
    }

    // ============ View Functions ============

    /// @notice Gets market details
    /// @param _marketId ID of the market
    /// @return Market struct with all details
    function getMarket(uint256 _marketId) external view returns (Market memory) {
        if (_marketId == 0 || _marketId > marketCounter) revert InvalidMarket();
        return markets[_marketId];
    }

    /// @notice Gets user's position in a market
    /// @param _marketId ID of the market
    /// @param _user User address
    /// @return UserPosition struct
    function getUserPosition(uint256 _marketId, address _user) external view returns (UserPosition memory) {
        if (_marketId == 0 || _marketId > marketCounter) revert InvalidMarket();
        return userPositions[_marketId][_user];
    }

    /// @notice Calculates potential payout for a user
    /// @param _marketId ID of the market
    /// @param _user User address
    /// @return payout Calculated payout amount
    function calculatePayout(uint256 _marketId, address _user)
        external
        view
        marketExists(_marketId)
        returns (uint256 payout)
    {
        Market storage market = markets[_marketId];
        UserPosition storage position = userPositions[_marketId][_user];

        if (market.state == MarketState.Active) return 0;
        if (position.claimed) return 0;
        if (position.yesBet == 0 && position.noBet == 0) return 0;

        if (market.state == MarketState.Resolved) {
            if (market.winningOutcome == Outcome.Yes && position.yesBet > 0) {
                uint256 winningPool = market.yesPool;
                uint256 losingPool = market.noPool;
                payout = position.yesBet + (position.yesBet * losingPool) / winningPool;
            } else if (market.winningOutcome == Outcome.No && position.noBet > 0) {
                uint256 winningPool = market.noPool;
                uint256 losingPool = market.yesPool;
                payout = position.noBet + (position.noBet * losingPool) / winningPool;
            }
        } else {
            payout = position.yesBet + position.noBet;
        }

        return payout;
    }

    /// @notice Gets current configuration
    /// @return Config struct
    function getConfig() external view returns (Config memory) {
        return config;
    }

    /// @notice Gets total number of markets
    /// @return Total market count
    function getMarketCount() external view returns (uint256) {
        return marketCounter;
    }
}

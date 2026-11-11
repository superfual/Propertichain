// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Single-property, single-period test rehearsal with explicit closing.
/// @dev Synthetic shares and test rent only. No legal ownership is conferred.
contract OrigamiRehearsalV2 {
    error Unauthorized();
    error InvalidState();
    error PriceExpired();
    error DuplicateClaim();
    error PaymentFailed();
    error Paused();

    uint256 public constant supply = 1000;
    uint256 public constant pool = 6_000_000;
    address public immutable reviewer = msg.sender;
    bytes32 public immutable propertyId;
    bytes32 public priceHash;
    uint256 public expiry;
    uint256 public start;
    uint256 public end;
    uint256 public funded;
    bool public paused;
    mapping(address => uint256) public balance;
    mapping(address => uint256) public shareTime;
    mapping(address => uint256) public checkpoint;
    mapping(address => bool) public claimed;

    event PriceUpdated(bytes32 indexed digest, uint256 validUntil);
    event PauseChanged(bool paused);
    event Issued(address indexed holder, uint256 amount, uint256 startedAt);
    event SharesTransferred(address indexed from, address indexed to, uint256 amount);
    event PeriodClosed(uint256 endedAt);
    event Funded(address indexed sender, uint256 amount);
    event RentClaimed(address indexed holder, uint256 amount);

    constructor(bytes32 id) {
        if (id == bytes32(0)) revert InvalidState();
        propertyId = id;
    }

    modifier onlyReviewer() {
        if (msg.sender != reviewer) revert Unauthorized();
        _;
    }

    modifier whenActive() {
        if (paused) revert Paused();
        _;
    }

    function setPrice(bytes32 digest, uint256 validUntil) external onlyReviewer {
        if (digest == bytes32(0) || validUntil <= block.timestamp) revert InvalidState();
        priceHash = digest;
        expiry = validUntil;
        emit PriceUpdated(digest, validUntil);
    }

    /// @notice Invalidate the pricing record without a countdown.
    function revokePrice() external onlyReviewer {
        if (priceHash == bytes32(0)) revert InvalidState();
        expiry = block.timestamp;
        emit PriceUpdated(priceHash, expiry);
    }

    function setPaused(bool value) external onlyReviewer {
        paused = value;
        emit PauseChanged(value);
    }

    function issue(address firstHolder) external onlyReviewer whenActive {
        if (start != 0 || firstHolder == address(0)) revert InvalidState();
        checkPrice();
        start = block.timestamp;
        checkpoint[firstHolder] = start;
        balance[firstHolder] = supply;
        emit Issued(firstHolder, supply, start);
    }

    function transferShares(address recipient, uint256 amount) external whenActive {
        checkPrice();
        if (start == 0 || end != 0 || amount == 0 || amount > balance[msg.sender] ||
            recipient == address(0) || recipient == msg.sender) revert InvalidState();
        update(msg.sender);
        update(recipient);
        balance[msg.sender] -= amount;
        balance[recipient] += amount;
        emit SharesTransferred(msg.sender, recipient, amount);
    }

    /// @notice Close when the operator is ready, independently of price validity.
    function closePeriod() external onlyReviewer whenActive {
        if (start == 0 || end != 0 || block.timestamp <= start) revert InvalidState();
        end = block.timestamp;
        emit PeriodClosed(end);
    }

    function fund() external payable whenActive {
        if (start == 0 || msg.value == 0 || funded + msg.value > pool) revert InvalidState();
        funded += msg.value;
        emit Funded(msg.sender, msg.value);
    }

    function claimable(address holder) public view returns (uint256) {
        if (end == 0 || claimed[holder]) return 0;
        uint256 from = checkpoint[holder];
        uint256 earned = shareTime[holder];
        if (from != 0) earned += balance[holder] * (end - from);
        return pool * earned / (supply * (end - start));
    }

    function claim() external whenActive {
        if (claimed[msg.sender]) revert DuplicateClaim();
        if (end == 0 || funded != pool) revert InvalidState();
        uint256 amount = claimable(msg.sender);
        if (amount == 0) revert InvalidState();
        update(msg.sender);
        claimed[msg.sender] = true;
        emit RentClaimed(msg.sender, amount);
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert PaymentFailed();
    }

    function checkPrice() private view {
        if (priceHash == bytes32(0) || block.timestamp >= expiry) revert PriceExpired();
    }

    function update(address holder) private {
        uint256 until = end == 0 ? block.timestamp : end;
        uint256 from = checkpoint[holder];
        if (from != 0) shareTime[holder] += balance[holder] * (until - from);
        checkpoint[holder] = until;
    }
}

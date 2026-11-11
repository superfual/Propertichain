// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

contract OrigamiRehearsal {
    error Unauthorized();
    error InvalidState();
    error PriceExpired();
    error DuplicateClaim();
    error PaymentFailed();

    uint256 public constant supply = 1000;
    uint256 public constant pool = 6_000_000;
    address public immutable reviewer = msg.sender;
    bytes32 public priceHash;
    uint256 public expiry;
    uint256 public start;
    uint256 public end;
    uint256 public funded;
    mapping(address => uint256) public balance;
    mapping(address => uint256) public shareTime;
    mapping(address => uint256) public checkpoint;
    mapping(address => bool) public claimed;

    function setPrice(bytes32 digest, uint256 validUntil) external {
        if (msg.sender != reviewer) revert Unauthorized();
        if (digest == bytes32(0) || validUntil <= block.timestamp) revert InvalidState();
        priceHash = digest;
        expiry = validUntil;
    }

    function issue(address firstHolder, uint256 duration) external {
        if (msg.sender != reviewer) revert Unauthorized();
        if (start != 0 || duration == 0 || firstHolder == address(0)) revert InvalidState();
        checkPrice();
        start = block.timestamp;
        end = start + duration;
        checkpoint[firstHolder] = start;
        balance[firstHolder] = supply;
    }

    function transferShares(address recipient, uint256 amount) external {
        checkPrice();
        if (start == 0 || block.timestamp >= end || amount == 0 || amount > balance[msg.sender] ||
            recipient == address(0) || recipient == msg.sender) revert InvalidState();
        update(msg.sender);
        update(recipient);
        balance[msg.sender] -= amount;
        balance[recipient] += amount;
    }

    function fund() external payable {
        if (start == 0 || msg.value == 0 || funded + msg.value > pool) revert InvalidState();
        funded += msg.value;
    }

    function claim() external {
        if (claimed[msg.sender]) revert DuplicateClaim();
        if (start == 0 || block.timestamp < end || funded != pool) revert InvalidState();
        update(msg.sender);
        uint256 amount = pool * shareTime[msg.sender] / (supply * (end - start));
        if (amount == 0) revert InvalidState();
        claimed[msg.sender] = true;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert PaymentFailed();
    }

    function checkPrice() private view {
        if (priceHash == bytes32(0) || block.timestamp >= expiry) revert PriceExpired();
    }

    function update(address holder) private {
        uint256 until = block.timestamp < end ? block.timestamp : end;
        uint256 from = checkpoint[holder];
        if (from != 0) shareTime[holder] += balance[holder] * (until - from);
        checkpoint[holder] = until;
    }
}

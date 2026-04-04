// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./PredictionMarket.sol";

contract PredictionMarketFactory {

    address public owner;
    event MarketCreated(address indexed creator, address marketAddress, string description);

    address[] public markets;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function createMarket(string memory _description) external onlyOwner {
        PredictionMarket market = new PredictionMarket(_description, owner);
        markets.push(address(market));
        emit MarketCreated(msg.sender, address(market), _description);
    }

    function getMarkets() external view returns (address[] memory) {
        return markets;
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PredictionMarket {

    enum Outcome { Undecided, Win, Lose, InvalidOutcome }

    string public description;
    address public oracle;
    Outcome public marketOutcome;
    bool public isSettled;

    mapping(address => uint256) public winBets;
    mapping(address => uint256) public loseBets;
    uint256 public totalWinBets;
    uint256 public totalLoseBets;

    // Fee configuration: 0.1% of each bet goes to the fee recipient
    address payable public constant FEE_RECIPIENT = payable(0x95597Bf973a9536cAb0584bFbDE9A829FDCd6911);
    uint256 public constant FEE_NUMERATOR = 1;    
    uint256 public constant FEE_DENOMINATOR = 1000;

    event BetPlaced(address indexed bettor, uint256 amount, bool indexed betOnWin);
    event MarketSettled(Outcome outcome);
    event WinningsWithdrawn(address indexed bettor, uint256 amount);

    constructor(string memory _description, address _oracle) {
        description = _description;
        oracle = _oracle;
        marketOutcome = Outcome.Undecided;
        isSettled = false;
    }

    function betWin() external payable {
        require(!isSettled, "Market already settled");
        require(msg.value > 0, "Must send ETH to bet");

        uint256 fee = (msg.value * FEE_NUMERATOR) / FEE_DENOMINATOR;
        uint256 stake = msg.value - fee;
        require(stake > 0, "Stake too small");
        if (fee > 0) {
            FEE_RECIPIENT.transfer(fee);
        }

        winBets[msg.sender] += stake;
        totalWinBets += stake;

        emit BetPlaced(msg.sender, msg.value, true);
    }

    function betLose() external payable {
        require(!isSettled, "Market already settled");
        require(msg.value > 0, "Must send ETH to bet");

        uint256 fee = (msg.value * FEE_NUMERATOR) / FEE_DENOMINATOR;
        uint256 stake = msg.value - fee;
        require(stake > 0, "Stake too small");
        if (fee > 0) {
            FEE_RECIPIENT.transfer(fee);
        }

        loseBets[msg.sender] += stake;
        totalLoseBets += stake;

        emit BetPlaced(msg.sender, msg.value, false);
    }

    function settleMarket(Outcome _outcome) external {
        require(msg.sender == oracle, "Only oracle can settle market");
        require(!isSettled, "Market already settled");
        require(
            _outcome == Outcome.Win ||
            _outcome == Outcome.Lose ||
            _outcome == Outcome.InvalidOutcome,
            "Invalid outcome"
        );

        marketOutcome = _outcome;
        isSettled = true;

        emit MarketSettled(_outcome);
    }

    function withdrawWinnings() external {
        require(isSettled, "Market not yet settled");
        uint256 payout = 0;

        if (marketOutcome == Outcome.Win && winBets[msg.sender] > 0) {
            payout = (address(this).balance * winBets[msg.sender]) / totalWinBets;
            winBets[msg.sender] = 0;
        } else if (marketOutcome == Outcome.Lose && loseBets[msg.sender] > 0) {
            payout = (address(this).balance * loseBets[msg.sender]) / totalLoseBets;
            loseBets[msg.sender] = 0;
        } else if (marketOutcome == Outcome.InvalidOutcome) {
            uint256 totalBet = winBets[msg.sender] + loseBets[msg.sender];
            payout = totalBet;
            winBets[msg.sender] = 0;
            loseBets[msg.sender] = 0;
        } else {
            revert("No winnings to withdraw");
        }

        require(payout > 0, "No payout available");
        payable(msg.sender).transfer(payout);

        emit WinningsWithdrawn(msg.sender, payout);
    }
}
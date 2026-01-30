// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract DebugOraclePoll {
    using SafeERC20 for IERC20;

    IERC20 public usdToken;
    uint256 public constant STAKE_AMOUNT = 1000; 

    // pollId => voter => array of commitment hashes
    mapping(uint256 => mapping(address => bytes32[])) public commitments;
    // pollId => voter => commitmentIndex => revealed option (1-based index, 0 = none)
    mapping(uint256 => mapping(address => mapping(uint256 => uint256))) public votes;
    // pollId => optionIndex => count
    mapping(uint256 => mapping(uint256 => uint256)) public optionTallies;
    // pollId => voter => commitmentIndex => claimed
    mapping(uint256 => mapping(address => mapping(uint256 => bool))) public rewardClaimed;
    // pollId => Poll
    mapping(uint256 => Poll) public polls;
    uint256 public nextPollId;

    struct Poll {
        uint256 id;
        string question;
        string[] options;
        uint256 commitEndTime;
        uint256 revealEndTime;
        uint256 totalStake;
        bool resolved;
        uint256 winningOptionIndex;
    }
    
    event PollCreated(uint256 indexed pollId, string question, uint256 commitEndTime);
    event VoteCommitted(uint256 indexed pollId, address indexed voter);
    event VoteRevealed(uint256 indexed pollId, address indexed voter, uint256 optionIndex);
    event PollResolved(uint256 indexed pollId, uint256 winningOptionIndex, uint256 totalStake, uint256 winnerCount);
    event PremiumPurchased(address indexed user);

    mapping(address => bool) public isPremium;
    // FREE FOR DEBUGGING
    uint256 public constant MEMBERSHIP_COST = 0; 
    address public admin;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    constructor(address _usdToken) {
        usdToken = IERC20(_usdToken);
        admin = msg.sender;
    }

    function buyPremium() external {
        // NO TRANSFER
        isPremium[msg.sender] = true;
        emit PremiumPurchased(msg.sender);
    }
    
    // ... Copy rest of logic if needed for interface compatibility, 
    // but we only really need buyPremium to test the premium flow.
    // For full app compatibility, we need other read functions.
    
    function isPremiumUser(address user) external view returns (bool) {
        return isPremium[user];
    }
}

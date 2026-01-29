// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract OraclePoll {
    using SafeERC20 for IERC20;

    IERC20 public usdToken;
    // USDC has 6 decimals. 0.001 USDC = 1000 units.
    uint256 public constant STAKE_AMOUNT = 1000; 

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

    // pollId => voter => array of commitment hashes
    mapping(uint256 => mapping(address => bytes32[])) public commitments;
    // pollId => voter => commitmentIndex => revealed option (1-based index, 0 = none)
    mapping(uint256 => mapping(address => mapping(uint256 => uint256))) public votes;
    // pollId => optionIndex => count
    mapping(uint256 => mapping(uint256 => uint256)) public optionTallies;
    // pollId => voter => commitmentIndex => claimed
    mapping(uint256 => mapping(address => mapping(uint256 => bool))) public rewardClaimed;

    uint256 public nextPollId;
    mapping(uint256 => Poll) public polls;
    
    event PollCreated(uint256 indexed pollId, string question, uint256 commitEndTime);
    event VoteCommitted(uint256 indexed pollId, address indexed voter);
    event VoteRevealed(uint256 indexed pollId, address indexed voter, uint256 optionIndex);
    event PollResolved(uint256 indexed pollId, uint256 winningOptionIndex, uint256 totalStake, uint256 winnerCount);

    constructor(address _usdToken) {
        usdToken = IERC20(_usdToken);
    }

    function createPoll(string memory _question, string[] memory _options, uint256 _commitDuration, uint256 _revealDuration) external {
        uint256 pollId = nextPollId++;
        Poll storage p = polls[pollId];
        p.id = pollId;
        p.question = _question;
        p.options = _options;
        p.commitEndTime = block.timestamp + _commitDuration;
        p.revealEndTime = block.timestamp + _commitDuration + _revealDuration;
        
        emit PollCreated(pollId, _question, p.commitEndTime);
    }

    function commitVote(uint256 _pollId, bytes32 _voteHash) external {
        Poll storage p = polls[_pollId];
        require(block.timestamp < p.commitEndTime, "Commit phase ended");

        // Transfer USDC from user to contract
        usdToken.safeTransferFrom(msg.sender, address(this), STAKE_AMOUNT);
        p.totalStake += STAKE_AMOUNT;

        commitments[_pollId][msg.sender].push(_voteHash);
        emit VoteCommitted(_pollId, msg.sender);
    }

    function revealVote(uint256 _pollId, uint256 _commitmentIndex, uint256 _optionIndex, bytes32 _salt) external {
        Poll storage p = polls[_pollId];
        require(block.timestamp >= p.commitEndTime, "Commit phase not ended");
        require(block.timestamp < p.revealEndTime, "Reveal phase ended");
        require(commitments[_pollId][msg.sender].length > _commitmentIndex, "Invalid commitment index");
        require(votes[_pollId][msg.sender][_commitmentIndex] == 0, "Already revealed");
        require(p.options.length > _optionIndex, "Invalid option index");

        bytes32 verifyHash = keccak256(abi.encodePacked(_optionIndex, _salt));
        require(verifyHash == commitments[_pollId][msg.sender][_commitmentIndex], "Hash mismatch");

        votes[_pollId][msg.sender][_commitmentIndex] = _optionIndex + 1; // 1-based
        optionTallies[_pollId][_optionIndex]++;
        
        emit VoteRevealed(_pollId, msg.sender, _optionIndex);
    }

    function resolvePoll(uint256 _pollId) external {
        Poll storage p = polls[_pollId];
        require(block.timestamp >= p.revealEndTime, "Reveal phase not ended");
        require(!p.resolved, "Already resolved");

        uint256 winningCount = 0;
        uint256 winningIndex = 0;
        bool tie = false;

        for (uint256 i = 0; i < p.options.length; i++) {
            uint256 count = optionTallies[_pollId][i];
            if (count > winningCount) {
                winningCount = count;
                winningIndex = i;
                tie = false;
            } else if (count == winningCount && winningCount > 0) {
                tie = true;
            }
        }

        if (winningCount > 0 && !tie) {
            p.winningOptionIndex = winningIndex;
            p.resolved = true;
            emit PollResolved(_pollId, winningIndex, p.totalStake, winningCount);
        } else {
             // Handle tie
        }
    }
    
    function claimReward(uint256 _pollId, uint256 _commitmentIndex) external {
        Poll storage p = polls[_pollId];
        require(p.resolved, "Poll not resolved");
        require(votes[_pollId][msg.sender][_commitmentIndex] == p.winningOptionIndex + 1, "You did not win at this index");
        require(!rewardClaimed[_pollId][msg.sender][_commitmentIndex], "Already claimed");

        uint256 winnerCount = optionTallies[_pollId][p.winningOptionIndex];
        require(winnerCount > 0, "No winners? Error.");
        
        uint256 reward = p.totalStake / winnerCount;

        rewardClaimed[_pollId][msg.sender][_commitmentIndex] = true;
        usdToken.safeTransfer(msg.sender, reward);
    }
    
    function getPollOptions(uint256 _pollId) external view returns (string[] memory) {
         return polls[_pollId].options;
    }
}

const MAINNET_ORACLE_POLL_ADDRESS = "0xE4c7651160582F9B78E96d0cc17E997d7bbC04d1";
const MAINNET_BASE_USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const TESTNET_ORACLE_POLL_ADDRESS = "0x071dB0504E89c367F82f2da3cc88e9e6adC68D86";
const TESTNET_BASE_USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const isDev = import.meta.env.VITE_APP_ENV === 'development' || import.meta.env.DEV;

export const ORACLE_POLL_ADDRESS = isDev ? TESTNET_ORACLE_POLL_ADDRESS : MAINNET_ORACLE_POLL_ADDRESS;
export const BASE_USDC_ADDRESS = isDev ? TESTNET_BASE_USDC_ADDRESS : MAINNET_BASE_USDC_ADDRESS;
export const STAKE_AMOUNT = 1000n; // 0.001 USDC (6 decimals)
export const TARGET_CHAIN_ID = isDev ? 84532 : 8453; // Base Sepolia vs Base Mainnet

export const ORACLE_POLL_ABI = [
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_usdToken",
                "type": "address"
            }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "token",
                "type": "address"
            }
        ],
        "name": "SafeERC20FailedOperation",
        "type": "error"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "pollId",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "string",
                "name": "question",
                "type": "string"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "commitEndTime",
                "type": "uint256"
            }
        ],
        "name": "PollCreated",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "pollId",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "winningOptionIndex",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "totalStake",
                "type": "uint256"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "winnerCount",
                "type": "uint256"
            }
        ],
        "name": "PollResolved",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "address",
                "name": "user",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "expiryTimestamp",
                "type": "uint256"
            }
        ],
        "name": "PremiumPurchased",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "pollId",
                "type": "uint256"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "voter",
                "type": "address"
            }
        ],
        "name": "VoteCommitted",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": true,
                "internalType": "uint256",
                "name": "pollId",
                "type": "uint256"
            },
            {
                "indexed": true,
                "internalType": "address",
                "name": "voter",
                "type": "address"
            },
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "optionIndex",
                "type": "uint256"
            }
        ],
        "name": "VoteRevealed",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "COST_30_DAYS",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "COST_7_DAYS",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "STAKE_AMOUNT",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "admin",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_pollId",
                "type": "uint256"
            },
            {
                "internalType": "address",
                "name": "_voter",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "_commitmentIndex",
                "type": "uint256"
            }
        ],
        "name": "adminClaimReward",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_pollId",
                "type": "uint256"
            },
            {
                "internalType": "address",
                "name": "_voter",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "_commitmentIndex",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "_optionIndex",
                "type": "uint256"
            },
            {
                "internalType": "bytes32",
                "name": "_salt",
                "type": "bytes32"
            }
        ],
        "name": "adminRevealVote",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_days",
                "type": "uint256"
            }
        ],
        "name": "buyPremium",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_pollId",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "_commitmentIndex",
                "type": "uint256"
            }
        ],
        "name": "claimReward",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_pollId",
                "type": "uint256"
            },
            {
                "internalType": "bytes32",
                "name": "_voteHash",
                "type": "bytes32"
            }
        ],
        "name": "commitVote",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            },
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "name": "commitments",
        "outputs": [
            {
                "internalType": "bytes32",
                "name": "",
                "type": "bytes32"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "_question",
                "type": "string"
            },
            {
                "internalType": "string[]",
                "name": "_options",
                "type": "string[]"
            },
            {
                "internalType": "uint256",
                "name": "_commitDuration",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "_revealDuration",
                "type": "uint256"
            }
        ],
        "name": "createPoll",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_pollId",
                "type": "uint256"
            }
        ],
        "name": "getPollOptions",
        "outputs": [
            {
                "internalType": "string[]",
                "name": "",
                "type": "string[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_pollId",
                "type": "uint256"
            },
            {
                "internalType": "address",
                "name": "_voter",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "_commitmentIndex",
                "type": "uint256"
            }
        ],
        "name": "hasRevealed",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "_user",
                "type": "address"
            }
        ],
        "name": "isPremium",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "nextPollId",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "name": "optionTallies",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "name": "polls",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "id",
                "type": "uint256"
            },
            {
                "internalType": "string",
                "name": "question",
                "type": "string"
            },
            {
                "internalType": "uint256",
                "name": "commitEndTime",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "revealEndTime",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "totalStake",
                "type": "uint256"
            },
            {
                "internalType": "bool",
                "name": "resolved",
                "type": "bool"
            },
            {
                "internalType": "uint256",
                "name": "winningOptionIndex",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "name": "premiumExpiry",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_pollId",
                "type": "uint256"
            }
        ],
        "name": "resolvePoll",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_pollId",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "_commitmentIndex",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "_optionIndex",
                "type": "uint256"
            },
            {
                "internalType": "bytes32",
                "name": "_salt",
                "type": "bytes32"
            }
        ],
        "name": "revealVote",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            },
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "name": "rewardClaimed",
        "outputs": [
            {
                "internalType": "bool",
                "name": "",
                "type": "bool"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "usdToken",
        "outputs": [
            {
                "internalType": "contract IERC20",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            },
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            },
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "name": "votes",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
] as const;


import { createPublicClient, http, defineChain } from 'viem';

const base = defineChain({
    id: 8453,
    name: 'Base',
    network: 'base',
    nativeCurrency: {
        decimals: 18,
        name: 'Ether',
        symbol: 'ETH',
    },
    rpcUrls: {
        default: { http: ['https://mainnet.base.org'] },
        public: { http: ['https://mainnet.base.org'] },
    },
});

const client = createPublicClient({
    chain: base,
    transport: http(),
});

const ORACLE_POLL_ADDRESS = "0xF550a357f389951e34aa4F5f48Eb4D4e979Cc469";

const ABI = [
    {
        "inputs": [],
        "name": "nextPollId",
        "outputs": [{ "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "type": "uint256" }, { "type": "address" }],
        "name": "commitments",
        "outputs": [{ "type": "bytes32" }],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{ "name": "", "type": "uint256" }],
        "name": "polls",
        "outputs": [
            { "name": "id", "type": "uint256" },
            { "name": "question", "type": "string" },
            { "name": "commitEndTime", "type": "uint256" },
            { "name": "revealEndTime", "type": "uint256" },
            { "name": "totalStake", "type": "uint256" },
            { "name": "resolved", "type": "bool" },
            { "name": "winningOptionIndex", "type": "uint256" }
        ],
        "stateMutability": "view",
        "type": "function"
    }
] as const;

async function main() {
    const user = "0xE2b7ACdC0580e329E5998ff0948654FF495917DA";
    console.log("Checking User:", user);

    try {
        const nextPollId = await client.readContract({
            address: ORACLE_POLL_ADDRESS,
            abi: ABI,
            functionName: 'nextPollId',
        });
        console.log("nextPollId:", nextPollId.toString());

        for (let id = 0n; id < nextPollId; id++) {
            const commit = await client.readContract({
                address: ORACLE_POLL_ADDRESS,
                abi: ABI,
                functionName: 'commitments',
                args: [id, user]
            });
            const poll = await client.readContract({
                address: ORACLE_POLL_ADDRESS,
                abi: ABI,
                functionName: 'polls',
                args: [id]
            });
            console.log(`Poll ${id}:`);
            console.log(`  Commitment: ${commit}`);
            console.log(`  CommitEnd: ${poll[2]} (Now: ${Math.floor(Date.now() / 1000)})`);
        }
    } catch (e) {
        console.error(e);
    }
}

main();

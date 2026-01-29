
const hre = require("hardhat");

const ORACLE_POLL_ADDRESS = "0x3651dA7d501fD54e58c0aF64E221c4Fe22957eC5";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const POLL_ID = 5;
const OPTION_INDEX = 1; // "No" for the BTC poll
const STAKE_AMOUNT = 1000;

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Executing from account: ${deployer.address}`);

    const OraclePoll = await hre.ethers.getContractAt("OraclePoll", ORACLE_POLL_ADDRESS);
    const USDC = await hre.ethers.getContractAt("IERC20", USDC_ADDRESS);

    // 1. Approve
    console.log("Approving USDC...");
    const approveTx = await USDC.approve(ORACLE_POLL_ADDRESS, STAKE_AMOUNT);
    await approveTx.wait();
    console.log("Approved! Hash:", approveTx.hash);

    // 2. Commit Vote
    console.log(`Committing vote for Poll ${POLL_ID}, Option ${OPTION_INDEX}...`);
    const salt = Math.random().toString(36).substring(7);
    const saltBytes32 = hre.ethers.encodeBytes32String(salt);

    // Hash: keccak256(abi.encodePacked(_optionIndex, _salt))
    const voteHash = hre.ethers.solidityPackedKeccak256(
        ["uint256", "bytes32"],
        [OPTION_INDEX, saltBytes32]
    );

    const voteTx = await OraclePoll.commitVote(POLL_ID, voteHash);
    await voteTx.wait();
    console.log("Vote Committed! Hash:", voteTx.hash);
    console.log("SAVE THIS SALT:", salt);
}

main().catch(console.error);

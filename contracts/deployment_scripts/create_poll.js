const hre = require("hardhat");

const ORACLE_POLL_ADDRESS = "0x3651dA7d501fD54e58c0aF64E221c4Fe22957eC5";

async function main() {
    const signers = await hre.ethers.getSigners();
    const deployer = signers[0];

    console.log("Creating poll with account:", deployer.address);

    // Attach to the deployed contract
    const OraclePoll = await hre.ethers.getContractFactory("OraclePoll");
    const oraclePoll = OraclePoll.attach(ORACLE_POLL_ADDRESS);

    // Poll Parameters
    const question = "Will Bitcoin hit $120k before February?";
    const options = ["Yes", "No", "Maybe (Sideways)"];
    const commitDuration = 180; // 3 minutes
    const revealDuration = 180; // 3 minutes

    console.log(`Creating poll: "${question}"`);
    console.log(`Options: ${options.join(", ")}`);

    try {
        const tx = await oraclePoll.createPoll(
            question,
            options,
            commitDuration,
            revealDuration
        );

        console.log("Transaction sent:", tx.hash);
        await tx.wait();
        console.log("Poll created successfully!");

    } catch (error) {
        console.error("Error creating poll:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });

const hre = require("hardhat");

async function main() {
    const pollAddress = "0xf99E3270ACB63341eCdD550004DEdF1A6268A234";
    const usdcAddress = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

    const [deployer] = await hre.ethers.getSigners();
    console.log("Executing Purchase for Deployer:", deployer.address);

    const OraclePoll = await hre.ethers.getContractFactory("OraclePoll");
    const poll = OraclePoll.attach(pollAddress);

    // Check ETH
    const ethBalance = await hre.ethers.provider.getBalance(deployer.address);
    if (ethBalance < 30000000000000n) { // Check for at least ~0.00003 ETH
        console.error(`Insufficient ETH for gas! Have: ${hre.ethers.formatEther(ethBalance)} ETH`);
        // We proceed anyway to let the node fail with the exact error if they want
    }

    const usdcAbi = [
        "function approve(address spender, uint256 amount) returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)",
        "function balanceOf(address owner) view returns (uint256)"
    ];
    const usdc = new hre.ethers.Contract(usdcAddress, usdcAbi, deployer);

    // 1. Check/Approve USDC
    const cost = await poll.MEMBERSHIP_COST();
    const allowance = await usdc.allowance(deployer.address, pollAddress);

    if (allowance < cost) {
        console.log("Approving USDC...");
        const txApprove = await usdc.approve(pollAddress, cost);
        console.log("Approve Tx Sent:", txApprove.hash);
        await txApprove.wait();
        console.log("Approved!");
    } else {
        console.log("USDC already approved.");
    }

    // 2. Buy Premium
    console.log("Buying Premium...");
    const txBuy = await poll.buyPremium();
    console.log("Buy Premium Tx Sent:", txBuy.hash);
    await txBuy.wait();
    console.log("Success! Deployer is now Premium.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

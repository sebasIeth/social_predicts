const hre = require("hardhat");

async function main() {
    const pollAddress = "0xf99E3270ACB63341eCdD550004DEdF1A6268A234";
    const userAddress = "0xE2b7ACdC0580e329E5998ff0948654FF495917DA";

    console.log("Simulating buyPremium for:", userAddress);

    // Impersonate won't work on real network without forking, but we can try estimating gas
    // or callStatic to get the revert reason if it fails.

    // We can't use impersonateAccount on a live network via simple provider.
    // But we can use 'call' with 'from'.

    const OraclePoll = await hre.ethers.getContractFactory("OraclePoll");
    const poll = OraclePoll.attach(pollAddress);

    // Use callStatic / eth_call to simulate
    try {
        const txData = await poll.buyPremium.populateTransaction();
        const tx = {
            to: pollAddress,
            from: userAddress,
            data: txData.data,
            value: 0
        };

        const result = await hre.ethers.provider.call(tx);
        console.log("Call Result (Hex):", result);
        // If result represents a success, it will be empty 0x or encoded return data.

        const gasEstimate = await hre.ethers.provider.estimateGas(tx);
        console.log("Gas Estimate:", gasEstimate.toString());

        const feeData = await hre.ethers.provider.getFeeData();
        const totalCost = gasEstimate * (feeData.maxFeePerGas || feeData.gasPrice);
        console.log("Estimated Cost (Wei):", totalCost.toString());

    } catch (e) {
        console.log("Call Failed:");
        // e might contain the revert reason
        if (e.data) {
            console.log("Revert Data:", e.data);
            // Verify if it matches SafeERC20FailedOperation
        } else if (e.message) {
            console.log("Message:", e.message);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

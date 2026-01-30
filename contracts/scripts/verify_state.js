const hre = require("hardhat");

async function main() {
    const pollAddress = "0xf99E3270ACB63341eCdD550004DEdF1A6268A234";
    const OraclePoll = await hre.ethers.getContractFactory("OraclePoll");
    const poll = OraclePoll.attach(pollAddress);

    console.log("Reading state from:", pollAddress);

    const admin = await poll.admin();
    console.log("Admin:", admin);

    const usdToken = await poll.usdToken();
    console.log("USD Token:", usdToken);

    const cost = await poll.MEMBERSHIP_COST();
    console.log("Membership Cost:", cost.toString());

    // Check Deployer Balance
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer Address:", deployer.address);

    // Check allowance for user 0xE2b7ACdC0580e329E5998ff0948654FF495917DA
    const userAddress = "0xE2b7ACdC0580e329E5998ff0948654FF495917DA";
    const usdcAbi = ["function allowance(address owner, address spender) view returns (uint256)", "function balanceOf(address owner) view returns (uint256)"];
    const usdcContract = new hre.ethers.Contract(usdToken, usdcAbi, hre.ethers.provider);

    const deployerBalance = await usdcContract.balanceOf(deployer.address);
    console.log("Deployer USDC Balance:", deployerBalance.toString());

    const deployerEth = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Deployer ETH Balance:", hre.ethers.formatEther(deployerEth));

    const isDeployerPremium = await poll.isPremium(deployer.address);
    console.log("Is Deployer Premium:", isDeployerPremium);

    const allowance = await usdcContract.allowance(userAddress, pollAddress);
    console.log("User Allowance for Contract:", allowance.toString());

    const balance = await usdcContract.balanceOf(userAddress);
    console.log("User USDC Balance:", balance.toString());

    const isPremium = await poll.isPremium(userAddress);
    console.log("Is Premium:", isPremium);

    const ethBalance = await hre.ethers.provider.getBalance(userAddress);
    console.log("User ETH Balance:", hre.ethers.formatEther(ethBalance));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

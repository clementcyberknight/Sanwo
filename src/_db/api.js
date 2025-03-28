import { ethers, Wallet } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const privateKey = process.env.DEPLOYER_KEY;

const abi = [
    "function autoPayWorkers(address employer, (address,uint256)[] memory workers, uint256 _total) external returns (bool)",
    "function employerBalance(address employer) external view returns (uint256)"
]
const PAY_WORKERS_ADDRESS = "0x21d9c6451a1907b555b012ef7292a879ab9ce33e";

function tranBigInt(obj) {
    return JSON.parse(JSON.stringify(obj, (key, value) => (typeof value === 'bigint' ? value.toString() : value)));
}

export default async function handler(req, res) {

    //edit later "*"
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
     res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
  if (req.method === 'POST') {
    try {
      const { data, employer } = req.body;
  
      if (!employer || !Array.isArray(data) || data.length === 0) {
        throw new Error('Invalid data inputted. Check data input');
      }
  
      if (!privateKey) {
        throw new Error('Private key not found in environment variables');
      }
  
      try {
        let workers_address = data.map(item => [item.address, ethers.parseUnits(item.amount.toString(), 6)]);
        let total_amount = data.reduce((sum, item) => sum + item.amount, 0);
        total_amount = ethers.parseUnits(total_amount.toString(), 6);
  
        const wallet = new Wallet(privateKey, provider);
        const contract = new ethers.Contract(PAY_WORKERS_ADDRESS, abi, wallet);
        
        const balance = await contract.employerBalance(employer);
  
        if (balance < total_amount) {
            res.status(200).json({
                employer:employer,
                totalbalance:total_amount.toString(),
                balance:balance.toString(),
            })
          throw new Error('Insufficient employer balance');
        }
  
        const tx = await contract.autoPayWorkers(
          employer,
          workers_address,
          total_amount,
          {
            gasLimit: 1000000,
            gasPrice: ethers.parseUnits("0.1", "gwei") 
          }
        );
        
        await tx.wait();
  
        let gasUsed = tx.gasLimit + "";
        let gasPrice = tx.gasPrice + "";

        res.status(200).json({
          transactionHash: tx.hash,
          timestamp: new Date().toISOString(),
          gasUsed: gasUsed,
        });
  
      } catch(error) {
        console.error("Inner error:", error);
        res.status(500).json({ err: error.message || "An error occurred" });
      }
      
    } catch (error) {
      console.error("Outer error:", error);
      res.status(500).json({ err: error.message || "An error occurred" });
    }
  } else {
    res.status(405).json({ error: "Method Not Allowed" });
  }   
}
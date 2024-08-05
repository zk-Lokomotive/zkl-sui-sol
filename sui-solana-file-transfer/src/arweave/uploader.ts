import Arweave from "arweave";
import fs from "fs";
import config from "../../config/config.json";

const arweave = Arweave.init(config.arweave);

export async function uploadToArweave(filePath: string): Promise<string> {
  const data = fs.readFileSync(filePath);
  const transaction = await arweave.createTransaction({ data: data });

  transaction.addTag("Content-Type", "application/octet-stream");

  await arweave.transactions.sign(transaction, JSON.parse(config.arweave.key));
  const response = await arweave.transactions.post(transaction);

  if (response.status === 200) {
    return `https://arweave.net/${transaction.id}`;
  } else {
    throw new Error("Failed to upload file to Arweave");
  }
}

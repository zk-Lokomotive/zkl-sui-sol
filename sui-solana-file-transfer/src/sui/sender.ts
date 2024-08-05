import { Ed25519Keypair, JsonRpcProvider, RawSigner } from "@mysten/sui.js";
import { uploadToArweave } from "../arweave/uploader";
import config from "../../config/config.json";

const provider = new JsonRpcProvider(config.sui.rpc_url);
const keypair = Ed25519Keypair.fromSecretKey(
  Buffer.from(config.sui.private_key, "hex"),
);
const signer = new RawSigner(keypair, provider);

export async function sendFileFromSui(
  filePath: string,
  recipientAddress: string,
): Promise<string> {
  try {
    // Upload file to Arweave
    const arweaveUrl = await uploadToArweave(filePath);

    // Create a simple object to store the file URL
    const fileObject = {
      url: arweaveUrl,
      recipient: recipientAddress,
    };

    // Convert the object to a string
    const fileObjectString = JSON.stringify(fileObject);

    // Create and sign a transaction to store the file object on Sui
    const tx = await signer.signAndExecuteTransaction({
      kind: "moveCall",
      data: {
        packageObjectId: "YOUR_PACKAGE_OBJECT_ID",
        module: "file_transfer",
        function: "create_file_object",
        typeArguments: [],
        arguments: [fileObjectString],
        gasBudget: 10000,
      },
    });

    return tx.certificate.transactionDigest;
  } catch (error) {
    console.error("Error sending file from Sui:", error);
    throw error;
  }
}

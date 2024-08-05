/* Developed by @virjilakrum */
import {
  ChainId,
  CHAIN_ID_SOLANA,
  CHAIN_ID_SUI,
  getEmitterAddressEth,
  getEmitterAddressSui,
  parseSequenceFromLogSui,
  getSignedVAA,
  postVaaSolana,
  redeemOnSolana,
  transferFromSui,
} from "@certusone/wormhole-sdk";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Ed25519Keypair, JsonRpcProvider, RawSigner } from "@mysten/sui.js";
import { SuiTransactionBlockResponse } from "@mysten/sui.js/client";
// import { ethers } from "ethers";
import config from "../../config/config.json";

// Initialize providers and "signers"
const suiProvider = new JsonRpcProvider(config.sui.rpc_url);
const suiKeypair = Ed25519Keypair.fromSecretKey(
  Buffer.from(config.sui.private_key, "hex"),
);
const suiSigner = new RawSigner(suiKeypair, suiProvider);

const solanaConnection = new Connection(config.solana.rpc_url);
const solanaKeypair = Keypair.fromSecretKey(
  Buffer.from(config.solana.private_key, "hex"),
);

const WORMHOLE_RPC_HOST = "https://wormhole-v2-testnet-api.certus.one";

export async function bridgeFileToSolana(
  suiObjectId: string,
  recipientAddress: string,
): Promise<string> {
  try {
    console.log("Starting the bridging process from Sui to Solana...");

    // Step 1: Transfer the file object from "Sui"
    console.log("Initiating transfer from Sui...");
    const transferResult = await transferFromSui(
      suiProvider,
      suiSigner,
      config.wormhole.token_bridge_address,
      suiObjectId,
      CHAIN_ID_SOLANA,
      new PublicKey(recipientAddress).toBuffer(),
      BigInt(0), // amount is 0 for NFTs
      BigInt(0), // relayer fee
    );

    console.log(
      "Transfer from Sui completed. Transaction digest:",
      transferResult.transactionDigest,
    );

    // Step 2: Get the sequence number from the logs
    const sequence = parseSequenceFromLogSui(
      transferResult.transactionResponse,
    );
    console.log("Sequence number:", sequence);

    // Step 3: Get the emitter address
    const emitterAddress = await getEmitterAddressSui(
      config.wormhole.token_bridge_address,
    );
    console.log("Emitter address:", emitterAddress);

    // Step 4: Poll for the signed VAA
    console.log("Polling for the signed VAA...");
    const { vaaBytes } = await getSignedVAA(
      WORMHOLE_RPC_HOST,
      CHAIN_ID_SUI,
      emitterAddress,
      sequence,
    );
    console.log("Received signed VAA");

    // Step 5: Post VAA to Solana
    console.log("Posting VAA to Solana...");
    await postVaaSolana(
      solanaConnection,
      solanaKeypair,
      config.wormhole.bridge_address,
      solanaKeypair.publicKey,
      Buffer.from(vaaBytes),
    );
    console.log("VAA posted to Solana");

    // Step 6: Redeem on Solana
    console.log("Redeeming on Solana...");
    const redeemResult = await redeemOnSolana(
      solanaConnection,
      config.wormhole.bridge_address,
      config.wormhole.token_bridge_address,
      solanaKeypair,
      vaaBytes,
    );
    console.log(
      "Redeemed on Solana. Transaction signature:",
      redeemResult.signature,
    );

    return redeemResult.signature;
  } catch (error) {
    console.error("Error bridging file to Solana:", error);
    throw error;
  }
}

export async function getFileMetadata(
  solanaTransactionSignature: string,
): Promise<any> {
  try {
    console.log("Fetching file metadata from Solana transaction...");
    const transaction = await solanaConnection.getTransaction(
      solanaTransactionSignature,
    );

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    // Parse the transaction to extract the file metadata
    // 🏗️ @virjilakrum: "we'll need to implement the actual parsing logic"
    // based on how you've structured your Solana program
    const metadata = parseFileMetadataFromTransaction(transaction);

    console.log("File metadata retrieved:", metadata);
    return metadata;
  } catch (error) {
    console.error("Error getting file metadata:", error);
    throw error;
  }
}

function parseFileMetadataFromTransaction(transaction: any): any {
  // Implement the logic to extract file metadata from the Solana transaction
  // This will depend on how you've structured your Solana program
  // 🏗️ @virjilakrum: For now, we'll return a placeholder object
  return {
    arweaveUrl: "https://arweave.net/placeholder",
    originalSender: "placeholder_sui_address",
    recipient: "placeholder_solana_address",
  };
}

export async function verifyFileTransfer(
  suiTransactionDigest: string,
  solanaTransactionSignature: string,
): Promise<boolean> {
  try {
    console.log("Verifying file transfer...");

    // Fetch Sui transaction details
    const suiTransaction =
      await suiProvider.getTransaction(suiTransactionDigest);
    // Extract relevant details from Sui transaction
    // 🏗️ @virjilakrum: Implement based on our Sui contract structure
    const suiFileDetails = extractFileDetailsFromSuiTransaction(suiTransaction);

    // Fetch Solana transaction details
    const solanaTransaction = await solanaConnection.getTransaction(
      solanaTransactionSignature,
    );
    // Extract relevant details from Solana transaction
    // 🏗️ @virjilakrum: Implement based on our Solana program structure
    const solanaFileDetails =
      extractFileDetailsFromSolanaTransaction(solanaTransaction);

    // Compare the details
    const isVerified = compareFileDetails(suiFileDetails, solanaFileDetails);

    console.log("File transfer verification result:", isVerified);
    return isVerified;
  } catch (error) {
    console.error("Error verifying file transfer:", error);
    throw error;
  }
}

function extractFileDetailsFromSuiTransaction(transaction: any): any {
  // Implement logic to extract file details from Sui transaction
  // Return placeholder for now
  return { arweaveUrl: "placeholder_url", recipient: "placeholder_recipient" };
}

function extractFileDetailsFromSolanaTransaction(transaction: any): any {
  // Implement logic to extract file details from Solana transaction
  // Return placeholder for now
  return { arweaveUrl: "placeholder_url", recipient: "placeholder_recipient" };
}

function compareFileDetails(suiDetails: any, solanaDetails: any): boolean {
  // Implement comparison logic
  // 🏗️ @virjilakrum: For now, always return true
  return true;
}

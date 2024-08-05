/* Developed by @virjilakrum */
import {
  ChainId,
  CHAIN_ID_SOLANA,
  CHAIN_ID_SUI,
  getEmitterAddressSui,
  parseSequenceFromLogSui,
  getSignedVAA,
  postVaaSolana,
} from "@certusone/wormhole-sdk";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { JsonRpcProvider, RawSigner, TransactionBlock } from "@mysten/sui.js";
import { fromB64 } from "@mysten/bcs";
import { ethers } from "ethers";
import config from "../../config/config.json";

const suiProvider = new JsonRpcProvider(config.sui.rpc_url);
const suiKeypair = Ed25519Keypair.fromSecretKey(
  fromB64(config.sui.private_key),
);
const suiSigner = new RawSigner(suiKeypair, suiProvider);

const solanaConnection = new Connection(config.solana.rpc_url);
const solanaKeypair = Keypair.fromSecretKey(
  Buffer.from(config.solana.private_key, "hex"),
);

const WORMHOLE_RPC_HOST = "https://wormhole-v2-testnet-api.certus.one";

export async function bridgeArweaveUrlToSolana(
  arweaveUrl: string,
  recipientAddress: string,
): Promise<string> {
  try {
    console.log("Starting the bridging process from Sui to Solana...");

    // Step 1: Create FileTransfer on Sui
    const createFileTransferTx = new TransactionBlock();
    createFileTransferTx.moveCall({
      target: `${config.sui.package_id}::file_transfer::create_file_transfer`,
      arguments: [
        createFileTransferTx.pure(arweaveUrl),
        createFileTransferTx.pure(
          Buffer.from(new PublicKey(recipientAddress).toBytes()),
        ),
      ],
    });

    const createFileTransferResult =
      await suiSigner.signAndExecuteTransactionBlock({
        transactionBlock: createFileTransferTx,
      });

    const fileTransferId = getCreatedFileTransferId(createFileTransferResult);
    console.log("FileTransfer created with ID:", fileTransferId);

    // Step 2: Initiate transfer on Sui
    const initiateTransferTx = new TransactionBlock();
    initiateTransferTx.moveCall({
      target: `${config.sui.package_id}::file_transfer::send_file_transfer`,
      arguments: [
        initiateTransferTx.object(fileTransferId),
        initiateTransferTx.object(config.wormhole.sui.core_state_object_id),
        initiateTransferTx.pure(CHAIN_ID_SOLANA),
        initiateTransferTx.pure(0), // nonce
        initiateTransferTx.pure(1_000_000), // fee
      ],
    });

    const transferResult = await suiSigner.signAndExecuteTransactionBlock({
      transactionBlock: initiateTransferTx,
    });

    console.log(
      "Transfer initiated on Sui. Transaction digest:",
      transferResult.digest,
    );

    // Step 3: Get the sequence number from the logs
    const sequence = parseSequenceFromLogSui(transferResult);
    console.log("Sequence number:", sequence);

    // Step 4: Get the emitter address
    const emitterAddress = await getEmitterAddressSui(
      config.wormhole.sui.core_bridge_address,
    );
    console.log("Emitter address:", emitterAddress);

    // Step 5: Poll for the signed VAA
    console.log("Polling for the signed VAA...");
    const { vaaBytes } = await getSignedVAA(
      WORMHOLE_RPC_HOST,
      CHAIN_ID_SUI,
      emitterAddress,
      sequence,
    );
    console.log("Received signed VAA");

    // Step 6: Post VAA to Solana
    console.log("Posting VAA to Solana...");
    await postVaaSolana(
      solanaConnection,
      async (transaction) => {
        transaction.partialSign(solanaKeypair);
        return transaction;
      },
      config.wormhole.solana.core_bridge_address,
      solanaKeypair.publicKey,
      Buffer.from(vaaBytes),
    );
    console.log("VAA posted to Solana");

    // Step 7: Call Solana program to process the VAA
    console.log("Processing VAA on Solana...");
    const solanaProgram = new PublicKey(config.solana.program_id);

    const instruction = new TransactionInstruction({
      programId: solanaProgram,
      keys: [
        {
          pubkey: new PublicKey(config.wormhole.solana.core_bridge_address),
          isSigner: false,
          isWritable: false,
        },
        { pubkey: solanaKeypair.publicKey, isSigner: true, isWritable: false },
      ],
      data: Buffer.from(vaaBytes),
    });

    const transaction = new Transaction().add(instruction);
    const signature = await solanaConnection.sendTransaction(transaction, [
      solanaKeypair,
    ]);

    await solanaConnection.confirmTransaction(signature);
    console.log("VAA processed on Solana. Transaction signature:", signature);

    return signature;
  } catch (error) {
    console.error("Error bridging Arweave URL to Solana:", error);
    throw error;
  }
}

function getCreatedFileTransferId(result: any): string {
  const createdObjects = result.effects?.created;
  if (!createdObjects || createdObjects.length === 0) {
    throw new Error("No objects created in the transaction");
  }

  const fileTransferObject = createdObjects.find(
    (obj: any) => obj.owner === "Shared",
  );
  if (!fileTransferObject) {
    throw new Error("FileTransfer object not found in transaction results");
  }

  return fileTransferObject.reference.objectId;
}

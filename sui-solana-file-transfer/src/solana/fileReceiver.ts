import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  Transaction,
} from "@solana/web3.js";
import config from "../../config/config.json";

export async function receiveFileTransfer(
  connection: Connection,
  payer: Keypair,
  vaa: Buffer,
): Promise<string> {
  const programId = new PublicKey(config.solana.program_id);

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      {
        pubkey: new PublicKey(config.wormhole.solana.core_bridge_address),
        isSigner: false,
        isWritable: false,
      },
      { pubkey: payer.publicKey, isSigner: true, isWritable: false },
    ],
    data: vaa,
  });

  const transaction = new Transaction().add(instruction);
  const signature = await connection.sendTransaction(transaction, [payer]);

  await connection.confirmTransaction(signature);
  return signature;
}

import { TransactionBlock } from "@mysten/sui.js";
import config from "../../config/config.json";

export function createFileTransferTransaction(
  arweaveUrl: string,
  recipientAddress: string,
): TransactionBlock {
  const tx = new TransactionBlock();
  tx.moveCall({
    target: `${config.sui.package_id}::file_transfer::create_file_transfer`,
    arguments: [
      tx.pure(arweaveUrl),
      tx.pure(Buffer.from(recipientAddress, "hex")),
    ],
  });
  return tx;
}

export function sendFileTransferTransaction(
  fileTransferId: string,
): TransactionBlock {
  const tx = new TransactionBlock();
  tx.moveCall({
    target: `${config.sui.package_id}::file_transfer::send_file_transfer`,
    arguments: [
      tx.object(fileTransferId),
      tx.object(config.wormhole.sui.core_state_object_id),
      tx.pure(2), // CHAIN_ID_SOLANA
      tx.pure(0), // nonce
      tx.pure(1_000_000), // fee
    ],
  });
  return tx;
}

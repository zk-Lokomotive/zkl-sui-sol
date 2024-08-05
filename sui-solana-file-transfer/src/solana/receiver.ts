import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { redeemOnSolana } from "@certusone/wormhole-sdk";
import config from "../../config/config.json";

const connection = new Connection(config.solana.rpc_url);
const keypair = Keypair.fromSecretKey(
  Buffer.from(config.solana.private_key, "hex"),
);

export async function receiveFileOnSolana(vaa: string): Promise<string> {
  try {
    const result = await redeemOnSolana(
      connection,
      config.wormhole.bridge_address,
      keypair,
      vaa,
    );

    return result.signature;
  } catch (error) {
    console.error("Error receiving file on Solana:", error);
    throw error;
  }
}

import { transferFromSui } from "@certusone/wormhole-sdk";
import config from "../../config/config.json";

export async function bridgeToSolana(
  suiTxId: string,
  recipientAddress: string,
): Promise<string> {
  try {
    const result = await transferFromSui(
      config.wormhole.bridge_address,
      config.sui.rpc_url,
      suiTxId,
      "solana",
      recipientAddress,
      0, // amount
      {
        // Options
      },
    );

    return result.vaa;
  } catch (error) {
    console.error("Error bridging to Solana:", error);
    throw error;
  }
}

/* Developed by @virjilakrum */
// 🏗️ @virjilakrum: Stay under construction
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    pubkey::Pubkey,
};
use wormhole_sdk::{Complete, Vaa};

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct FileMetadata {
    pub id: [u8; 32],
    pub url: String,
    pub original_sender: [u8; 32],
}

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let accounts_iter = &mut accounts.iter();
    let wormhole_bridge = next_account_info(accounts_iter)?;
    let vaa_account = next_account_info(accounts_iter)?;
    let recipient = next_account_info(accounts_iter)?;

    // Parse the VAA
    let vaa = Vaa::deserialize(instruction_data)?;

    // Verify the VAA signature using the Wormhole bridge
    wormhole_sdk::verify_vaa(wormhole_bridge, vaa_account, &vaa)?;

    // Extract file metadata from VAA payload
    let file_metadata = FileMetadata::deserialize(&mut &vaa.payload[..])?;

    // Create a PDA to store the file metadata
    let (metadata_account, _) =
        Pubkey::find_program_address(&[b"file_metadata", &file_metadata.id], program_id);

    // Store the file metadata in the PDA
    let metadata_account_info = next_account_info(accounts_iter)?;
    **metadata_account_info.try_borrow_mut_lamports()? += 1000000; // Rent exemption
    let mut data = metadata_account_info.try_borrow_mut_data()?;
    file_metadata.serialize(&mut &mut data[..])?;

    msg!("File received: {:?}", file_metadata);

    Ok(())
}

/* Developed by @virjilakrum */
// 🏗️ @virjilakrum: Stay under construction
use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    program_error::ProgramError,
    pubkey::Pubkey,
    system_instruction,
    sysvar::{rent::Rent, Sysvar},
};
use spl_associated_token_account::get_associated_token_address;
use std::str::FromStr;

// Define the state struct for our program
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct FileTransferState {
    pub arweave_url: String,
    pub recipient: Pubkey,
    pub sender: [u8; 32], // Sui address
    pub created_at: u64,
}

// Define the instruction enum
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum FileTransferInstruction {
    ReceiveFileTransfer {
        arweave_url: String,
        recipient: [u8; 32],
        sender: [u8; 32],
        created_at: u64,
    },
}

// Declare and export the program's entrypoint
entrypoint!(process_instruction);

// Program entrypoint's implementation
pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = FileTransferInstruction::try_from_slice(instruction_data)
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    match instruction {
        FileTransferInstruction::ReceiveFileTransfer {
            arweave_url,
            recipient,
            sender,
            created_at,
        } => receive_file_transfer(
            program_id,
            accounts,
            arweave_url,
            recipient,
            sender,
            created_at,
        ),
    }
}

// Implementation of ReceiveFileTransfer instruction
fn receive_file_transfer(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    arweave_url: String,
    recipient: [u8; 32],
    sender: [u8; 32],
    created_at: u64,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();

    let wormhole_bridge_info = next_account_info(account_info_iter)?;
    let payer_info = next_account_info(account_info_iter)?;
    let recipient_info = next_account_info(account_info_iter)?;
    let state_account_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;

    // Verify the recipient
    if recipient_info.key.to_bytes() != recipient {
        return Err(ProgramError::InvalidAccountData);
    }

    // Create state account if it doesn't exist
    if state_account_info.data_is_empty() {
        let rent = Rent::get()?;
        let space = std::mem::size_of::<FileTransferState>();
        let lamports = rent.minimum_balance(space);

        solana_program::program::invoke(
            &system_instruction::create_account(
                payer_info.key,
                state_account_info.key,
                lamports,
                space as u64,
                program_id,
            ),
            &[
                payer_info.clone(),
                state_account_info.clone(),
                system_program_info.clone(),
            ],
        )?;
    }

    // Deserialize the state account
    let mut state = FileTransferState::try_from_slice(&state_account_info.data.borrow())?;

    // Update the state
    state.arweave_url = arweave_url;
    state.recipient = *recipient_info.key;
    state.sender = sender;
    state.created_at = created_at;

    // Serialize and save the updated state
    state.serialize(&mut *state_account_info.data.borrow_mut())?;

    // Emit a log message
    msg!("File transfer received: {:?}", state);

    Ok(())
}

// Helper function to derive the state account address
pub fn get_state_account_address(program_id: &Pubkey, recipient: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(&[b"file_transfer", recipient.as_ref()], program_id).0
}

// Helper function to parse Wormhole VAA and extract payload
fn parse_vaa(vaa: &[u8]) -> Result<(String, [u8; 32], [u8; 32], u64), ProgramError> {
    // This is a simplified parsing. In a real-world scenario, you'd need to properly
    // parse the VAA structure according to Wormhole's specification.
    let payload = &vaa[..]; // Assume the entire VAA is the payload for simplicity

    // Parse the payload
    let arweave_url_len = payload[0] as usize;
    let arweave_url = String::from_utf8(payload[1..1 + arweave_url_len].to_vec())
        .map_err(|_| ProgramError::InvalidInstructionData)?;

    let mut recipient = [0u8; 32];
    recipient.copy_from_slice(&payload[1 + arweave_url_len..1 + arweave_url_len + 32]);

    let mut sender = [0u8; 32];
    sender.copy_from_slice(&payload[1 + arweave_url_len + 32..1 + arweave_url_len + 64]);

    let created_at = u64::from_le_bytes(
        payload[1 + arweave_url_len + 64..1 + arweave_url_len + 72]
            .try_into()
            .unwrap(),
    );

    Ok((arweave_url, recipient, sender, created_at))
}

// Tests module
#[cfg(test)]
mod tests {
    use super::*;
    use solana_program::clock::Epoch;

    #[test]
    fn test_receive_file_transfer() {
        let program_id = Pubkey::new_unique();
        let recipient_key = Pubkey::new_unique();

        let (state_pubkey, _) =
            Pubkey::find_program_address(&[b"file_transfer", recipient_key.as_ref()], &program_id);

        let mut lamports = 0;
        let mut data = vec![0; std::mem::size_of::<FileTransferState>()];
        let owner = program_id;

        let state_account = AccountInfo::new(
            &state_pubkey,
            false,
            true,
            &mut lamports,
            &mut data,
            &owner,
            false,
            Epoch::default(),
        );

        let mut instruction_data = Vec::new();
        FileTransferInstruction::ReceiveFileTransfer {
            arweave_url: "https://arweave.net/abcdef".to_string(),
            recipient: recipient_key.to_bytes(),
            sender: [1; 32],
            created_at: 1234567890,
        }
        .serialize(&mut instruction_data)
        .unwrap();

        let accounts = vec![
            AccountInfo::new(
                &Pubkey::new_unique(),
                false,
                false,
                &mut 0,
                &mut [],
                &Pubkey::new_unique(),
                false,
                Epoch::default(),
            ),
            AccountInfo::new(
                &Pubkey::new_unique(),
                true,
                false,
                &mut 0,
                &mut [],
                &Pubkey::new_unique(),
                false,
                Epoch::default(),
            ),
            AccountInfo::new(
                &recipient_key,
                false,
                false,
                &mut 0,
                &mut [],
                &Pubkey::new_unique(),
                false,
                Epoch::default(),
            ),
            state_account,
            AccountInfo::new(
                &solana_program::system_program::id(),
                false,
                false,
                &mut 0,
                &mut [],
                &Pubkey::new_unique(),
                false,
                Epoch::default(),
            ),
        ];

        let result = process_instruction(&program_id, &accounts, &instruction_data);
        assert!(result.is_ok());

        let state = FileTransferState::try_from_slice(&accounts[3].data.borrow()).unwrap();
        assert_eq!(state.arweave_url, "https://arweave.net/abcdef");
        assert_eq!(state.recipient, recipient_key);
        assert_eq!(state.sender, [1; 32]);
        assert_eq!(state.created_at, 1234567890);
    }
}

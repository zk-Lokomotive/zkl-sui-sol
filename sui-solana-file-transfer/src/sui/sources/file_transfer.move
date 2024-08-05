module sui_solana_file_transfer::file_transfer {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::clock::{Self, Clock};
    use sui::event;
    use sui::package;
    use sui::wormhole::{Self, State, SequenceValue};
    use std::vector;

    // Errors
    const EInvalidRecipientAddress: u64 = 0;
    const EInvalidArweaveUrl: u64 = 1;
    const EInvalidChainId: u64 = 2;
    const EInsufficientFee: u64 = 3;

    // Constants
    const SOLANA_CHAIN_ID: u16 = 1;
    const MIN_FEE: u64 = 1_000_000; // Minimum fee in MIST (1 SUI = 1_000_000_000 MIST)

    // Structs
    struct FileTransfer has key, store {
        id: UID,
        arweave_url: vector<u8>,
        recipient_address: vector<u8>,
        sender: address,
        created_at: u64,
    }

    struct FileTransferCreated has copy, drop {
        id: UID,
        arweave_url: vector<u8>,
        recipient_address: vector<u8>,
        sender: address,
        created_at: u64,
    }

    struct FileTransferSent has copy, drop {
        id: UID,
        sequence: u64,
        emitter: vector<u8>,
        payload: vector<u8>,
    }

    // Functions
    public entry fun create_file_transfer(
        arweave_url: vector<u8>,
        recipient_address: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(vector::length(&recipient_address) == 32, EInvalidRecipientAddress);
        assert!(vector::length(&arweave_url) > 0, EInvalidArweaveUrl);

        let file_transfer = FileTransfer {
            id: object::new(ctx),
            arweave_url,
            recipient_address,
            sender: tx_context::sender(ctx),
            created_at: clock::timestamp_ms(clock),
        };

        event::emit(FileTransferCreated {
            id: object::uid_to_inner(&file_transfer.id),
            arweave_url: file_transfer.arweave_url,
            recipient_address: file_transfer.recipient_address,
            sender: file_transfer.sender,
            created_at: file_transfer.created_at,
        });

        transfer::share_object(file_transfer);
    }

    public entry fun send_file_transfer(
        file_transfer: &FileTransfer,
        wormhole_state: &mut State,
        clock: &Clock,
        fee: u64,
        nonce: u32,
        ctx: &mut TxContext
    ) {
        assert!(fee >= MIN_FEE, EInsufficientFee);

        let payload = encode_payload(file_transfer);
        let (sequence, emitter) = wormhole::publish_message(
            wormhole_state,
            SOLANA_CHAIN_ID,
            payload,
            nonce,
            fee,
            clock,
            ctx
        );

        event::emit(FileTransferSent {
            id: object::uid_to_inner(&file_transfer.id),
            sequence,
            emitter,
            payload,
        });
    }

    fun encode_payload(file_transfer: &FileTransfer): vector<u8> {
        let payload = vector::empty<u8>();
        vector::append(&mut payload, file_transfer.arweave_url);
        vector::append(&mut payload, file_transfer.recipient_address);
        vector::append(&mut payload, bcs::to_bytes(&file_transfer.sender));
        vector::append(&mut payload, bcs::to_bytes(&file_transfer.created_at));
        payload
    }

    // For upgradeability
    struct FILE_TRANSFER has drop {}

    fun init(otw: FILE_TRANSFER, ctx: &mut TxContext) {
        package::claim_and_keep(otw, ctx)
    }
}

module file_transfer {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::url::{Self, Url};
    use sui::event;
    use sui::package;
    use wormhole::state::{State};
    use wormhole::message::{Self};
    use wormhole::bytes32::{Self};

    struct FileObject has key, store {
        id: UID,
        url: Url,
        recipient: vector<u8>,
    }

    struct FileTransferInitiated has copy, drop {
        id: ID,
        url: Url,
        recipient: vector<u8>,
    }

    fun init(ctx: &mut TxContext) {
        transfer::share_object(State::new(ctx));
    }

    public entry fun create_file_object(url: vector<u8>, recipient: vector<u8>, ctx: &mut TxContext) {
        let file_object = FileObject {
            id: object::new(ctx),
            url: url::new_unsafe_from_bytes(url),
            recipient,
        };

        event::emit(FileTransferInitiated {
            id: object::id(&file_object),
            url: file_object.url,
            recipient: file_object.recipient,
        });

        transfer::transfer(file_object, tx_context::sender(ctx));
    }

    public entry fun initiate_transfer(
        file_object: FileObject,
        wormhole_state: &mut State,
        recipient_chain: u16,
        nonce: u32,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        let payload = create_transfer_payload(&file_object);

        let message = message::create(
            wormhole_state,
            0, // consistency level
            recipient_chain,
            bytes32::from_address(sender),
            payload,
            nonce,
            ctx
        );

        message::send(wormhole_state, message, ctx);

        // Burn the FileObject on Sui after initiating transfer
        transfer::transfer(file_object, @0x0);
    }

    fun create_transfer_payload(file_object: &FileObject): vector<u8> {
        let payload = vector::empty();
        vector::append(&mut payload, object::id_to_bytes(&file_object.id));
        vector::append(&mut payload, url::to_bytes(&file_object.url));
        vector::append(&mut payload, file_object.recipient);
        payload
    }
}

import Arweave from 'arweave';
import { JWKInterface } from 'arweave/node/lib/wallet';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { receiveFileTransfer } from '../solana/fileReceiver';
import { sendFileTransfer } from '../sui/fileTransfer';

// Initialize Arweave
const arweave = Arweave.init({
    host: 'arweave.net',
    port: 443,
    protocol: 'https'
});

// Load Arweave wallet (you should store this securely, not in the code)
const arweaveWallet: JWKInterface = JSON.parse(process.env.ARWEAVE_WALLET_JSON || '{}');

// Solana connection
const solanaConnection = new Connection('https://api.mainnet-beta.solana.com');

// Sui connection (placeholder, adjust based on Sui SDK)
const suiConnection = new SuiConnection('https://fullnode.mainnet.sui.io');

// Allowed file extensions
const ALLOWED_EXTENSIONS = ['txt', 'pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'];

export async function handleFileUpload(file: File, recipientAddress: string): Promise<string> {
    try {
        // Check file extension
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        if (!fileExtension || !ALLOWED_EXTENSIONS.includes(fileExtension)) {
            throw new Error('Invalid file type. Allowed types are: ' + ALLOWED_EXTENSIONS.join(', '));
        }

        // Upload to Arweave
        const arweaveUrl = await uploadToArweave(file);

        // Determine if recipient is on Solana or Sui
        if (isValidSolanaAddress(recipientAddress)) {
            await sendToSolana(arweaveUrl, recipientAddress);
        } else if (isValidSuiAddress(recipientAddress)) {
            await sendToSui(arweaveUrl, recipientAddress);
        } else {
            throw new Error('Invalid recipient address');
        }

        return arweaveUrl;
    } catch (error) {
        console.error('File upload failed:', error);
        throw error;
    }
}

async function uploadToArweave(file: File): Promise<string> {
    const fileReader = new FileReader();
    const fileBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        fileReader.onload = () => resolve(fileReader.result as ArrayBuffer);
        fileReader.onerror = reject;
        fileReader.readAsArrayBuffer(file);
    });

    const transaction = await arweave.createTransaction({ data: fileBuffer }, arweaveWallet);
    transaction.addTag('Content-Type', file.type);

    await arweave.transactions.sign(transaction, arweaveWallet);
    const response = await arweave.transactions.post(transaction);

    if (response.status === 200) {
        return `https://arweave.net/${transaction.id}`;
    } else {
        throw new Error('Arweave upload failed');
    }
}

async function sendToSolana(arweaveUrl: string, recipientAddress: string) {
    const recipientPublicKey = new PublicKey(recipientAddress);
    const senderKeypair = Keypair.generate(); // In a real app, you'd use the user's actual keypair

    await receiveFileTransfer(
        solanaConnection,
        senderKeypair,
        recipientPublicKey,
        arweaveUrl
    );
}

async function sendToSui(arweaveUrl: string, recipientAddress: string) {
    // This is a placeholder. You'll need to implement this based on your Sui SDK
    await sendFileTransfer(
        suiConnection,
        recipientAddress,
        arweaveUrl
    );
}

function isValidSolanaAddress(address: string): boolean {
    try {
        new PublicKey(address);
        return true;
    } catch {
        return false;
    }
}

function isValidSuiAddress(address: string): boolean {
    // Implement Sui address validation logic
    // This is a placeholder. Replace with actual Sui address validation
    return address.startsWith('0x') && address.length === 66;
}

// UI Component (React example)
import React, { useState } from 'react';

export function FileUploadComponent() {
    const [file, setFile] = useState<File | null>(null);
    const [recipientAddress, setRecipientAddress] = useState('');
    const [arweaveUrl, setArweaveUrl] = useState('');

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setFile(event.target.files[0]);
        }
    };

    const handleAddressChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRecipientAddress(event.target.value);
    };

    const handleUpload = async () => {
        if (file && recipientAddress) {
            try {
                const url = await handleFileUpload(file, recipientAddress);
                setArweaveUrl(url);
            } catch (error) {
                console.error('Upload failed:', error);
                alert('Upload failed. Please try again.');
            }
        }
    };

    return (
        <div>
            <input type="file" onChange={handleFileChange} />
            <input
                type="text"
                value={recipientAddress}
                onChange={handleAddressChange}
                placeholder="Recipient Address"
            />
            <button onClick={handleUpload} disabled={!file || !recipientAddress}>
                Upload and Send
            </button>
            {arweaveUrl && <p>File uploaded: {arweaveUrl}</p>}
        </div>
    );
}

import { Connection, PublicKey } from '@solana/web3.js';
import { receiveFileTransfer } from '../solana/fileReceiver';
import { sendFileTransfer } from '../sui/fileTransfer';

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

        // Upload to Arweave via server API
        const arweaveUrl = await uploadToArweaveViaApi(file);

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

async function uploadToArweaveViaApi(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload-to-arweave', {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new Error('Server-side Arweave upload failed');
    }

    const data = await response.json();
    return data.arweaveUrl;
}

async function sendToSolana(arweaveUrl: string, recipientAddress: string) {
    const recipientPublicKey = new PublicKey(recipientAddress);
    // Note: In a real application, you'd need to handle signing transactions
    // This might involve sending a request to a backend service or using a wallet adapter
    await receiveFileTransfer(
        solanaConnection,
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
    const [isUploading, setIsUploading] = useState(false);

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
            setIsUploading(true);
            try {
                const url = await handleFileUpload(file, recipientAddress);
                setArweaveUrl(url);
            } catch (error) {
                console.error('Upload failed:', error);
                alert('Upload failed. Please try again.');
            } finally {
                setIsUploading(false);
            }
        }
    };

    return (
        <div>
            <input type="file" onChange={handleFileChange} disabled={isUploading} />
            <input
                type="text"
                value={recipientAddress}
                onChange={handleAddressChange}
                placeholder="Recipient Address"
                disabled={isUploading}
            />
            <button onClick={handleUpload} disabled={!file || !recipientAddress || isUploading}>
                {isUploading ? 'Uploading...' : 'Upload and Send'}
            </button>
            {arweaveUrl && <p>File uploaded: {arweaveUrl}</p>}
        </div>
    );
}

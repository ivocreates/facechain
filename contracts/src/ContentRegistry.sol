// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ContentRegistry
/// @notice Stores tamper-evident cryptographic fingerprints (SHA-256) of
///         discovered/verified content, together with provenance metadata.
///         The contract NEVER stores raw images, face embeddings, or any
///         biometric data — only a hash, a source URL, a timestamp and the
///         submitting wallet address.
contract ContentRegistry {
    struct ContentRecord {
        uint256 id;
        bytes32 contentHash; // SHA-256 fingerprint of canonicalized content
        string sourceUrl;
        uint256 timestamp;
        address submitter;
    }

    /// @dev recordId => record
    mapping(uint256 => ContentRecord) private records;

    /// @dev contentHash => recordId (0 means "not registered")
    mapping(bytes32 => uint256) private hashToRecordId;

    uint256 private nextRecordId = 1;

    event ContentRegistered(
        uint256 indexed recordId,
        bytes32 indexed contentHash,
        string sourceUrl,
        uint256 timestamp,
        address indexed submitter
    );

    error EmptyHash();
    error EmptySourceUrl();
    error RecordNotFound(uint256 recordId);
    error DuplicateHash(bytes32 contentHash, uint256 existingRecordId);

    /// @notice Register a new content fingerprint on-chain.
    /// @param contentHash SHA-256 hash of the canonicalized content (32 bytes).
    /// @param sourceUrl The URL / reference of the verified content.
    /// @return recordId The ID assigned to the newly created record.
    function registerContent(bytes32 contentHash, string calldata sourceUrl)
        external
        returns (uint256 recordId)
    {
        if (contentHash == bytes32(0)) revert EmptyHash();
        if (bytes(sourceUrl).length == 0) revert EmptySourceUrl();

        uint256 existing = hashToRecordId[contentHash];
        if (existing != 0) revert DuplicateHash(contentHash, existing);

        recordId = nextRecordId++;

        records[recordId] = ContentRecord({
            id: recordId,
            contentHash: contentHash,
            sourceUrl: sourceUrl,
            timestamp: block.timestamp,
            submitter: msg.sender
        });

        hashToRecordId[contentHash] = recordId;

        emit ContentRegistered(recordId, contentHash, sourceUrl, block.timestamp, msg.sender);
    }

    /// @notice Retrieve a stored content record by ID.
    function getRecord(uint256 recordId) external view returns (ContentRecord memory) {
        ContentRecord memory record = records[recordId];
        if (record.id == 0) revert RecordNotFound(recordId);
        return record;
    }

    /// @notice Verify whether a supplied hash matches the record stored under recordId.
    function verifyContent(uint256 recordId, bytes32 contentHash) external view returns (bool) {
        ContentRecord memory record = records[recordId];
        if (record.id == 0) revert RecordNotFound(recordId);
        return record.contentHash == contentHash;
    }

    /// @notice Look up a recordId directly from a content hash (0 if not found).
    function recordIdForHash(bytes32 contentHash) external view returns (uint256) {
        return hashToRecordId[contentHash];
    }

    /// @notice Total number of records stored.
    function totalRecords() external view returns (uint256) {
        return nextRecordId - 1;
    }
}

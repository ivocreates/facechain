// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ContentRegistry} from "../src/ContentRegistry.sol";

contract ContentRegistryTest is Test {
    ContentRegistry registry;

    bytes32 constant HASH_A = keccak256("content-A"); // stand-in 32-byte hash for tests
    bytes32 constant HASH_B = keccak256("content-B");
    string constant URL_A = "https://example.com/post/a";

    address alice = address(0xA11CE);

    function setUp() public {
        registry = new ContentRegistry();
    }

    function test_RegisterContent_CreatesRecord() public {
        vm.prank(alice);
        uint256 id = registry.registerContent(HASH_A, URL_A);
        assertEq(id, 1);

        ContentRegistry.ContentRecord memory rec = registry.getRecord(id);
        assertEq(rec.contentHash, HASH_A);
        assertEq(rec.sourceUrl, URL_A);
        assertEq(rec.submitter, alice);
        assertGt(rec.timestamp, 0);
    }

    function test_VerifyContent_CorrectHash_ReturnsTrue() public {
        uint256 id = registry.registerContent(HASH_A, URL_A);
        assertTrue(registry.verifyContent(id, HASH_A));
    }

    function test_VerifyContent_TamperedHash_ReturnsFalse() public {
        // Register hash A, then attempt to verify against hash B -> must be FALSE.
        uint256 id = registry.registerContent(HASH_A, URL_A);
        assertFalse(registry.verifyContent(id, HASH_B));
    }

    function test_MultipleRecords_IncrementIds() public {
        uint256 id1 = registry.registerContent(HASH_A, URL_A);
        uint256 id2 = registry.registerContent(HASH_B, "https://example.com/post/b");
        assertEq(id1, 1);
        assertEq(id2, 2);
        assertEq(registry.totalRecords(), 2);
    }

    function test_SourceUrlStorage() public {
        uint256 id = registry.registerContent(HASH_A, URL_A);
        ContentRegistry.ContentRecord memory rec = registry.getRecord(id);
        assertEq(rec.sourceUrl, URL_A);
    }

    function test_TimestampIsBlockTimestamp() public {
        vm.warp(12345);
        uint256 id = registry.registerContent(HASH_A, URL_A);
        ContentRegistry.ContentRecord memory rec = registry.getRecord(id);
        assertEq(rec.timestamp, 12345);
    }

    function test_EventEmission() public {
        vm.expectEmit(true, true, true, true);
        emit ContentRegistry.ContentRegistered(1, HASH_A, URL_A, block.timestamp, address(this));
        registry.registerContent(HASH_A, URL_A);
    }

    function test_RevertOnEmptyHash() public {
        vm.expectRevert(ContentRegistry.EmptyHash.selector);
        registry.registerContent(bytes32(0), URL_A);
    }

    function test_RevertOnEmptySourceUrl() public {
        vm.expectRevert(ContentRegistry.EmptySourceUrl.selector);
        registry.registerContent(HASH_A, "");
    }

    function test_RevertOnDuplicateHash() public {
        registry.registerContent(HASH_A, URL_A);
        vm.expectRevert(abi.encodeWithSelector(ContentRegistry.DuplicateHash.selector, HASH_A, 1));
        registry.registerContent(HASH_A, "https://example.com/different-url");
    }

    function test_RevertOnMissingRecord() public {
        vm.expectRevert(abi.encodeWithSelector(ContentRegistry.RecordNotFound.selector, 999));
        registry.getRecord(999);
    }

    function test_RecordIdForHash() public {
        uint256 id = registry.registerContent(HASH_A, URL_A);
        assertEq(registry.recordIdForHash(HASH_A), id);
        assertEq(registry.recordIdForHash(HASH_B), 0);
    }
}

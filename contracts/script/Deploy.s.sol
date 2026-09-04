// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ContentRegistry} from "../src/ContentRegistry.sol";

/// @notice Deploys ContentRegistry.
/// Usage (local / Anvil):
///   forge script script/Deploy.s.sol:Deploy --rpc-url http://127.0.0.1:8545 --broadcast --private-key $PRIVATE_KEY
/// Usage (Sepolia):
///   forge script script/Deploy.s.sol:Deploy --rpc-url $SEPOLIA_RPC_URL --broadcast --private-key $PRIVATE_KEY --verify
contract Deploy is Script {
    function run() external returns (ContentRegistry) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerKey);
        ContentRegistry registry = new ContentRegistry();
        vm.stopBroadcast();

        console.log("ContentRegistry deployed at:", address(registry));
        return registry;
    }
}

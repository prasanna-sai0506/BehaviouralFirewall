import hashlib
import json
import os
from time import time
from .block import Block

class Blockchain:
    def __init__(self, difficulty=1):
        self.chain = []
        self.difficulty = difficulty
        self.persistence_file = "blockchain_data.json"
        
        if os.path.exists(self.persistence_file):
            self.load_chain()
        else:
            self.create_genesis_block()

    def load_chain(self):
        try:
            with open(self.persistence_file, 'r') as f:
                chain_data = json.load(f)
                self.chain = []
                for b in chain_data:
                    block = Block(b['index'], b['transactions'], b['timestamp'], b['previous_hash'], b['nonce'])
                    block.hash = b['hash']
                    self.chain.append(block)
                print(f"BF-SHIELD: Loaded {len(self.chain)} blocks from disk.")
        except Exception as e:
            print(f"Error loading blockchain: {e}")
            self.create_genesis_block()

    def save_chain(self):
        try:
            with open(self.persistence_file, 'w') as f:
                json.dump(self.to_dict(), f, indent=4)
        except Exception as e:
            print(f"Error saving blockchain: {e}")

    def create_genesis_block(self):
        """
        Creates the first block of the chain
        """
        genesis_block = Block(0, [], time(), "0")
        self.proof_of_work(genesis_block)
        self.chain.append(genesis_block)
        self.save_chain()

    def get_latest_block(self):
        return self.chain[-1]

    def get_block_by_index(self, index):
        if 0 <= index < len(self.chain):
            return self.chain[index]
        return None

    def add_block(self, transactions):
        """
        Adds a new block to the chain with the given transactions
        """
        previous_block = self.get_latest_block()
        new_block = Block(
            index=len(self.chain),
            transactions=transactions,
            timestamp=time(),
            previous_hash=previous_block.hash
        )
        self.proof_of_work(new_block)
        self.chain.append(new_block)
        
        # Save on every block for dev visibility
        self.save_chain()
            
        return new_block

    def proof_of_work(self, block):
        """
        Proof of Work algorithm:
        - Find a nonce such that the hash of the block starts with 4 zeros
        """
        target = "0" * self.difficulty
        while block.hash[:self.difficulty] != target:
            block.nonce += 1
            block.hash = block.hash_block()

    def is_chain_valid(self):
        """
        Validates the integrity of the blockchain
        """
        for i in range(1, len(self.chain)):
            current_block = self.chain[i]
            previous_block = self.chain[i-1]

            # 1. Check if the hash of the block is correct
            if current_block.hash != current_block.hash_block():
                return False

            # 2. Check if the block refers to the correct previous hash
            if current_block.previous_hash != previous_block.hash:
                return False

            # 3. Check if the proof of work is valid
            if current_block.hash[:self.difficulty] != "0" * self.difficulty:
                return False
        
        return True

    def get_block_by_index(self, index):
        if 0 <= index < len(self.chain):
            return self.chain[index]
        return None

    def to_dict(self):
        return [block.to_dict() for block in self.chain]

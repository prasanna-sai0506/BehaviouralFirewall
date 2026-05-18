import unittest
from app.blockchain.chain import Blockchain
from app.blockchain.block import Block

class TestBlockchain(unittest.TestCase):
    def setUp(self):
        self.blockchain = Blockchain(difficulty=1)

    def test_genesis_block(self):
        self.assertEqual(len(self.blockchain.chain), 1)
        self.assertEqual(self.blockchain.chain[0].index, 0)

    def test_add_block(self):
        self.blockchain.add_block([{"data": "test"}])
        self.assertEqual(len(self.blockchain.chain), 2)
        self.assertEqual(self.blockchain.chain[1].index, 1)

    def test_integrity(self):
        self.blockchain.add_block([{"data": "test"}])
        self.assertTrue(self.blockchain.is_chain_valid())
        
        # Tamper
        self.blockchain.chain[1].transactions = [{"data": "tampered"}]
        self.assertFalse(self.blockchain.is_chain_valid())

if __name__ == '__main__':
    unittest.main()

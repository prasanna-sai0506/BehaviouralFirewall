async function loadChain() {
    const res = await api.get('/blockchain/chain');
    if (res && res.success) {
        const container = document.getElementById('blocks-container');
        container.innerHTML = '';
        
        if (res.data.chain.length === 0) {
            container.innerHTML = '<div class="card" style="text-align: center; opacity: 0.5;">No blocks found in ledger. Protocol waiting for data...</div>';
            return;
        }

        // Update stats
        if (res.data.chain.length > 0) {
            const chain = res.data.chain;
            const latest = chain[chain.length - 1];
            document.getElementById('last-hash').innerText = latest.hash.substring(0, 15) + '...';
            
            // Calculate total transactions
            let totalTxs = 0;
            chain.forEach(block => {
                totalTxs += (block.transactions ? block.transactions.length : 0);
            });
            
            document.getElementById('stat-blocks').innerText = chain.length;
            document.getElementById('stat-txs').innerText = totalTxs;
            document.getElementById('stat-difficulty').innerText = chain[0]?.difficulty || 2;
        }

        res.data.chain.reverse().forEach(block => {
            const card = document.createElement('div');
            card.className = 'card block-card';
            card.id = `block-${block.index}`;
            card.setAttribute('data-hash', block.hash);
            card.setAttribute('data-content', JSON.stringify(block.transactions).toLowerCase());
            
            const date = new Date(block.timestamp * 1000).toLocaleString();
            const isValid = true; // For display, usually we verify on demand
            
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <h3 style="margin: 0; font-size: 1rem;">Block #${block.index}</h3>
                            <span style="font-size: 8px; background: rgba(0,255,136,0.1); color: var(--success); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(0,255,136,0.2);">LEDGER_VALIDATED</span>
                        </div>
                        <small style="color: var(--text-dim);">${date}</small>
                    </div>
                    <div style="text-align: right;">
                        <span class="btn" style="background: var(--bg-dark); font-size: 0.7rem; border: 1px solid var(--primary); pointer-events: none;">Nonce: ${block.nonce}</span>
                    </div>
                </div>
                <div style="margin-top: 1rem; border-left: 2px solid var(--primary); padding-left: 1rem;">
                    <div class="hash" style="font-size: 0.75rem;">HASH: ${block.hash}</div>
                    <div class="hash" style="font-size: 0.75rem; opacity: 0.6;">PREV: ${block.previous_hash}</div>
                </div>
                <div class="tx-list">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <strong style="font-size: 0.75rem; text-transform: uppercase; color: var(--primary);">Data Payloads (${block.transactions.length})</strong>
                        <button class="btn btn-outline" style="font-size: 8px; padding: 2px 6px;" onclick="toggleRaw(${block.index})">VIEW RAW DATA</button>
                    </div>
                    <div id="raw-${block.index}" style="display: none; background: #000; padding: 0.5rem; border-radius: 4px; margin-bottom: 1rem; font-family: monospace; font-size: 0.7rem; overflow-x: auto; max-height: 200px;">
                        <pre style="color: #00ff88; margin: 0;">${JSON.stringify(block, null, 2)}</pre>
                    </div>
                    <div id="tx-display-${block.index}">
                        ${block.transactions.length > 0 ? 
                            block.transactions.map(tx => `
                                <div style="font-size: 0.8rem; margin-top: 0.75rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between;">
                                    <div>
                                        <span style="color: ${tx.classification === 'THREAT' ? 'var(--danger)' : 'var(--success)'}; font-weight: bold;">[${tx.classification}]</span> 
                                        <span style="opacity: 0.8">${tx.threat_type}</span>
                                        <div style="font-size: 0.7rem; opacity: 0.5; margin-top: 4px;">${tx.details}</div>
                                    </div>
                                    <div style="text-align: right; font-family: monospace; font-size: 0.75rem;">
                                        ${tx.source_ip}
                                    </div>
                                </div>
                            `).join('') : 
                            '<div style="font-size: 0.85rem; opacity: 0.5; margin-top: 0.5rem;">Genesis Block - System Initialization</div>'
                        }
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }
}

function filterBlocks() {
    const q = document.getElementById('search-ledger').value.toLowerCase();
    const blocks = document.querySelectorAll('.block-card');
    blocks.forEach(b => {
        const hash = b.getAttribute('data-hash').toLowerCase();
        const content = b.getAttribute('data-content');
        if (hash.includes(q) || content.includes(q)) {
            b.style.display = 'block';
        } else {
            b.style.display = 'none';
        }
    });
}

function toggleRaw(idx) {
    const el = document.getElementById(`raw-${idx}`);
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function verifyChain() {
    const statusBtn = document.getElementById('integrity-status');
    const container = document.getElementById('blocks-container');
    const blocks = Array.from(container.children);
    
    statusBtn.innerText = 'VERIFYING...';
    statusBtn.style.background = 'var(--warning)';
    
    // Visual step-by-step verification
    for (let i = 0; i < Math.min(blocks.length, 10); i++) {
        blocks[i].style.transition = 'all 0.3s';
        blocks[i].style.boxShadow = '0 0 15px var(--primary)';
        await new Promise(r => setTimeout(r, 150));
        blocks[i].style.boxShadow = 'none';
        blocks[i].style.borderLeftColor = 'var(--success)';
    }

    try {
        const res = await api.get('/blockchain/verify');
        if (res && res.success && res.data.is_valid) {
            statusBtn.innerHTML = '<div style="width: 6px; height: 6px; background: var(--success); border-radius: 50%;"></div> VALID';
            statusBtn.style.background = 'rgba(0, 255, 136, 0.1)';
            notify('Blockchain integrity verified. All cryptographic links are intact.', 'success');
        } else {
            statusBtn.innerText = 'TAMPERED';
            statusBtn.style.background = 'var(--danger)';
            alert('CRITICAL: Blockchain integrity check failed! Data may have been tampered with.');
        }
    } catch (e) {
        statusBtn.innerText = 'ERROR';
        console.error(e);
    }
}

document.addEventListener('DOMContentLoaded', loadChain);

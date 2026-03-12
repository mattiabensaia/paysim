document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const myPeerIdDisplay = document.getElementById('myPeerId');
    const walletBalance = document.getElementById('walletBalance');
    const transactionList = document.getElementById('transactionList');
    const notificationOverlay = document.getElementById('notificationOverlay');
    const notifAmount = document.getElementById('notifAmount');
    const notifSender = document.getElementById('notifSender');
    const connStatusIcon = document.getElementById('connStatus');
    const displayUserName = document.getElementById('displayUserName');

    // State & Persistence
    let currentBalance = parseFloat(localStorage.getItem('user_balance')) || 12.50;
    walletBalance.textContent = currentBalance.toFixed(2);

    const saveBalance = (newBalance) => {
        currentBalance = newBalance;
        localStorage.setItem('user_balance', currentBalance.toFixed(2));
        walletBalance.textContent = currentBalance.toFixed(2);
    };

    const addTransaction = (amount, sender) => {
        const now = new Date();
        const timeString = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

        const txDiv = document.createElement('div');
        txDiv.className = 'transaction-item';
        txDiv.innerHTML = `
            <div class="tx-icon in"><i class="fas fa-plus"></i></div>
            <div class="tx-details">
                <div class="tx-title">Resto da ${sender || 'Cassa'}</div>
                <div class="tx-time">Oggi, ${timeString}</div>
            </div>
            <div class="tx-amount positive">+${parseFloat(amount).toFixed(2)} €</div>
        `;
        transactionList.insertBefore(txDiv, transactionList.firstChild);

        // Persist transactions too
        const history = JSON.parse(localStorage.getItem('tx_history') || '[]');
        history.unshift({ amount, sender, time: timeString });
        localStorage.setItem('tx_history', JSON.stringify(history.slice(0, 10)));
    };

    // Load History
    const loadHistory = () => {
        const history = JSON.parse(localStorage.getItem('tx_history') || '[]');
        history.forEach(tx => {
            const txDiv = document.createElement('div');
            txDiv.className = 'transaction-item';
            txDiv.innerHTML = `
                <div class="tx-icon in"><i class="fas fa-plus"></i></div>
                <div class="tx-details">
                    <div class="tx-title">Resto da ${tx.sender || 'Cassa'}</div>
                    <div class="tx-time">Oggi, ${tx.time}</div>
                </div>
                <div class="tx-amount positive">+${parseFloat(tx.amount).toFixed(2)} €</div>
            `;
            transactionList.appendChild(txDiv);
        });
    };
    loadHistory();

    const processIncomingPayment = (data) => {
        console.log('Processing payment:', data);
        const amount = parseFloat(data.amount);

        // Notification
        notifAmount.textContent = '+' + amount.toFixed(2) + ' €';
        notifSender.textContent = 'Da: ' + (data.sender || 'Cassa');
        notificationOverlay.classList.add('active');

        if (data.customer) {
            displayUserName.textContent = data.customer.split(' ')[0];
        }

        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

        setTimeout(() => {
            notificationOverlay.classList.remove('active');

            // Update Balance & Persist
            saveBalance(currentBalance + amount);

            walletBalance.parentElement.classList.add('pop');
            setTimeout(() => {
                walletBalance.parentElement.classList.remove('pop');
            }, 500);

            addTransaction(amount, data.sender);
        }, 1500); // Shorter duration for better feel
    };

    // PeerJS Logic
    const friendlyId = 'mattia-' + Math.floor(1000 + Math.random() * 9000);
    const peer = new Peer(friendlyId);

    peer.on('open', (id) => {
        myPeerIdDisplay.textContent = id;
        connStatusIcon.innerHTML = '<i class="fas fa-wifi" style="color: var(--success)"></i>';
    });

    peer.on('connection', (conn) => {
        connStatusIcon.innerHTML = '<i class="fas fa-link" style="color: var(--accent)"></i>';
        conn.on('data', (data) => {
            if (data.type === 'PAYMENT') processIncomingPayment(data);
        });
    });

    // QR & URL Logic - reads from HASH fragment (survives Serveo redirect)
    // and falls back to query params (for localhost testing)
    const checkUrlParams = () => {
        let params;
        if (window.location.hash && window.location.hash.length > 1) {
            params = new URLSearchParams(window.location.hash.substring(1));
            console.log('Reading payment from HASH fragment');
        } else {
            params = new URLSearchParams(window.location.search);
            console.log('Reading payment from QUERY params');
        }

        const amount = params.get('amount');
        const customer = params.get('customer');
        const ts = params.get('ts');

        console.log('Payment data found:', { amount, customer, ts });

        const lastTs = localStorage.getItem('last_payment_ts');
        if (amount && ts && ts !== lastTs) {
            localStorage.setItem('last_payment_ts', ts);
            const data = {
                type: 'PAYMENT',
                amount: parseFloat(amount),
                customer: customer || 'Utente',
                sender: 'QR Cassa'
            };
            processIncomingPayment(data);

            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    };

    // Run immediately on load
    checkUrlParams();
    // Also listen for hash changes (in case redirect adds hash after load)
    window.addEventListener('hashchange', checkUrlParams);
});

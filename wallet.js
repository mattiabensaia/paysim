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
        transactionList.innerHTML = ''; // Clear current list
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

    // Sync between tabs/PWA and Browser
    window.addEventListener('storage', (e) => {
        if (e.key === 'user_balance') {
            currentBalance = parseFloat(e.newValue);
            walletBalance.textContent = currentBalance.toFixed(2);
        }
        if (e.key === 'tx_history') {
            loadHistory();
        }
    });

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

    const checkUrlParams = () => {
        let params;
        if (window.location.hash && window.location.hash.length > 1) {
            params = new URLSearchParams(window.location.hash.substring(1));
        } else {
            params = new URLSearchParams(window.location.search);
        }

        const amount = params.get('amount');
        const customer = params.get('customer');
        const ts = params.get('ts');

        if (amount && ts) {
            const lastTs = localStorage.getItem('last_payment_ts');
            // Remove the strict check for lastTs if it's coming from a fresh URL load
            // since clearing the hash prevents accidental double loading anyway.
            localStorage.setItem('last_payment_ts', ts);
            const data = {
                type: 'PAYMENT',
                amount: parseFloat(amount),
                customer: customer || 'Utente',
                sender: 'Scansione Esterna'
            };
            processIncomingPayment(data);

            // CRITICAL FIX: instead of replaceState, explicitly clear the hash. 
            // This ensures that if the user scans the same QR code again later (from external app), 
            // the 'hashchange' event triggers correctly.
            window.location.hash = '';
        }
    };

    // Run immediately on load
    checkUrlParams();
    // Also listen for hash changes (in case redirect adds hash after load or external app scans while open)
    window.addEventListener('hashchange', checkUrlParams);

    // --- QR Scanner Logic ---
    const scannerOverlay = document.getElementById('scannerOverlay');
    const openScannerBtn = document.getElementById('openScannerBtn');
    const closeScannerBtn = document.getElementById('closeScannerBtn');
    let html5QrCode;

    const startScanner = async () => {
        scannerOverlay.style.display = 'flex';
        html5QrCode = new Html5Qrcode("reader");

        const config = {
            fps: 10,  // Lower fps for older devices
            qrbox: { width: 250, height: 250 },
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
        };

        const onScanSuccess = (decodedText) => {
            console.log("[Scanner] QR rilevato:", decodedText);

            // Simple param extractor (independent of full URL or relative)
            const getParam = (name) => {
                const regex = new RegExp(`[#?&]${name}=([^&]*)`);
                const match = decodedText.match(regex);
                return match ? decodeURIComponent(match[1]) : null;
            };

            const amount = getParam('amount');
            const customer = getParam('customer');
            const ts = getParam('ts');

            console.log("[Scanner] Dati estratti:", { amount, customer, ts });

            if (amount && ts) {
                const lastTs = localStorage.getItem('last_payment_ts');
                if (ts === lastTs) {
                    alert("Hai già ricevuto questo pagamento.");
                    stopScanner();
                    return;
                }

                localStorage.setItem('last_payment_ts', ts);
                stopScanner();

                processIncomingPayment({
                    type: 'PAYMENT',
                    amount: parseFloat(amount),
                    customer: customer || 'Utente',
                    sender: 'Scanner App'
                });
            } else if (decodedText.startsWith('mattia-')) {
                alert("Stai scansionando il Codice Cassa. Devi scansionare il QR mostrato sul Mac dopo aver cliccato 'Invia Resto'.");
            } else {
                alert("QR Code non riconosciuto dal sistema PaySim.");
            }
        };

        try {
            // Fix for iOS PWA camera: explicitly request back camera using deviceId if possible
            const devices = await Html5Qrcode.getCameras();
            if (devices && devices.length) {
                // Find back camera
                let backCamera = devices.find(device => device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('retro'));
                let cameraIdToUse = backCamera ? backCamera.id : devices[devices.length - 1].id;

                await html5QrCode.start(
                    cameraIdToUse,
                    config,
                    onScanSuccess
                );
            } else {
                // Fallback
                await html5QrCode.start(
                    { facingMode: "environment" },
                    config,
                    onScanSuccess
                );
            }
        } catch (err) {
            console.error("[Scanner] Errore avvio fotocamera:", err);

            // Detailed alert to help debug permissions on iOS
            let errorMsg = err.message || err.toString();
            if (errorMsg.includes("NotAllowedError") || errorMsg.includes("Permission denied")) {
                alert("⛔ Per usare lo scanner devi dare il permesso alla fotocamera nelle Impostazioni del telefono (Safari/Chrome).");
            } else if (errorMsg.includes("NotFoundError")) {
                alert("Nessuna fotocamera posteriore trovata.");
            } else {
                alert("Errore fotocamera: " + errorMsg + "\nIn iOS, chiudi l'app e aprila di nuovo.");
            }
            stopScanner();
        }
    };

    const stopScanner = async () => {
        if (html5QrCode && html5QrCode.isScanning) {
            try {
                await html5QrCode.stop();
            } catch (e) {
                console.log("[Scanner] Errore stop (già fermo?):", e);
            }
        }
        html5QrCode = null;
        scannerOverlay.style.display = 'none';
        document.getElementById('reader').innerHTML = '';
    };

    openScannerBtn.addEventListener('click', startScanner);
    closeScannerBtn.addEventListener('click', stopScanner);
});

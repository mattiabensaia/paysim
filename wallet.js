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

    const generateSignature = async (amount, ts) => {
        const secret = "PAYSIM_SECRET_2026";
        const message = `${amount}|${ts}|${secret}`;
        const encoder = new TextEncoder();
        const data = encoder.encode(message);

        // Use native Web Crypto API for lightweight SHA-256 hashing
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const checkUrlParams = async () => {
        const params = new URLSearchParams(window.location.search);

        const amount = params.get('amount');
        const customer = params.get('customer');
        const ts = params.get('ts');
        const sig = params.get('sig'); // The security signature

        if (amount && ts) {
            // First: Verify Signature
            if (!sig) {
                alert("⛔ SCANSIONE RESPINTA: Questo codice a barre non è firmato digitalmente e potrebbe essere fraudolento.");
                return;
            }

            const expectedSig = await generateSignature(amount, ts);
            if (sig !== expectedSig) {
                alert("⛔ FRODE RILEVATA: Questo codice a barre è stato contraffatto e alterato rispetto all'originale generato dalla Cassa.");
                return;
            }

            const lastTs = localStorage.getItem('last_payment_ts');
            if (ts !== lastTs) {
                localStorage.setItem('last_payment_ts', ts);
                const data = {
                    type: 'PAYMENT',
                    amount: parseFloat(amount),
                    customer: customer || 'Utente',
                    sender: 'Scansione Esterna'
                };
                processIncomingPayment(data);
            } else {
                alert("Questo pagamento esterno è già stato accreditato in precedenza.");
            }

            // Cleanup the URL so refreshing the page doesn't resubmit the payment
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    };

    // Run immediately on load
    checkUrlParams();

    // --- QR Scanner Logic (jsQR) ---
    const scannerOverlay = document.getElementById('scannerOverlay');
    const openScannerBtn = document.getElementById('openScannerBtn');
    const closeScannerBtn = document.getElementById('closeScannerBtn');
    const video = document.getElementById('qr-video');
    const canvasElement = document.getElementById('qr-canvas');
    const canvas = canvasElement.getContext('2d');
    let scanningStatus = false;
    let stream = null;

    const startScanner = async () => {
        scannerOverlay.style.display = 'flex';
        scanningStatus = true;

        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "environment",
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            video.srcObject = stream;
            // Required for iOS Safari to play the video inline
            video.setAttribute("playsinline", "true");
            video.setAttribute("autoplay", "true");
            video.setAttribute("muted", "true");
            video.play().catch(e => console.error(e));
            requestAnimationFrame(tick);
        } catch (err) {
            console.error("[Scanner] Errore fotocamera:", err);
            let errorMsg = err.message || err.toString();
            if (errorMsg.includes("NotAllowedError") || errorMsg.includes("Permission denied")) {
                alert("⛔ Permesso fotocamera negato. Vai nelle Impostazioni del telefono (Safari/Chrome) e consenti l'accesso.");
            } else {
                alert("Errore fotocamera: " + errorMsg + "\nRiprova o chiudi l'app.");
            }
            stopScanner();
        }
    };

    const tick = () => {
        if (!scanningStatus) return;

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            // Ensure exact integer mapping for jsQR data array
            canvasElement.height = Math.floor(video.videoHeight);
            canvasElement.width = Math.floor(video.videoWidth);

            if (canvasElement.width > 0 && canvasElement.height > 0) {
                canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
                var imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);

                try {
                    var code = jsQR(imageData.data, imageData.width, imageData.height, {
                        inversionAttempts: "attemptBoth",
                    });

                    if (code) {
                        onScanSuccess(code.data);
                        return; // Stop the loop on success
                    }
                } catch (e) {
                    console.error("[Scanner] jsQR processing error:", e);
                }
            }
            requestAnimationFrame(tick);
        } else {
            requestAnimationFrame(tick);
        }
    };

    const onScanSuccess = async (decodedText) => {
        console.log("[Scanner] QR rilevato:", decodedText);

        const getParam = (name) => {
            const regex = new RegExp(`[#?&]${name}=([^&]*)`);
            const match = decodedText.match(regex);
            return match ? decodeURIComponent(match[1]) : null;
        };

        const amount = getParam('amount');
        const customer = getParam('customer');
        const ts = getParam('ts');
        const sig = getParam('sig');

        if (amount && ts) {
            // Security verification step 1: require signature
            if (!sig) {
                alert("⛔ SCANSIONE RESPINTA: Questo codice QR non è firmato digitalmente e potrebbe essere fraudolento.");
                stopScanner();
                return;
            }

            // Security verification step 2: validate signature
            const expectedSig = await generateSignature(amount, ts);
            if (sig !== expectedSig) {
                alert("⛔ FRODE RILEVATA: Questo codice QR è stato alterato rispetto all'originale generato dalla Cassa.");
                stopScanner();
                return;
            }

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
                sender: 'Scanner App (Verificato)'
            });
        } else if (decodedText.startsWith('mattia-')) {
            alert("Stai scansionando il Codice Cassa. Devi scansionare il QR mostrato sul Mac dopo aver cliccato 'Invia Resto'.");
            requestAnimationFrame(tick); // resume scanning
        } else {
            alert(`QR INCOMPATIBILE\nTesto Rilevato:\n${decodedText.substring(0, 50)}...\n\nAssicurati di inquadrare il QR generato dalla Cassa Mac.`);
            requestAnimationFrame(tick); // resume scanning
        }
    };

    const stopScanner = () => {
        scanningStatus = false;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        scannerOverlay.style.display = 'none';
        // Clear canvas
        if (canvasElement.width > 0) {
            canvas.clearRect(0, 0, canvasElement.width, canvasElement.height);
        }
    };

    openScannerBtn.addEventListener('click', startScanner);
    closeScannerBtn.addEventListener('click', stopScanner);
});

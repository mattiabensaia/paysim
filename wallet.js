document.addEventListener('DOMContentLoaded', () => {
    // --- Sensory Engines ---
    const SoundEngine = {
        ctx: null,

        init: function () {
            if (!this.ctx) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
        },

        // Crisp ascending chord for success (Apple Pay style)
        playSuccess: function () {
            this.init();
            if (this.ctx.state === 'suspended') this.ctx.resume();

            const now = this.ctx.currentTime;
            this.playTone(440, now, 0.15);      // A4
            this.playTone(554.37, now + 0.1, 0.15);  // C#5
            this.playTone(659.25, now + 0.2, 0.3);   // E5
        },

        // Quick high-pitch pulse for scan confirmation
        playScan: function () {
            this.init();
            if (this.ctx.state === 'suspended') this.ctx.resume();
            this.playTone(880, this.ctx.currentTime, 0.05);
        },

        playTone: function (freq, start, duration) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);

            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.2, start + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.01, start + duration);

            osc.start(start);
            osc.stop(start + duration);
        }
    };

    // Auto-unlock Audio on first user interaction
    const unlockAudio = () => {
        SoundEngine.init();
        if (SoundEngine.ctx.state === 'suspended') {
            SoundEngine.ctx.resume();
        }
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
    };
    window.addEventListener('click', unlockAudio);
    window.addEventListener('touchstart', unlockAudio);

    // UI Elements
    const myPeerIdDisplay = document.getElementById('myPeerId');
    const walletBalance = document.getElementById('walletBalance');
    const transactionList = document.getElementById('transactionList');
    const notificationOverlay = document.getElementById('notificationOverlay');
    const notifAmount = document.getElementById('notifAmount');
    const notifSender = document.getElementById('notifSender');
    const connStatusIcon = document.getElementById('connStatus');
    const displayUserName = document.getElementById('displayUserName');

    // Virtual Card Elements
    const virtualCardBtn = document.getElementById('virtualCardBtn');
    const virtualCardOverlay = document.getElementById('virtualCardOverlay');
    const closeVirtualCardBtn = document.getElementById('closeVirtualCardBtn');
    const simulateNFCPayBtn = document.getElementById('simulateNFCPayBtn');
    const virtualCardBalance = document.getElementById('virtualCardBalance');
    const virtualCardName = document.getElementById('virtualCardName');

    // Onboarding Elements
    const onboardingOverlay = document.getElementById('onboardingOverlay');
    const onboardingName = document.getElementById('onboardingName');
    const onboardingSurname = document.getElementById('onboardingSurname');
    const startOnboardingBtn = document.getElementById('startOnboardingBtn');

    // State & Persistence
    let userFullName = localStorage.getItem('user_fullname') || '';
    let currentBalance = parseFloat(localStorage.getItem('user_balance')) || 12.50;
    let cardTheme = localStorage.getItem('virtual_card_theme') || 'theme-purple';

    // Personalization Function
    const updatePersonalization = () => {
        if (userFullName) {
            displayUserName.textContent = userFullName.split(' ')[0]; // Show only first name in header
            virtualCardName.textContent = userFullName.toUpperCase();
        }

        // Apply theme to the card element
        const cardElement = document.querySelector('.virtual-card');
        if (cardElement) {
            // Remove all existing theme classes first
            cardElement.classList.remove('theme-purple', 'theme-black', 'theme-gold', 'theme-lime');
            // Then add the current one
            cardElement.classList.add(cardTheme);
        }

        // Update dot states
        document.querySelectorAll('.theme-dot').forEach(dot => {
            dot.classList.toggle('active', dot.dataset.theme === cardTheme);
        });
    };

    // Initial Personalization
    updatePersonalization();
    walletBalance.textContent = currentBalance.toFixed(2);

    const saveBalance = (newBalance) => {
        currentBalance = newBalance;
        localStorage.setItem('user_balance', currentBalance.toFixed(2));
        walletBalance.textContent = currentBalance.toFixed(2);
        virtualCardBalance.textContent = currentBalance.toFixed(2);
    };

    const addTransaction = (amount, sender) => {
        let amt = parseFloat(amount);
        if (isNaN(amt)) return;

        const isExpense = amt < 0 || (sender && (sender.includes("Spesa") || sender.includes("Pagamento")));
        const now = new Date();
        const timeString = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

        const txDiv = document.createElement('div');
        txDiv.className = 'transaction-item';
        txDiv.innerHTML = `
            <div class="tx-icon ${isExpense ? 'out' : 'in'}"><i class="fas ${isExpense ? 'fa-shopping-bag' : 'fa-plus'}"></i></div>
            <div class="tx-details">
                <div class="tx-title">${isExpense ? sender : 'Resto da ' + (sender || 'Cassa')}</div>
                <div class="tx-time">Oggi, ${timeString}</div>
            </div>
            <div class="tx-amount ${isExpense ? 'negative' : 'positive'}">${isExpense ? '-' : '+'}${Math.abs(amt).toFixed(2)} €</div>
        `;
        transactionList.insertBefore(txDiv, transactionList.firstChild);

        // Persist transactions too
        const history = JSON.parse(localStorage.getItem('tx_history') || '[]');
        history.unshift({ amount: amt, sender: sender || 'Cassa', time: timeString });
        localStorage.setItem('tx_history', JSON.stringify(history.slice(0, 10)));
    };

    // Load History with Sanitization
    const loadHistory = () => {
        transactionList.innerHTML = '';
        let history = JSON.parse(localStorage.getItem('tx_history') || '[]');

        history.forEach(tx => {
            let amt = parseFloat(tx.amount);
            if (isNaN(amt)) return;

            // Robust check: negative number OR contains expense keywords
            const isExpense = amt < 0 || (tx.sender && (tx.sender.includes("Spesa") || tx.sender.includes("Pagamento")));

            const txDiv = document.createElement('div');
            txDiv.className = 'transaction-item';
            txDiv.innerHTML = `
                <div class="tx-icon ${isExpense ? 'out' : 'in'}"><i class="fas ${isExpense ? 'fa-shopping-bag' : 'fa-plus'}"></i></div>
                <div class="tx-details">
                    <div class="tx-title">${isExpense ? tx.sender : 'Resto da ' + (tx.sender || 'Cassa')}</div>
                    <div class="tx-time">Oggi, ${tx.time}</div>
                </div>
                <div class="tx-amount ${isExpense ? 'negative' : 'positive'}">${isExpense ? '-' : '+'}${Math.abs(amt).toFixed(2)} €</div>
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

        if (navigator.vibrate) navigator.vibrate([10, 30, 10, 30, 100]); // Premium triple-tap vibration
        SoundEngine.playSuccess();

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
        if (myPeerIdDisplay) myPeerIdDisplay.textContent = id;
        if (connStatusIcon) connStatusIcon.innerHTML = '<i class="fas fa-wifi" style="color: var(--success)"></i>';
    });

    peer.on('connection', (conn) => {
        if (connStatusIcon) connStatusIcon.innerHTML = '<i class="fas fa-link" style="color: var(--accent)"></i>';
        conn.on('data', (data) => {
            if (data.type === 'PAYMENT') processIncomingPayment(data);
        });
    });

    const checkUrlParams = () => {
        const params = new URLSearchParams(window.location.search);

        const amount = params.get('amount');
        const customer = params.get('customer');
        const ts = params.get('ts');

        if (amount && ts) {
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

    // --- Onboarding Logic ---
    const checkOnboarding = () => {
        if (!userFullName) {
            onboardingOverlay.style.display = 'flex';
        }
    };

    startOnboardingBtn.addEventListener('click', () => {
        const name = onboardingName.value.trim();
        const surname = onboardingSurname.value.trim();

        if (!name || !surname) {
            alert("Per favore, inserisci sia il nome che il cognome.");
            return;
        }

        userFullName = `${name} ${surname}`;
        localStorage.setItem('user_fullname', userFullName);

        updatePersonalization();
        onboardingOverlay.style.display = 'none';

        // Sensory feedback for success
        if (navigator.vibrate) navigator.vibrate(50);
        SoundEngine.playSuccess();
    });

    // Theme Selection Logic
    document.querySelectorAll('.theme-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            cardTheme = dot.dataset.theme;
            localStorage.setItem('virtual_card_theme', cardTheme);
            updatePersonalization();
            if (navigator.vibrate) navigator.vibrate(20);
        });
    });

    checkOnboarding();

    // --- Virtual Card Logic ---
    virtualCardBtn.addEventListener('click', () => {
        updatePersonalization();
        virtualCardBalance.textContent = currentBalance.toFixed(2);
        virtualCardOverlay.classList.add('active');
    });

    closeVirtualCardBtn.addEventListener('click', () => {
        virtualCardOverlay.classList.remove('active');
    });

    simulateNFCPayBtn.addEventListener('click', () => {
        if (currentBalance < 1) {
            alert("Saldo insufficiente sulla carta!");
            return;
        }

        simulateNFCPayBtn.classList.add('nfc-pay-success');
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);

        setTimeout(() => {
            // Deduct 1 EUR and add to history using centralized logic
            saveBalance(currentBalance - 1);
            addTransaction(-1, "Spesa Contactless");

            setTimeout(() => {
                simulateNFCPayBtn.classList.remove('nfc-pay-success');
                virtualCardOverlay.classList.remove('active');
            }, 600);
        }, 1200);
    });

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

    const onScanSuccess = (decodedText) => {
        console.log("[Scanner] QR rilevato:", decodedText);

        // Haptic + Audio Feedback
        if (navigator.vibrate) navigator.vibrate(30);
        SoundEngine.playScan();

        const getParam = (name) => {
            const regex = new RegExp(`[#?&]${name}=([^&]*)`);
            const match = decodedText.match(regex);
            return match ? decodeURIComponent(match[1]) : null;
        };

        const amount = getParam('amount');
        const customer = getParam('customer');
        const ts = getParam('ts');

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

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const targetPeerIdInput = document.getElementById('targetPeerId');
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const customerNameInput = document.getElementById('customerName');
    const totalCostInput = document.getElementById('totalCost');
    const cashGivenInput = document.getElementById('cashGiven');
    const changeAmountDisplay = document.getElementById('changeAmount');
    const sendActionBtn = document.getElementById('sendActionBtn');
    const statusMessage = document.getElementById('statusMessage');
    const qrOverlay = document.getElementById('qrOverlay');
    const qrcodeDiv = document.getElementById('qrcode');
    const closeQrBtn = document.getElementById('closeQrBtn');

    let peer = new Peer();
    let conn = null;
    let changeToGive = 1.10;
    let qrGenerator = null;

    peer.on('open', (id) => {
        statusMessage.textContent = 'Pronto. Inserisci il codice o usa il QR.';
    });

    peer.on('error', (err) => {
        console.error(err);
        statusMessage.textContent = 'Errore: ' + err.type;
    });

    // Handle Connection
    targetPeerIdInput.addEventListener('input', () => {
        const id = targetPeerIdInput.value.trim();
        if (id.length >= 4) {
            connectToWallet(id);
        }
    });

    const connectToWallet = (id) => {
        if (conn) conn.close();
        statusText.textContent = 'Connessione...';
        conn = peer.connect(id);

        conn.on('open', () => {
            statusDot.classList.add('online');
            statusText.textContent = 'Connesso al Telefono';
            updateCalculations();
        });

        conn.on('close', () => {
            statusDot.classList.remove('online');
            statusText.textContent = 'Disconnesso';
            sendActionBtn.disabled = true;
        });
    };

    const updateCalculations = () => {
        const cost = parseFloat(totalCostInput.value) || 0;
        const cash = parseFloat(cashGivenInput.value) || 0;

        changeToGive = cash > cost ? (cash - cost) : 0;
        changeAmountDisplay.textContent = changeToGive.toFixed(2) + ' €';

        // Enable button if there is a resto, regardless of P2P connection (for QR fallback)
        sendActionBtn.disabled = changeToGive <= 0;
    };

    sendActionBtn.addEventListener('click', () => {
        const amount = changeToGive;
        const customer = customerNameInput.value.trim();

        // 1. Try P2P if connected
        if (conn && conn.open) {
            const data = { type: 'PAYMENT', amount, customer, sender: 'Cassa Mac' };
            conn.send(data);
            statusMessage.textContent = 'Inviato via wireless!';
        }

        // 2. Always show QR as fallback/alternative
        showQrFallback(amount, customer);
    });

    const showQrFallback = (amount, customer) => {
        // Read public URL from the config field (critical: localhost won't work from phone!)
        const publicUrlInput = document.getElementById('publicUrl');
        let publicBase = publicUrlInput.value.trim();

        // Remove trailing slash if present
        if (publicBase.endsWith('/')) publicBase = publicBase.slice(0, -1);

        // Build wallet URL with hash fragment (survives Serveo redirect)
        const qrUrl = `${publicBase}/wallet.html#amount=${amount}&customer=${encodeURIComponent(customer)}&ts=${Date.now()}`;

        qrcodeDiv.innerHTML = '';
        qrGenerator = new QRCode(qrcodeDiv, {
            text: qrUrl,
            width: 200,
            height: 200,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });

        qrOverlay.style.display = 'flex';
        statusMessage.textContent = 'Mostrando QR Code sul terminale.';
    };

    closeQrBtn.addEventListener('click', () => {
        qrOverlay.style.display = 'none';
        updateCalculations();
    });

    totalCostInput.addEventListener('input', updateCalculations);
    cashGivenInput.addEventListener('input', updateCalculations);
    customerNameInput.addEventListener('input', updateCalculations);

    // Initial calc
    updateCalculations();
});

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements - Cashier
    const customerNameInput = document.getElementById('customerName');
    const totalCostInput = document.getElementById('totalCost');
    const cashGivenInput = document.getElementById('cashGiven');
    const changeAmountDisplay = document.getElementById('changeAmount');
    const errorMessage = document.getElementById('errorMessage');
    const sendActionBtn = document.getElementById('sendActionBtn');
    const statusMessage = document.getElementById('statusMessage');

    // DOM Elements - Phone
    const displayUserName = document.getElementById('displayUserName');
    const walletBalance = document.getElementById('walletBalance');
    const transactionList = document.getElementById('transactionList');
    const notificationOverlay = document.getElementById('notificationOverlay');
    const notifAmount = document.getElementById('notifAmount');

    // State
    let currentBalance = 12.50;
    let changeToGive = 1.10;

    // Functions
    const formatCurrency = (amount) => {
        return amount.toFixed(2) + ' €';
    };

    const updateCalculations = () => {
        const cost = parseFloat(totalCostInput.value) || 0;
        const cash = parseFloat(cashGivenInput.value) || 0;
        
        const customerName = customerNameInput.value.trim() || 'Utente';
        const firstName = customerName.split(' ')[0];
        displayUserName.textContent = firstName;

        if (cash < cost && cash > 0) {
            errorMessage.style.display = 'block';
            changeAmountDisplay.textContent = '0.00 €';
            changeAmountDisplay.style.color = 'var(--danger)';
            sendActionBtn.disabled = true;
            changeToGive = 0;
        } else {
            errorMessage.style.display = 'none';
            changeToGive = cash > 0 ? (cash - cost) : 0;
            changeAmountDisplay.textContent = formatCurrency(changeToGive);
            changeAmountDisplay.style.color = 'var(--success)';
            sendActionBtn.disabled = changeToGive <= 0;
        }
    };

    const addTransaction = (amount) => {
        const now = new Date();
        const timeString = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

        const txDiv = document.createElement('div');
        txDiv.className = 'transaction-item';
        txDiv.innerHTML = `
            <div class="tx-icon in"><i class="fas fa-arrow-down"></i></div>
            <div class="tx-details">
                <div class="tx-title">Resto Negozio (Cash)</div>
                <div class="tx-time">Oggi, ${timeString}</div>
            </div>
            <div class="tx-amount positive">+${formatCurrency(amount)}</div>
        `;

        // Prepend to list
        transactionList.insertBefore(txDiv, transactionList.firstChild);
    };

    const simulateTransfer = () => {
        if (changeToGive <= 0) return;

        // Visual feedback on cashier
        sendActionBtn.disabled = true;
        sendActionBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Elaborazione...';
        statusMessage.textContent = 'Connessione al telefono del cliente...';
        statusMessage.style.color = 'var(--accent)';

        // Simulate network delay
        setTimeout(() => {
            statusMessage.textContent = 'Resto digitale inviato con successo!';
            statusMessage.style.color = 'var(--success)';
            sendActionBtn.innerHTML = '<i class="fas fa-check"></i> Inviato';

            // Visual feedback on phone
            showPhoneNotification(changeToGive);

            // Reset Cashier after 3 seconds
            setTimeout(() => {
                sendActionBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Invia Resto Digitale';
                statusMessage.textContent = 'In attesa...';
                statusMessage.style.color = 'var(--text-muted)';
                updateCalculations();
            }, 3000);

        }, 1500);
    };

    const showPhoneNotification = (amount) => {
        // Trigger notification
        notifAmount.textContent = '+' + formatCurrency(amount);
        notificationOverlay.classList.add('active');

        // Vibrate if supported
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }

        // Hide notification after 2.5s and update balance
        setTimeout(() => {
            notificationOverlay.classList.remove('active');
            
            // Update balance with animation
            currentBalance += amount;
            walletBalance.textContent = currentBalance.toFixed(2);
            walletBalance.parentElement.classList.add('pop');
            
            // Remove pop class after anim finishes
            setTimeout(() => {
                walletBalance.parentElement.classList.remove('pop');
            }, 500);

            // Add transaction to list
            addTransaction(amount);

        }, 2500);
    };

    // Event Listeners
    totalCostInput.addEventListener('input', updateCalculations);
    cashGivenInput.addEventListener('input', updateCalculations);
    customerNameInput.addEventListener('input', updateCalculations);
    sendActionBtn.addEventListener('click', simulateTransfer);

    // Initial calculations
    updateCalculations();
});

// Banking Application JavaScript
// Main application logic for SecureBank

class BankingApp {
    constructor() {
        this.initializeApp();
        this.setupEventListeners();
        this.loadAccountData();
    }

    initializeApp() {
        console.log('SecureBank application initialized');
        this.showWelcomeMessage();
    }

    setupEventListeners() {
        // Quick action buttons
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const action = btn.querySelector('strong').textContent;
                this.handleQuickAction(action);
            });
        });

        // Account cards hover effects
        document.querySelectorAll('.account-card').forEach(card => {
            card.addEventListener('mouseenter', () => {
                this.showAccountDetails(card);
            });
        });

        // Navigation tracking
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                this.trackNavigation(link.href);
            });
        });
    }

    showWelcomeMessage() {
        const currentHour = new Date().getHours();
        let greeting;
        
        if (currentHour < 12) {
            greeting = 'Good morning';
        } else if (currentHour < 18) {
            greeting = 'Good afternoon';
        } else {
            greeting = 'Good evening';
        }

        console.log(`${greeting}! Welcome to SecureBank.`);
    }

    handleQuickAction(action) {
        console.log(`Quick action selected: ${action}`);
        
        // Show loading state
        this.showNotification(`Processing ${action}...`, 'info');
        
        // Simulate API call
        setTimeout(() => {
            this.showNotification(`${action} completed successfully!`, 'success');
        }, 1500);
    }

    showAccountDetails(card) {
        const accountType = card.querySelector('.card-subtitle').textContent;
        const balance = card.querySelector('.balance-amount').textContent;
        
        console.log(`Account Details - ${accountType}: ${balance}`);
    }

    trackNavigation(url) {
        console.log(`Navigation tracked: ${url}`);
        // Here you could send analytics data to your backend
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `alert alert-${type} alert-dismissible fade show`;
        notification.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;

        // Add to flash messages container
        const flashContainer = document.getElementById('flash-messages');
        if (flashContainer) {
            flashContainer.appendChild(notification);
            
            // Auto-hide after 3 seconds
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 3000);
        }
    }

    loadAccountData() {
        // Simulate loading real-time account data
        console.log('Loading account data...');
        
        // This would typically make an API call to get real account information
        fetch('/api/accounts')
            .then(response => {
                if (!response.ok) {
                    console.log('Using demo data - API not available');
                    return null;
                }
                return response.json();
            })
            .then(data => {
                if (data) {
                    this.updateAccountDisplay(data);
                } else {
                    console.log('Using static demo data');
                }
            })
            .catch(error => {
                console.log('Using demo data due to error:', error.message);
            });
    }

    updateAccountDisplay(accountData) {
        // Update account balances with real data
        accountData.forEach(account => {
            const card = document.querySelector(`[data-account="${account.id}"]`);
            if (card) {
                const balanceElement = card.querySelector('.balance-amount');
                if (balanceElement) {
                    balanceElement.textContent = this.formatCurrency(account.balance);
                }
            }
        });
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }

    // Security features
    initializeSecurity() {
        // Session timeout warning
        let sessionTimeout = 30 * 60 * 1000; // 30 minutes
        let warningTimeout = sessionTimeout - 5 * 60 * 1000; // 25 minutes

        setTimeout(() => {
            this.showSessionWarning();
        }, warningTimeout);
    }

    showSessionWarning() {
        const result = confirm('Your session will expire in 5 minutes. Would you like to extend it?');
        if (result) {
            this.extendSession();
        } else {
            console.log('User chose not to extend session');
        }
    }

    extendSession() {
        console.log('Session extended');
        this.showNotification('Session extended successfully', 'success');
        // Restart the security timer
        this.initializeSecurity();
    }
}

// Real-time features
class RealTimeUpdates {
    constructor(bankingApp) {
        this.app = bankingApp;
        this.setupWebSocket();
        this.startPeriodicUpdates();
    }

    setupWebSocket() {
        // This would connect to a WebSocket for real-time updates
        console.log('WebSocket connection would be established here');
    }

    startPeriodicUpdates() {
        // Check for updates every 30 seconds
        setInterval(() => {
            this.checkForUpdates();
        }, 30000);
    }

    checkForUpdates() {
        // Simulate checking for new transactions
        console.log('Checking for account updates...');
        
        // Random chance of new transaction (for demo)
        if (Math.random() < 0.1) { // 10% chance
            this.simulateNewTransaction();
        }
    }

    simulateNewTransaction() {
        const transactions = [
            { type: 'deposit', amount: 150.00, description: 'ATM Deposit' },
            { type: 'withdrawal', amount: 25.00, description: 'Coffee Shop' },
            { type: 'transfer', amount: 500.00, description: 'Savings Transfer' }
        ];

        const randomTransaction = transactions[Math.floor(Math.random() * transactions.length)];
        this.app.showNotification(
            `New transaction: ${randomTransaction.description} - $${randomTransaction.amount}`,
            'info'
        );
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const app = new BankingApp();
    const realTimeUpdates = new RealTimeUpdates(app);
    
    // Initialize security features
    app.initializeSecurity();
    
    console.log('Banking application fully loaded and ready!');
});

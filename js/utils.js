// Utility functions for the banking application

// Currency formatting utilities
const CurrencyUtils = {
    format(amount, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(amount);
    },

    parse(currencyString) {
        return parseFloat(currencyString.replace(/[$,]/g, ''));
    },

    add(amount1, amount2) {
        return Math.round((amount1 + amount2) * 100) / 100;
    },

    subtract(amount1, amount2) {
        return Math.round((amount1 - amount2) * 100) / 100;
    }
};

// Date formatting utilities
const DateUtils = {
    formatDate(date, options = {}) {
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        };
        return new Date(date).toLocaleDateString('en-US', { ...defaultOptions, ...options });
    },

    formatDateTime(date) {
        return new Date(date).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    timeAgo(date) {
        const now = new Date();
        const diffInSeconds = Math.floor((now - new Date(date)) / 1000);
        
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
        if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
        
        return this.formatDate(date);
    }
};

// Validation utilities
const ValidationUtils = {
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    isValidPhone(phone) {
        const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
        return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
    },

    isValidAmount(amount) {
        return !isNaN(amount) && amount > 0 && Number(amount) === Number(amount.toFixed(2));
    },

    isValidAccountNumber(accountNumber) {
        return /^\d{8,12}$/.test(accountNumber.replace(/\s/g, ''));
    },

    isValidRoutingNumber(routingNumber) {
        return /^\d{9}$/.test(routingNumber.replace(/\s/g, ''));
    }
};

// Security utilities
const SecurityUtils = {
    maskAccountNumber(accountNumber) {
        if (!accountNumber) return '';
        const str = accountNumber.toString();
        return '****' + str.slice(-4);
    },

    maskCardNumber(cardNumber) {
        if (!cardNumber) return '';
        const str = cardNumber.toString().replace(/\s/g, '');
        return str.slice(0, 4) + ' **** **** ' + str.slice(-4);
    },

    generateSessionId() {
        return 'sess_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    },

    isSecureConnection() {
        return window.location.protocol === 'https:';
    },

    showSecurityAlert(message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-warning alert-dismissible fade show';
        alertDiv.innerHTML = `
            <i class="bi bi-shield-exclamation me-2"></i>
            <strong>Security Notice:</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        const container = document.getElementById('flash-messages') || document.body;
        container.insertBefore(alertDiv, container.firstChild);
    }
};

// API utilities
const ApiUtils = {
    async makeRequest(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'XMLHttpRequest'
            }
        };

        try {
            const response = await fetch(url, { ...defaultOptions, ...options });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    },

    async get(url) {
        return this.makeRequest(url, { method: 'GET' });
    },

    async post(url, data) {
        return this.makeRequest(url, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async put(url, data) {
        return this.makeRequest(url, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },

    async delete(url) {
        return this.makeRequest(url, { method: 'DELETE' });
    }
};

// Local storage utilities
const StorageUtils = {
    set(key, value, expiry = null) {
        const item = {
            value: value,
            expiry: expiry ? Date.now() + expiry : null
        };
        localStorage.setItem(`securebank_${key}`, JSON.stringify(item));
    },

    get(key) {
        const itemStr = localStorage.getItem(`securebank_${key}`);
        if (!itemStr) return null;

        const item = JSON.parse(itemStr);
        
        if (item.expiry && Date.now() > item.expiry) {
            localStorage.removeItem(`securebank_${key}`);
            return null;
        }
        
        return item.value;
    },

    remove(key) {
        localStorage.removeItem(`securebank_${key}`);
    },

    clear() {
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('securebank_')) {
                localStorage.removeItem(key);
            }
        });
    }
};

// Animation utilities
const AnimationUtils = {
    fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.display = 'block';
        
        let start = null;
        function animate(timestamp) {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            
            element.style.opacity = Math.min(progress / duration, 1);
            
            if (progress < duration) {
                requestAnimationFrame(animate);
            }
        }
        
        requestAnimationFrame(animate);
    },

    slideDown(element, duration = 300) {
        element.style.height = '0px';
        element.style.overflow = 'hidden';
        element.style.display = 'block';
        
        const targetHeight = element.scrollHeight;
        let start = null;
        
        function animate(timestamp) {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            
            element.style.height = Math.min((progress / duration) * targetHeight, targetHeight) + 'px';
            
            if (progress < duration) {
                requestAnimationFrame(animate);
            } else {
                element.style.height = 'auto';
                element.style.overflow = 'visible';
            }
        }
        
        requestAnimationFrame(animate);
    },

    pulse(element, duration = 1000) {
        element.style.animation = `pulse ${duration}ms ease-in-out`;
        setTimeout(() => {
            element.style.animation = '';
        }, duration);
    }
};

// Export utilities for use in other scripts
window.BankingUtils = {
    Currency: CurrencyUtils,
    Date: DateUtils,
    Validation: ValidationUtils,
    Security: SecurityUtils,
    Api: ApiUtils,
    Storage: StorageUtils,
    Animation: AnimationUtils
};

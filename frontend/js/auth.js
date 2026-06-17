// Auth utilities for PadPick

const API_BASE = (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost") && window.location.port !== "8000" && window.location.port !== ""
    ? "http://127.0.0.1:8000" 
    : "";

// Show beautiful Toast Notification
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Icon selection
    let icon = "";
    if (type === 'success') {
        icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #10b981;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    } else if (type === 'info') {
        icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #3b82f6;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    } else {
        icon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #ef4444;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    }

    toast.innerHTML = `
        ${icon}
        <div>${message}</div>
    `;

    container.appendChild(toast);
    
    // Force a reflow to trigger CSS transition
    toast.offsetHeight;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3500);
}

// Get access token
function getToken() {
    return localStorage.getItem('token');
}

// Set auth headers
function getAuthHeaders() {
    const token = getToken();
    return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

// Register User
async function registerUser(email, fullName, password, mobileNumber) {
    try {
        const response = await fetch(`${API_BASE}/api/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, full_name: fullName, password, mobile_number: mobileNumber })
        });
        
        const text = await response.text();
        let data = {};
        if (text) {
            try {
                data = JSON.parse(text);
            } catch (e) {
                throw new Error("Server returned an invalid response format");
            }
        } else if (!response.ok) {
            throw new Error(`Server returned status code ${response.status}`);
        }
        
        if (!response.ok) {
            // Handle Pydantic field validation errors beautifully if returned in detail array
            let errorMsg = 'Registration failed';
            if (data.detail) {
                if (Array.isArray(data.detail)) {
                    errorMsg = data.detail.map(err => err.msg).join(', ');
                } else {
                    errorMsg = data.detail;
                }
            }
            throw new Error(errorMsg);
        }
        return { success: true };
    } catch (error) {
        showToast(error.message, 'error');
        return { success: false, error: error.message };
    }
}

// Login User
async function loginUser(email, password) {
    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const text = await response.text();
        let data = {};
        if (text) {
            try {
                data = JSON.parse(text);
            } catch (e) {
                throw new Error("Server returned an invalid response format");
            }
        } else if (!response.ok) {
            throw new Error(`Server returned status code ${response.status}`);
        }
        
        if (!response.ok) {
            throw new Error(data.detail || 'Login failed');
        }
        
        localStorage.setItem('token', data.access_token);
        return true;
    } catch (error) {
        showToast(error.message, 'error');
        return false;
    }
}

// Fetch Profile
async function getProfile() {
    const token = getToken();
    if (!token) return null;
    
    try {
        const response = await fetch(`${API_BASE}/api/auth/me`, {
            headers: getAuthHeaders()
        });
        if (response.ok) {
            const text = await response.text();
            if (text) {
                try {
                    return JSON.parse(text);
                } catch (e) {
                    console.error("Failed to parse profile JSON", e);
                }
            }
        }
        // Token might be expired or invalid
        localStorage.removeItem('token');
        return null;
    } catch (e) {
        console.error("Failed to load profile", e);
        return null;
    }
}

// Logout
function logoutUser() {
    localStorage.removeItem('token');
    window.location.reload();
}

const api = {
    baseUrl: '/api',

    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        const token = localStorage.getItem('token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    },

    async request(path, options = {}) {
        const url = `${this.baseUrl}${path}`;
        const defaultOptions = {
            headers: this.getHeaders()
        };
        const mergedOptions = { ...defaultOptions, ...options };
        
        try {
            const response = await fetch(url, mergedOptions);
            const data = await response.json();
            
            if (response.status === 401 && !url.includes('/auth/login')) {
                localStorage.removeItem('token');
                window.location.href = 'index.html';
                return { success: false, error: 'Unauthorized' };
            }
            
            return data || { success: false, error: 'Empty response' };
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    },

    async get(path) {
        return this.request(path, { method: 'GET' });
    },

    async post(path, body) {
        return this.request(path, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    },

    async delete(path) {
        return this.request(path, { method: 'DELETE' });
    }
};

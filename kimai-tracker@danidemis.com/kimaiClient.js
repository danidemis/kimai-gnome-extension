import Soup from 'gi://Soup';
import GLib from 'gi://GLib';

export class KimaiClient {
    // Solo due parametri: URL e Token (Password API)
    constructor(baseUrl, apiToken) {
        this.baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
        this.apiToken = apiToken;
        this.session = new Soup.Session();
    }

    async _apiCall(method, endpoint, body = null) {
        const url = `${this.baseUrl}api/${endpoint}`;
        
        // In Soup 3, creiamo il messaggio con method e GUri
        const message = Soup.Message.new(method, url);
        
        // Header Bearer (fondamentale per Nginx)
        message.request_headers.append('Authorization', `Bearer ${this.apiToken}`);
        message.request_headers.append('Accept', 'application/json');

        // Aggiungiamo il body solo per POST/PATCH e se non è nullo
        if (body && (method === 'POST' || method === 'PATCH')) {
            const bytes = GLib.Bytes.new(JSON.stringify(body));
            message.set_request_body_from_bytes('application/json', bytes);
        }

        try {
            const bytes = await this.session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);
            const status = message.get_status();
            
            if (status < 200 || status >= 300) {
                log(`KIMAI_API_ERROR: Status ${status} su ${endpoint}`);
                return null;
            }

            return JSON.parse(new TextDecoder().decode(bytes.toArray()));
        } catch (e) {
            log(`KIMAI_API_ERROR: Eccezione su ${endpoint}: ${e}`);
            return null;
        }
    }

    async getCustomers() { return await this._apiCall('GET', 'customers') || []; }
    async getProjects(id) { return await this._apiCall('GET', `projects?customer=${id}`) || []; }
    async getActivities(id) { return await this._apiCall('GET', `activities?project=${id}`) || []; }
    
    async startTimer(projectId, activityId) {
        return await this._apiCall('POST', 'timesheets', {
            project: parseInt(projectId),
            activity: parseInt(activityId),
            begin: new Date().toISOString()
        });
    }

    async stopTimer(id) {
        return await this._apiCall('PATCH', `timesheets/${id}/stop`);
    }

    async testConnection() {
        const result = await this._apiCall('GET', 'users/me');
        return (result && result.username) ? true : false;
    }
}
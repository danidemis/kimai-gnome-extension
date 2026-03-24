import Soup from 'gi://Soup';
import GLib from 'gi://GLib';

export class KimaiClient {
    constructor(baseUrl, username, apiToken) {
        this.baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
        this.username = username;
        this.apiToken = apiToken;
        this.session = new Soup.Session();
    }

    async _apiCall(method, endpoint, body = null) {
        const url = `${this.baseUrl}api/${endpoint}`;
        const message = Soup.Message.new(method, url);
        
        message.request_headers.append('X-Auth-User', this.username);
        message.request_headers.append('X-Auth-Token', this.apiToken);
        
        if (body) {
            const bytes = GLib.Bytes.new(JSON.stringify(body));
            message.set_request_body_from_bytes('application/json', bytes);
        }

        try {
            const bytes = await this.session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);
            const decoder = new TextDecoder('utf-8');
            const response = decoder.decode(bytes.toArray());
            return JSON.parse(response);
        } catch (e) {
            log(`Errore Kimai API (${endpoint}): ${e}`);
            return null;
        }
    }

    // Carica tutti i clienti
    async getCustomers() {
        return await this._apiCall('GET', 'customers');
    }

    // Carica i progetti filtrati per cliente
    async getProjects(customerId) {
        return await this._apiCall('GET', `projects?customer=${customerId}`);
    }

    // Carica le attività filtrate per progetto
    async getActivities(projectId) {
        return await this._apiCall('GET', `activities?project=${projectId}`);
    }

    // Avvia un timer
    async startTimer(projectId, activityId) {
        return await this._apiCall('POST', 'timesheets', {
            project: projectId,
            activity: activityId,
            begin: new Date().toISOString()
        });
    }

    async testConnection() {
    try {
        const result = await this._apiCall('GET', 'users/me');
        // Se l'API restituisce l'oggetto utente (ha un campo 'username'), la connessione è OK
        return result && result.username ? true : false;
    } catch (e) {
        return false;
    }
}
}
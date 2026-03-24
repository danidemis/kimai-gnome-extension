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
            return JSON.parse(new TextDecoder().decode(bytes.toArray()));
        } catch (e) {
            console.error(`Kimai Error (${endpoint}): ${e}`);
            return null;
        }
    }

    async getCustomers() { return await this._apiCall('GET', 'customers'); }
    async getProjects(id) { return await this._apiCall('GET', `projects?customer=${id}`); }
    async getActivities(id) { return await this._apiCall('GET', `activities?project=${id}`); }
    
    async startTimer(projectId, activityId) {
        return await this._apiCall('POST', 'timesheets', {
            project: projectId,
            activity: activityId,
            begin: new Date().toISOString()
        });
    }

    async stopTimer(id) {
        return await this._apiCall('PATCH', `timesheets/${id}/stop`);
    }

    async testConnection() {
        const result = await this._apiCall('GET', 'users/me');
        return result && result.username;
    }
}
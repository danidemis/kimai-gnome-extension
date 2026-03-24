import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { KimaiIndicator } from './indicator.js';
import { KimaiClient } from './kimaiClient.js';

export default class KimaiTrackerExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._reloadApi(); // Inizializza l'API all'avvio
        
        this._indicator = new KimaiIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this._settings.connect('changed::servers-json', () => {
            this._reloadApi();
        });
    }

    _reloadApi() {
        try {
            const serversJson = this._settings.get_string('servers-json');
            const servers = JSON.parse(serversJson || '[]');
            
            // Trova il server predefinito o prendi il primo
            const defaultServer = servers.find(s => s.isDefault) || servers[0];

            if (defaultServer && defaultServer.url && defaultServer.token) {
                this.api = new KimaiClient(
                    defaultServer.url, 
                    defaultServer.user, 
                    defaultServer.token
                );
                console.log("Kimai: API inizializzata correttamente");
            } else {
                this.api = null;
                console.log("Kimai: Nessun server valido configurato");
            }
        } catch (e) {
            this.api = null;
            console.error(`Kimai: Errore nel caricamento dei server: ${e}`);
        }
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
        this.api = null;
        this._settings = null;
    }
}
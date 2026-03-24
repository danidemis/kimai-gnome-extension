import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { KimaiIndicator } from './indicator.js';
import { KimaiClient } from './kimaiClient.js';

export default class KimaiTrackerExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        
        // Carica i server dal JSON salvato
        const servers = JSON.parse(this._settings.get_string('servers-json'));
        
        // Trova il server predefinito o prendi il primo della lista
        const defaultServer = servers.find(s => s.isDefault) || servers[0];

        if (defaultServer) {
            this.api = new KimaiClient(
                defaultServer.url, 
                defaultServer.user, 
                defaultServer.token
            );
        }

        this._indicator = new KimaiIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        // Ascolta i cambiamenti nelle impostazioni
        this._settings.connect('changed::servers-json', () => {
            this._reloadApi();
        });
    }

    _reloadApi() {
        // Logica per ricaricare l'API quando l'utente cambia server nelle prefs
        log("Server Kimai aggiornati, ricarico...");
    }

    disable() {
        this._indicator?.destroy();
        this._settings = null;
    }
}
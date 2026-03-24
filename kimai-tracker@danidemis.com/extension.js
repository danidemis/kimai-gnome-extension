import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { KimaiIndicator } from './indicator.js';
import { KimaiClient } from './kimaiClient.js';

export default class KimaiTrackerExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._reloadApi();
        
        this._indicator = new KimaiIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this._settings.connect('changed::servers-json', () => this._reloadApi());
    }

    _reloadApi() {
        try {
            const servers = JSON.parse(this._settings.get_string('servers-json') || '[]');
            const def = servers[0]; 
            if (def && def.url && def.token) {
                // Sincronizzato con il nuovo costruttore (solo 2 parametri)
                this.api = new KimaiClient(def.url, def.token);
                log("KIMAI: API ricaricata con successo");
            } else {
                this.api = null;
            }
        } catch (e) {
            this.api = null;
        }
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
        this.api = null;
        this._settings = null;
    }
}
import Gio from 'gi://Gio';
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { KimaiClient } from './kimaiClient.js'

export default class KimaiPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this._settings = this.getSettings();
        
        const page = new Adw.PreferencesPage();
        window.add(page);

        // --- GRUPPO 1: AGGIUNGI NUOVO SERVER ---
        const addGroup = new Adw.PreferencesGroup({ title: 'Aggiungi Nuovo Server' });
        page.add(addGroup);

        const nameEntry = new Adw.EntryRow({ title: 'Nome Identificativo' });
        const urlEntry = new Adw.EntryRow({ title: 'URL Server (es. https://kimai.it)' });
        const userEntry = new Adw.EntryRow({ title: 'Username' });
        const tokenEntry = new Adw.PasswordEntryRow({ title: 'API Token' });
        
        const defaultCheck = new Adw.ActionRow({ title: 'Imposta come predefinito' });
        const defaultSwitch = new Gtk.Switch({ valign: Gtk.Align.CENTER });
        defaultCheck.add_suffix(defaultSwitch);

        const addButton = new Gtk.Button({
            label: 'Salva Server',
            margin_top: 12,
            css_classes: ['suggested-action']
        });

        addGroup.add(nameEntry);
        addGroup.add(urlEntry);
        addGroup.add(userEntry);
        addGroup.add(tokenEntry);
        addGroup.add(defaultCheck);
        addGroup.add(addButton);

        // --- GRUPPO 2: LISTA SERVER SALVATI ---
        const listGroup = new Adw.PreferencesGroup({ title: 'Server Configurati', margin_top: 20 });
        const listBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
            css_classes: ['boxed-list']
        });
        listGroup.add(listBox);
        page.add(listGroup);

        // Creiamo un ToastOverlay per mostrare i messaggi di feedback
        const toastOverlay = new Adw.ToastOverlay();
        window.set_content(toastOverlay);
        // Nota: se avevi già impostato il contenuto della finestra, 
        // devi mettere la tua "page" dentro il toastOverlay.

        const testButton = new Gtk.Button({
            label: 'Test Connessione',
            margin_top: 10,
            css_classes: ['outline'] // Stile meno marcato del tasto "Salva"
        });

        testButton.connect('clicked', async () => {
            testButton.sensitive = false; // Disabilita durante il test
            testButton.label = 'Verifica in corso...';

            const client = new KimaiClient(
                urlEntry.get_text(),
                userEntry.get_text(),
                tokenEntry.get_text()
            );

            const isOk = await client.testConnection();

            if (isOk) {
                toastOverlay.add_toast(new Adw.Toast({ title: "✅ Connessione riuscita!" }));
            } else {
                toastOverlay.add_toast(new Adw.Toast({ title: "❌ Errore: controlla URL o credenziali" }));
            }

            testButton.sensitive = true;
            testButton.label = 'Test Connessione';
        });
        
        // Aggiungi il pulsante al gruppo (prima di quello "Salva")
        addGroup.add(testButton);

        // Logica pulsante "Salva"
        addButton.connect('clicked', () => {
            let servers = this._getServers();
            const newServer = {
                id: Date.now(), // ID univoco per eliminazione facile
                name: nameEntry.get_text(),
                url: urlEntry.get_text(),
                user: userEntry.get_text(),
                token: tokenEntry.get_text(),
                isDefault: defaultSwitch.active
            };

            if (newServer.name && newServer.url) {
                if (newServer.isDefault) servers.forEach(s => s.isDefault = false);
                servers.push(newServer);
                this._saveServers(servers);
                this._refreshServerList(listBox, servers);
                
                // Reset campi
                [nameEntry, urlEntry, userEntry, tokenEntry].forEach(e => e.set_text(''));
                defaultSwitch.active = false;
            }
        });

        // Caricamento iniziale
        this._refreshServerList(listBox, this._getServers());
    }

    _getServers() {
        return JSON.parse(this._settings.get_string('servers-json') || '[]');
    }

    _saveServers(servers) {
        this._settings.set_string('servers-json', JSON.stringify(servers));
    }

    _refreshServerList(listBox, servers) {
        // Pulisce la lista esistente
        let child = listBox.get_first_child();
        while (child) {
            listBox.remove(child);
            child = listBox.get_first_child();
        }

        // Popola la lista
        servers.forEach(server => {
            const row = new Adw.ActionRow({ 
                title: server.name,
                subtitle: `${server.url} (${server.user})` 
            });

            if (server.isDefault) {
                const badge = new Gtk.Image({
                    icon_name: 'emblem-favorite-symbolic',
                    css_classes: ['success'],
                    margin_end: 10
                });
                row.add_prefix(badge);
            }

            // Pulsante Elimina
            const delBtn = new Gtk.Button({
                icon_name: 'user-trash-symbolic',
                valign: Gtk.Align.CENTER,
                css_classes: ['flat', 'destructive-action']
            });

            delBtn.connect('clicked', () => {
                const filtered = this._getServers().filter(s => s.id !== server.id);
                this._saveServers(filtered);
                this._refreshServerList(listBox, filtered);
            });

            row.add_suffix(delBtn);
            listBox.append(row);
        });
    }
}
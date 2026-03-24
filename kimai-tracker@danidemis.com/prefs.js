import Gio from 'gi://Gio';
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class KimaiPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this._settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        window.add(page);

        const group = new Adw.PreferencesGroup({ title: 'Configurazione Server Kimai' });
        page.add(group);

        const nameEntry = new Adw.EntryRow({ title: 'Nome Server (es. Lavoro)' });
        const urlEntry = new Adw.EntryRow({ title: 'URL (es. https://kimai.it)' });
        const tokenEntry = new Adw.PasswordEntryRow({ title: 'API Token (Password API)' });
        const saveBtn = new Gtk.Button({ 
            label: 'Salva Server', 
            margin_top: 12, 
            css_classes: ['suggested-action'] 
        });

        group.add(nameEntry); group.add(urlEntry); group.add(tokenEntry); group.add(saveBtn);

        const listGroup = new Adw.PreferencesGroup({ title: 'Server Salvati', margin_top: 20 });
        this._listBox = new Gtk.ListBox({ css_classes: ['boxed-list'] });
        listGroup.add(this._listBox);
        page.add(listGroup);

        saveBtn.connect('clicked', () => {
            let servers = this._getServers();
            if (urlEntry.get_text() && tokenEntry.get_text()) {
                servers.push({
                    id: Date.now(),
                    name: nameEntry.get_text() || 'Kimai',
                    url: urlEntry.get_text(),
                    token: tokenEntry.get_text()
                });
                this._settings.set_string('servers-json', JSON.stringify(servers));
                this._refreshList();
                [nameEntry, urlEntry, tokenEntry].forEach(e => e.set_text(''));
            }
        });
        this._refreshList();
    }

    _getServers() {
        const data = this._settings.get_string('servers-json');
        return data ? JSON.parse(data) : [];
    }

    _refreshList() {
        let child = this._listBox.get_first_child();
        while (child) { this._listBox.remove(child); child = this._listBox.get_first_child(); }
        this._getServers().forEach(s => {
            const row = new Adw.ActionRow({ title: s.name, subtitle: s.url });
            const del = new Gtk.Button({ icon_name: 'user-trash-symbolic', valign: Gtk.Align.CENTER, css_classes: ['flat'] });
            del.connect('clicked', () => {
                this._settings.set_string('servers-json', JSON.stringify(this._getServers().filter(srv => srv.id !== s.id)));
                this._refreshList();
            });
            row.add_suffix(del);
            this._listBox.append(row);
        });
    }
}
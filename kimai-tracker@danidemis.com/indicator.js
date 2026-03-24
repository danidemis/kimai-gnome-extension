import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export const KimaiIndicator = GObject.registerClass(
    { GTypeName: 'KimaiIndicator' },
    class KimaiIndicator extends PanelMenu.Button {
        _init(extension) {
            super._init(0.5, 'Kimai Tracker', false);
            this.extension = extension;
            this.activeTimesheet = null;

            this.icon = new St.Icon({
                gicon: new Gio.ThemedIcon({ name: 'media-playback-start-symbolic' }),
                style_class: 'system-status-icon'
            });
            this.add_child(this.icon);

            this.menu.connect('open-state-changed', (menu, open) => {
                if (open) this._refreshMenu();
            });
        }

        async _refreshMenu() {
            this.menu.removeAll();

            // Voce di TEST sempre presente
            let testItem = new PopupMenu.PopupMenuItem("🔄 Verifica Connessione...");
            testItem.connect('activate', () => this._testConnection());
            this.menu.addMenuItem(testItem);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            // 1. Controllo se l'API è configurata
            if (!this.extension.api) {
                this.menu.addMenuItem(new PopupMenu.PopupMenuItem("⚠️ Configura un server nelle impostazioni"));
                return;
            }

            // 2. Controllo se c'è un timer attivo
            if (this.activeTimesheet) {
                let stopItem = new PopupMenu.PopupMenuItem("🛑 Ferma Attività in corso");
                stopItem.connect('activate', () => this._stopCurrentTimer());
                this.menu.addMenuItem(stopItem);
                return;
            }

            // 3. Recupero Clienti
            const customers = await this.extension.api.getCustomers();
            if (!customers || customers.length === 0) {
                this.menu.addMenuItem(new PopupMenu.PopupMenuItem("Nessun cliente trovato o errore API"));
                return;
            }

            customers.forEach(customer => {
                let customerItem = new PopupMenu.PopupSubMenuMenuItem(customer.name);
                this.menu.addMenuItem(customerItem);

                customerItem.menu.connect('open-state-changed', async (cMenu, cOpen) => {
                    if (cOpen && cMenu.isEmpty()) {
                        const projects = await this.extension.api.getProjects(customer.id);
                        projects?.forEach(project => {
                            let projectItem = new PopupMenu.PopupSubMenuMenuItem(project.name);
                            cMenu.addMenuItem(projectItem);

                            projectItem.menu.connect('open-state-changed', async (pMenu, pOpen) => {
                                if (pOpen && pMenu.isEmpty()) {
                                    const activities = await this.extension.api.getActivities(project.id);
                                    activities?.forEach(activity => {
                                        let actItem = new PopupMenu.PopupMenuItem(`  ↳ ${activity.name}`);
                                        actItem.connect('activate', () => {
                                            this._startTimer(project.id, activity.id);
                                        });
                                        pMenu.addMenuItem(actItem);
                                    });
                                }
                            });
                        });
                    }
                });
            });
        }

        async _testConnection() {
            if (!this.extension.api) {
                Main.notify("Kimai: Nessun server configurato!");
                return;
            }
            const ok = await this.extension.api.testConnection();
            Main.notify(ok ? "Kimai: Connessione riuscita! ✅" : "Kimai: Errore di connessione! ❌");
        }

        async _startTimer(projectId, activityId) {
            const result = await this.extension.api.startTimer(projectId, activityId);
            if (result) {
                this.activeTimesheet = result;
                this.icon.gicon = new Gio.ThemedIcon({ name: 'media-playback-stop-symbolic' });
                Main.notify("Kimai: Attività avviata!");
            }
        }

        async _stopCurrentTimer() {
            if (this.activeTimesheet) {
                await this.extension.api.stopTimer(this.activeTimesheet.id);
                this.activeTimesheet = null;
                this.icon.gicon = new Gio.ThemedIcon({ name: 'media-playback-start-symbolic' });
                Main.notify("Kimai: Attività fermata!");
            }
        }
    }
);
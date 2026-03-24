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

            // Tasto Test Connessione sempre visibile in alto
            let testItem = new PopupMenu.PopupMenuItem("🔄 Verifica Connessione...");
            testItem.connect('activate', () => this._testConnection());
            this.menu.addMenuItem(testItem);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            if (this.activeTimesheet) {
                let stopItem = new PopupMenu.PopupMenuItem("🛑 Ferma Attività");
                stopItem.connect('activate', () => this._stopCurrentTimer());
                this.menu.addMenuItem(stopItem);
                return;
            }

            if (!this.extension.api) {
                this.menu.addMenuItem(new PopupMenu.PopupMenuItem("⚠️ Configura un server nelle impostazioni"));
                return;
            }

            const customers = await this.extension.api.getCustomers();
            if (!customers) return;

            customers.forEach(customer => {
                let customerItem = new PopupMenu.PopupSubMenuMenuItem(customer.name);
                this.menu.addMenuItem(customerItem);

                customerItem.menu.connect('open-state-changed', async (cMenu, cOpen) => {
                    if (cOpen && cMenu.isEmpty()) {
                        const projects = await this.extension.api.getProjects(customer.id);
                        projects?.forEach(project => {
                            let pItem = new PopupMenu.PopupSubMenuMenuItem(project.name);
                            cMenu.addMenuItem(pItem);

                            pItem.menu.connect('open-state-changed', async (aMenu, aOpen) => {
                                if (aOpen && aMenu.isEmpty()) {
                                    const activities = await this.extension.api.getActivities(project.id);
                                    activities?.forEach(act => {
                                        let actItem = new PopupMenu.PopupMenuItem(act.name);
                                        actItem.connect('activate', () => this._startTimer(project.id, act.id));
                                        aMenu.addMenuItem(actItem);
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

        async _startTimer(pId, aId) {
            const res = await this.extension.api.startTimer(pId, aId);
            if (res) {
                this.activeTimesheet = res;
                this.icon.gicon = new Gio.ThemedIcon({ name: 'media-playback-stop-symbolic' });
            }
        }

        async _stopCurrentTimer() {
            if (this.activeTimesheet) {
                await this.extension.api.stopTimer(this.activeTimesheet.id);
                this.activeTimesheet = null;
                this.icon.gicon = new Gio.ThemedIcon({ name: 'media-playback-start-symbolic' });
            }
        }
    }
);
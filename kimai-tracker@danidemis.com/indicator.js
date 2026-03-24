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

            this._setupInitialMenu();

            this.menu.connect('open-state-changed', (menu, open) => {
                if (open) {
                    this._refreshMenu().catch(err => log(`KIMAI_DEBUG: Errore menu: ${err}`));
                }
            });
        }

        _setupInitialMenu() {
            this.menu.removeAll();
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem("Inizializzazione..."));
        }

        async _refreshMenu() {
            this.menu.removeAll();

            let testItem = new PopupMenu.PopupMenuItem("🔄 Verifica Connessione...");
            testItem.connect('activate', () => this._testConnection());
            this.menu.addMenuItem(testItem);
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            if (!this.extension.api) {
                this.menu.addMenuItem(new PopupMenu.PopupMenuItem("⚠️ Configura server"));
                return;
            }

            if (this.activeTimesheet) {
                let stopItem = new PopupMenu.PopupMenuItem("🛑 Ferma Attività");
                stopItem.connect('activate', () => this._stopCurrentTimer());
                this.menu.addMenuItem(stopItem);
                return;
            }

            const customers = await this.extension.api.getCustomers();
            if (!Array.isArray(customers) || customers.length === 0) {
                this.menu.addMenuItem(new PopupMenu.PopupMenuItem("Nessun cliente trovato"));
                return;
            }

            customers.forEach(customer => {
                let customerItem = new PopupMenu.PopupSubMenuMenuItem(customer.name);
                this.menu.addMenuItem(customerItem);
                
                // Placeholder per forzare l'apertura del sottomenu
                customerItem.menu.addMenuItem(new PopupMenu.PopupMenuItem("Caricamento progetti..."));

                customerItem.menu.connect('open-state-changed', async (cMenu, cOpen) => {
                    if (cOpen) {
                        log(`KIMAI: Caricamento progetti per ${customer.name}`);
                        const projects = await this.extension.api.getProjects(customer.id);
                        cMenu.removeAll();
                        
                        if (Array.isArray(projects) && projects.length > 0) {
                            projects.forEach(project => {
                                let pItem = new PopupMenu.PopupSubMenuMenuItem(project.name);
                                cMenu.addMenuItem(pItem);
                                pItem.menu.addMenuItem(new PopupMenu.PopupMenuItem("Caricamento attività..."));

                                pItem.menu.connect('open-state-changed', async (aMenu, aOpen) => {
                                    if (aOpen) {
                                        const activities = await this.extension.api.getActivities(project.id);
                                        aMenu.removeAll();
                                        if (Array.isArray(activities)) {
                                            activities.forEach(act => {
                                                let actItem = new PopupMenu.PopupMenuItem(`→ ${act.name}`);
                                                actItem.connect('activate', () => this._startTimer(project.id, act.id));
                                                aMenu.addMenuItem(actItem);
                                            });
                                        }
                                    }
                                });
                            });
                        } else {
                            cMenu.addMenuItem(new PopupMenu.PopupMenuItem("Nessun progetto"));
                        }
                    }
                });
            });
        }

        async _testConnection() {
            if (!this.extension.api) return;
            const ok = await this.extension.api.testConnection();
            // Correzione: Main.notify richiede Titolo e Messaggio (due stringhe)
            Main.notify("Kimai Tracker", ok ? "Connessione riuscita! ✅" : "Errore credenziali! ❌");
        }

        async _startTimer(pId, aId) {
            const res = await this.extension.api.startTimer(pId, aId);
            if (res && res.id) {
                this.activeTimesheet = res;
                this.icon.gicon = new Gio.ThemedIcon({ name: 'media-playback-stop-symbolic' });
                Main.notify("Kimai Tracker", "Timer avviato con successo!");
            }
        }

        async _stopCurrentTimer() {
            if (this.activeTimesheet) {
                await this.extension.api.stopTimer(this.activeTimesheet.id);
                this.activeTimesheet = null;
                this.icon.gicon = new Gio.ThemedIcon({ name: 'media-playback-start-symbolic' });
                Main.notify("Kimai Tracker", "Timer fermato!");
            }
        }
    }
);
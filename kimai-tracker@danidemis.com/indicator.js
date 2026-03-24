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

            // Inizializziamo il menu con un elemento per renderlo cliccabile
            this._setupInitialMenu();

            this.menu.connect('open-state-changed', (menu, open) => {
                if (open) {
                    this._refreshMenu().catch(err => {
                        log("KIMAI_DEBUG_ERROR: Errore asincrono menu: " + err);
                    });
                }
            });
        }

        _setupInitialMenu() {
            this.menu.removeAll();
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem("Caricamento..."));
        }

        async _refreshMenu() {
            log("KIMAI_DEBUG: Esecuzione _refreshMenu...");
            this.menu.removeAll();

            let testItem = new PopupMenu.PopupMenuItem("🔄 Verifica Connessione...");
            testItem.connect('activate', () => {
                this._testConnection().catch(err => log("KIMAI_DEBUG: Errore test: " + err));
            });
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

            try {
                const customers = await this.extension.api.getCustomers();
                
                // CRUCIALE: Controlliamo se 'customers' è effettivamente un array
                if (!Array.isArray(customers)) {
                    log("KIMAI_DEBUG_ERROR: Risposta API non è un array: " + JSON.stringify(customers));
                    this.menu.addMenuItem(new PopupMenu.PopupMenuItem("❌ Errore: Risposta server non valida"));
                    return;
                }

                if (customers.length === 0) {
                    this.menu.addMenuItem(new PopupMenu.PopupMenuItem("Nessun cliente trovato"));
                    return;
                }

                customers.forEach(customer => {
                    let customerItem = new PopupMenu.PopupSubMenuMenuItem(customer.name);
                    this.menu.addMenuItem(customerItem);

                    customerItem.menu.connect('open-state-changed', async (cMenu, cOpen) => {
                        if (cOpen && cMenu.isEmpty()) {
                            const projects = await this.extension.api.getProjects(customer.id);
                            if (Array.isArray(projects)) {
                                projects.forEach(project => {
                                    let pItem = new PopupMenu.PopupSubMenuMenuItem(project.name);
                                    cMenu.addMenuItem(pItem);

                                    pItem.menu.connect('open-state-changed', async (aMenu, aOpen) => {
                                        if (aOpen && aMenu.isEmpty()) {
                                            const activities = await this.extension.api.getActivities(project.id);
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
                            }
                        }
                    });
                });
            } catch (e) {
                log("KIMAI_DEBUG_ERROR: Errore durante il caricamento: " + e);
                this.menu.addMenuItem(new PopupMenu.PopupMenuItem("❌ Errore di rete"));
            }
        }

        async _testConnection() {
            try {
                if (!this.extension.api) throw new Error("API non inizializzata");
                const ok = await this.extension.api.testConnection();
                Main.notify(ok ? "Kimai: Connessione OK ✅" : "Kimai: Errore credenziali ❌");
            } catch (e) {
                Main.notify("Kimai: Errore di connessione ❌");
                log("KIMAI_DEBUG_ERROR: Test fallito: " + e);
            }
        }

        async _startTimer(pId, aId) {
            try {
                const res = await this.extension.api.startTimer(pId, aId);
                if (res && res.id) {
                    this.activeTimesheet = res;
                    this.icon.gicon = new Gio.ThemedIcon({ name: 'media-playback-stop-symbolic' });
                    Main.notify("Kimai: Timer avviato!");
                } else {
                    throw new Error("Dati mancanti nella risposta");
                }
            } catch (e) {
                Main.notify("Kimai: Impossibile avviare il timer ❌");
            }
        }

        async _stopCurrentTimer() {
            try {
                if (this.activeTimesheet) {
                    await this.extension.api.stopTimer(this.activeTimesheet.id);
                    this.activeTimesheet = null;
                    this.icon.gicon = new Gio.ThemedIcon({ name: 'media-playback-start-symbolic' });
                    Main.notify("Kimai: Timer fermato!");
                }
            } catch (e) {
                Main.notify("Kimai: Impossibile fermare il timer ❌");
            }
        }
    }
);
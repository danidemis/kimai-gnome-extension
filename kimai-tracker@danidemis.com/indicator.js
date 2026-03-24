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
            this._mainMenuLoaded = false;
            this._isRefreshing = false;

            this.icon = new St.Icon({
                gicon: new Gio.ThemedIcon({ name: 'media-playback-start-symbolic' }),
                style_class: 'system-status-icon'
            });
            this.add_child(this.icon);

            // Placeholder iniziale per permettere l'apertura del menu
            this._setupPlaceholder();

            this.menu.connect('open-state-changed', (menu, open) => {
                if (open && !this._mainMenuLoaded && !this._isRefreshing) {
                    this._refreshMenu().catch(err => log(`KIMAI_ERROR: ${err}`));
                }
            });
        }

        _setupPlaceholder() {
            this.menu.removeAll();
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem("Inizializzazione..."));
            this._mainMenuLoaded = false;
        }

        async _refreshMenu() {
            this._isRefreshing = true;
            log("KIMAI_DEBUG: Ricostruzione menu principale...");
            
            this.menu.removeAll();
            this._mainMenuLoaded = true;

            // Voci di sistema
            let testItem = new PopupMenu.PopupMenuItem("🔄 Verifica Connessione...");
            testItem.connect('activate', () => this._testConnection());
            this.menu.addMenuItem(testItem);

            let resetItem = new PopupMenu.PopupMenuItem("🔄 Forza Ricaricamento");
            resetItem.connect('activate', () => this._setupPlaceholder());
            this.menu.addMenuItem(resetItem);

            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            if (!this.extension.api) {
                this.menu.addMenuItem(new PopupMenu.PopupMenuItem("⚠️ Configura server"));
                this._isRefreshing = false;
                return;
            }

            if (this.activeTimesheet) {
                let stopItem = new PopupMenu.PopupMenuItem(`🛑 Stop: ${this.activeTaskName}`);
                stopItem.connect('activate', () => this._stopCurrentTimer());
                this.menu.addMenuItem(stopItem);
                this._isRefreshing = false;
                return;
            }

            const customers = await this.extension.api.getCustomers();
            
            if (Array.isArray(customers)) {
                customers.forEach(customer => {
                    let customerItem = new PopupMenu.PopupSubMenuMenuItem(customer.name);
                    this.menu.addMenuItem(customerItem);
                    
                    let cPlaceholder = new PopupMenu.PopupMenuItem("Caricamento progetti...");
                    customerItem.menu.addMenuItem(cPlaceholder);
                    customerItem._loaded = false;

                    customerItem.menu.connect('open-state-changed', async (cMenu, cOpen) => {
                        if (cOpen && !customerItem._loaded) {
                            log(`KIMAI: Caricamento progetti per ${customer.name}`);
                            const projects = await this.extension.api.getProjects(customer.id);
                            
                            // Gestione sicura della rimozione placeholder
                            if (customerItem.menu && !customerItem._loaded) {
                                customerItem._loaded = true;
                                cPlaceholder.destroy(); // Distruggiamo solo il placeholder, non tutto il menu

                                if (Array.isArray(projects)) {
                                    projects.forEach(project => {
                                        let pItem = new PopupMenu.PopupSubMenuMenuItem(project.name);
                                        customerItem.menu.addMenuItem(pItem);
                                        
                                        let pPlaceholder = new PopupMenu.PopupMenuItem("Caricamento attività...");
                                        pItem.menu.addMenuItem(pPlaceholder);
                                        pItem._loaded = false;

                                        pItem.menu.connect('open-state-changed', async (pMenu, pOpen) => {
                                            if (pOpen && !pItem._loaded) {
                                                log(`KIMAI: Caricamento attività per ${project.name}`);
                                                const activities = await this.extension.api.getActivities(project.id);
                                                
                                                if (pItem.menu && !pItem._loaded) {
                                                    pItem._loaded = true;
                                                    pPlaceholder.destroy();

                                                    if (Array.isArray(activities) && activities.length > 0) {
                                                        activities.forEach(act => {
                                                            let actItem = new PopupMenu.PopupMenuItem(`→ ${act.name}`);
                                                            actItem.connect('activate', () => this._startTimer(project.id, act.id, act.name));
                                                            pItem.menu.addMenuItem(actItem);
                                                        });
                                                    } else {
                                                        pItem.menu.addMenuItem(new PopupMenu.PopupMenuItem("Nessuna attività"));
                                                    }
                                                }
                                            }
                                        });
                                    });
                                }
                            }
                        }
                    });
                });
            }
            this._isRefreshing = false;
        }

        async _testConnection() {
            if (!this.extension.api) return;
            const ok = await this.extension.api.testConnection();
            Main.notify("Kimai Tracker", ok ? "Connessione riuscita! ✅" : "Errore credenziali! ❌");
        }

        async _startTimer(pId, aId, name) {
            const res = await this.extension.api.startTimer(pId, aId);
            if (res && res.id) {
                this.activeTimesheet = res;
                this.activeTaskName = name;
                this.icon.gicon = new Gio.ThemedIcon({ name: 'media-playback-stop-symbolic' });
                Main.notify("Kimai Tracker", `Timer avviato: ${name}`);
            }
        }

        async _stopCurrentTimer() {
            if (this.activeTimesheet) {
                await this.extension.api.stopTimer(this.activeTimesheet.id);
                this.activeTimesheet = null;
                this.icon.gicon = new Gio.ThemedIcon({ name: 'media-playback-start-symbolic' });
                Main.notify("Kimai Tracker", "Attività terminata.");
            }
        }
    }
);
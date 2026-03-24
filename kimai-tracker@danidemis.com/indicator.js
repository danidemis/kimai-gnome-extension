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
            this.activeTaskName = null;

            this.icon = new St.Icon({
                gicon: new Gio.ThemedIcon({ name: 'media-playback-start-symbolic' }),
                style_class: 'system-status-icon'
            });
            this.add_child(this.icon);

            // Menu iniziale statico per permettere l'apertura
            this._setupInitialMenu();

            // Gestione apertura menu principale
            this.menu.connect('open-state-changed', (menu, open) => {
                if (open) {
                    this._refreshMenu().catch(err => log(`KIMAI_DEBUG: Errore menu principale: ${err}`));
                }
            });
        }

        _setupInitialMenu() {
            this.menu.removeAll();
            this.menu.addMenuItem(new PopupMenu.PopupMenuItem("Caricamento..."));
        }

        async _refreshMenu() {
            // Svuotiamo solo se necessario o per reset
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
                let stopItem = new PopupMenu.PopupMenuItem(`🛑 Stop: ${this.activeTaskName}`);
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
                
                // Placeholder per forzare GNOME a considerare il sottomenu cliccabile
                let placeholder = new PopupMenu.PopupMenuItem("Caricamento progetti...");
                customerItem.menu.addMenuItem(placeholder);

                // Flag per evitare ricaricamenti multipli e crash "disposed"
                customerItem._loaded = false;

                customerItem.menu.connect('open-state-changed', async (cMenu, cOpen) => {
                    if (cOpen && !customerItem._loaded) {
                        const projects = await this.extension.api.getProjects(customer.id);
                        
                        // Pulizia sicura: verifichiamo che il menu esista ancora
                        if (customerItem.menu) {
                            customerItem.menu.removeAll();
                            customerItem._loaded = true;

                            if (Array.isArray(projects) && projects.length > 0) {
                                projects.forEach(project => {
                                    let pItem = new PopupMenu.PopupSubMenuMenuItem(project.name);
                                    customerItem.menu.addMenuItem(pItem);
                                    
                                    pItem.menu.addMenuItem(new PopupMenu.PopupMenuItem("Caricamento attività..."));
                                    pItem._loaded = false;

                                    pItem.menu.connect('open-state-changed', async (aMenu, aOpen) => {
                                        if (aOpen && !pItem._loaded) {
                                            const activities = await this.extension.api.getActivities(project.id);
                                            
                                            if (pItem.menu) {
                                                pItem.menu.removeAll();
                                                pItem._loaded = true;

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
                            } else {
                                customerItem.menu.addMenuItem(new PopupMenu.PopupMenuItem("Nessun progetto"));
                            }
                        }
                    }
                });
            });
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
                this.activeTaskName = null;
                this.icon.gicon = new Gio.ThemedIcon({ name: 'media-playback-start-symbolic' });
                Main.notify("Kimai Tracker", "Attività fermata.");
            }
        }
    }
);
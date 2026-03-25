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
            
            // Stato della selezione
            this._selectedCustomer = null;
            this._selectedProject = null;
            this._selectedActivity = null;
            this.activeTimesheet = null;

            this.icon = new St.Icon({
                gicon: new Gio.ThemedIcon({ name: 'media-playback-start-symbolic' }),
                style_class: 'system-status-icon'
            });
            this.add_child(this.icon);

            // Costruiamo il menu la prima volta
            this._refreshMenu();
        }

        async _refreshMenu() {
            this.menu.removeAll();

            // 1. SEZIONE STATO / STOP
            if (this.activeTimesheet) {
                let stopItem = new PopupMenu.PopupMenuItem(`🛑 STOP: ${this._selectedActivity.name}`);
                stopItem.connect('activate', () => this._stopCurrentTimer());
                this.menu.addMenuItem(stopItem);
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            }

            // 2. SEZIONE SELEZIONE CLIENTE
            let customerLabel = this._selectedCustomer ? `👤 Cliente: ${this._selectedCustomer.name}` : "👤 Seleziona Cliente...";
            let customerMenu = new PopupMenu.PopupSubMenuMenuItem(customerLabel);
            this.menu.addMenuItem(customerMenu);

            const customers = await this.extension.api?.getCustomers() || [];
            if (Array.isArray(customers)) {
                customers.forEach(c => {
                    let item = new PopupMenu.PopupMenuItem(c.name);
                    item.connect('activate', () => {
                        this._selectedCustomer = c;
                        this._selectedProject = null; // Reset successivi
                        this._selectedActivity = null;
                        this._refreshMenu();
                    });
                    customerMenu.menu.addMenuItem(item);
                });
            }

            // 3. SEZIONE SELEZIONE PROGETTO (Attiva solo se cliente selezionato)
            if (this._selectedCustomer) {
                let projectLabel = this._selectedProject ? `📂 Progetto: ${this._selectedProject.name}` : "📂 Seleziona Progetto...";
                let projectMenu = new PopupMenu.PopupSubMenuMenuItem(projectLabel);
                this.menu.addMenuItem(projectMenu);

                const projects = await this.extension.api.getProjects(this._selectedCustomer.id);
                if (Array.isArray(projects)) {
                    projects.forEach(p => {
                        let item = new PopupMenu.PopupMenuItem(p.name);
                        item.connect('activate', () => {
                            this._selectedProject = p;
                            this._selectedActivity = null;
                            this._refreshMenu();
                        });
                        projectMenu.menu.addMenuItem(item);
                    });
                }
            }

            // 4. SEZIONE SELEZIONE ATTIVITÀ (Attiva solo se progetto selezionato)
            if (this._selectedProject) {
                let activityLabel = this._selectedActivity ? `📝 Attività: ${this._selectedActivity.name}` : "📝 Seleziona Attività...";
                let activityMenu = new PopupMenu.PopupSubMenuMenuItem(activityLabel);
                this.menu.addMenuItem(activityMenu);

                const activities = await this.extension.api.getActivities(this._selectedProject.id);
                if (Array.isArray(activities)) {
                    activities.forEach(a => {
                        let item = new PopupMenu.PopupMenuItem(a.name);
                        item.connect('activate', () => {
                            this._selectedActivity = a;
                            this._refreshMenu();
                        });
                        activityMenu.menu.addMenuItem(item);
                    });
                }
            }

            // 5. TASTO START
            if (this._selectedActivity && !this.activeTimesheet) {
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                let startBtn = new PopupMenu.PopupMenuItem("▶ AVVIA TIMER", { style_class: 'active-item' });
                startBtn.connect('activate', () => this._startTimer());
                this.menu.addMenuItem(startBtn);
            }

            // 6. UTILITY IN FONDO
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            let testItem = new PopupMenu.PopupMenuItem("🔄 Verifica Connessione");
            testItem.connect('activate', () => this._testConnection());
            this.menu.addMenuItem(testItem);
        }

        async _testConnection() {
            const ok = await this.extension.api?.testConnection();
            Main.notify("Kimai Tracker", ok ? "Connessione riuscita! ✅" : "Errore credenziali! ❌");
        }

        async _startTimer() {
            const res = await this.extension.api.startTimer(this._selectedProject.id, this._selectedActivity.id);
            if (res) {
                this.activeTimesheet = res;
                this.icon.gicon = new Gio.ThemedIcon({ name: 'media-playback-stop-symbolic' });
                Main.notify("Kimai Tracker", "Timer avviato!");
                this._refreshMenu();
            }
        }

        async _stopCurrentTimer() {
            if (this.activeTimesheet) {
                await this.extension.api.stopTimer(this.activeTimesheet.id);
                this.activeTimesheet = null;
                this.icon.gicon = new Gio.ThemedIcon({ name: 'media-playback-start-symbolic' });
                Main.notify("Kimai Tracker", "Timer fermato.");
                this._refreshMenu();
            }
        }
    }
);
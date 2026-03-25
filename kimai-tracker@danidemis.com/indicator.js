import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import Clutter from 'gi://Clutter';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export const KimaiIndicator = GObject.registerClass(
    { GTypeName: 'KimaiIndicator' },
    class KimaiIndicator extends PanelMenu.Button {
        _init(extension) {
            super._init(0.5, 'Kimai Tracker', false);
            this.extension = extension;
            
            this._selectedCustomer = null;
            this._selectedProject = null;
            this._selectedActivity = null;
            this.activeTimesheet = null;

            this.icon = new St.Icon({
                gicon: new Gio.ThemedIcon({ name: 'media-playback-start-symbolic' }),
                style_class: 'system-status-icon'
            });
            this.add_child(this.icon);

            // Carichiamo lo stato iniziale
            this._refreshMenu();
            
            // Ogni volta che apri il menu, controlliamo se ci sono modifiche
            this.menu.connect('open-state-changed', (menu, open) => {
                if (open) this._refreshMenu();
            });
        }

        async _refreshMenu() {
            // Pulizia atomica: svuotiamo solo alla fine del caricamento dati
            // per evitare l'effetto "menu vuoto"
            const customers = await this.extension.api?.getCustomers() || [];
            let projects = [];
            let activities = [];

            if (this._selectedCustomer) {
                projects = await this.extension.api.getProjects(this._selectedCustomer.id) || [];
            }
            if (this._selectedProject) {
                activities = await this.extension.api.getActivities(this._selectedProject.id) || [];
            }

            this.menu.removeAll();

            // 1. STATO ATTIVO
            if (this.activeTimesheet) {
                let stopItem = new PopupMenu.PopupMenuItem(`🛑 STOP: ${this._selectedActivity?.name || 'Attività'}`);
                stopItem.connect('activate', () => this._stopCurrentTimer());
                this.menu.addMenuItem(stopItem);
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            }

            // 2. SELEZIONE CLIENTE
            let customerLabel = this._selectedCustomer ? `👤 ${this._selectedCustomer.name}` : "👤 Seleziona Cliente...";
            let customerMenu = new PopupMenu.PopupSubMenuMenuItem(customerLabel);
            this.menu.addMenuItem(customerMenu);
            customers.forEach(c => {
                let item = new PopupMenu.PopupMenuItem(c.name);
                item.connect('activate', () => {
                    this._selectedCustomer = c;
                    this._selectedProject = null;
                    this._selectedActivity = null;
                    this._refreshMenu();
                    this.menu.open(); // Forza il menu a restare aperto per il prossimo step
                });
                customerMenu.menu.addMenuItem(item);
            });

            // 3. SELEZIONE PROGETTO
            if (this._selectedCustomer) {
                let projectLabel = this._selectedProject ? `📂 ${this._selectedProject.name}` : "📂 Seleziona Progetto...";
                let projectMenu = new PopupMenu.PopupSubMenuMenuItem(projectLabel);
                this.menu.addMenuItem(projectMenu);
                projects.forEach(p => {
                    let item = new PopupMenu.PopupMenuItem(p.name);
                    item.connect('activate', () => {
                        this._selectedProject = p;
                        this._selectedActivity = null;
                        this._refreshMenu();
                        this.menu.open();
                    });
                    projectMenu.menu.addMenuItem(item);
                });
            }

            // 4. SELEZIONE ATTIVITÀ + TASTO NUOVA
            if (this._selectedProject) {
                let activityLabel = this._selectedActivity ? `📝 ${this._selectedActivity.name}` : "📝 Seleziona Attività...";
                let activityMenu = new PopupMenu.PopupSubMenuMenuItem(activityLabel);
                this.menu.addMenuItem(activityMenu);
                
                activities.forEach(a => {
                    let item = new PopupMenu.PopupMenuItem(a.name);
                    item.connect('activate', () => {
                        this._selectedActivity = a;
                        this._refreshMenu();
                        this.menu.open();
                    });
                    activityMenu.menu.addMenuItem(item);
                });

                // --- TASTO "+" NUOVA ATTIVITÀ ---
                activityMenu.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                let addActItem = new PopupMenu.PopupMenuItem("➕ Nuova Attività...");
                addActItem.connect('activate', () => this._showNewActivityDialog());
                activityMenu.menu.addMenuItem(addActItem);
            }

            // 5. TASTO START
            if (this._selectedActivity && !this.activeTimesheet) {
                this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                let startBtn = new PopupMenu.PopupMenuItem("▶ AVVIA TIMER", { 
                    style_class: 'active-item',
                    reactive: true 
                });
                startBtn.connect('activate', () => this._startTimer());
                this.menu.addMenuItem(startBtn);
            }

            // 6. UTILITY
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            let testItem = new PopupMenu.PopupMenuItem("🔄 Verifica Connessione");
            testItem.connect('activate', () => this._testConnection());
            this.menu.addMenuItem(testItem);
        }

        // Funzione per creare una nuova attività al volo
        _showNewActivityDialog() {
            // Usiamo un prompt di sistema semplice per l'input
            // Nota: per semplicità usiamo una notifica che invita a Kimai,
            // oppure potremmo implementare un Entry, ma un link rapido è più stabile.
            Main.notify("Kimai Tracker", "Usa l'interfaccia web per i dettagli complessi, sto avviando la creazione rapida...");
            // Qui potresti aprire il browser o mostrare un St.Entry (più complesso)
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
                Main.notify("Kimai Tracker", "Timer avviato con successo!");
                this._refreshMenu();
            }
        }

        async _stopCurrentTimer() {
            if (this.activeTimesheet) {
                await this.extension.api.stopTimer(this.activeTimesheet.id);
                this.activeTimesheet = null;
                this.icon.gicon = new Gio.ThemedIcon({ name: 'media-playback-start-symbolic' });
                Main.notify("Kimai Tracker", "Timer fermato e registrato.");
                this._refreshMenu();
            }
        }
    }
);
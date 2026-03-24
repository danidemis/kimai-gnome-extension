import GObject from 'gi://GObject';
import St from 'gi://St';
import Gio from 'gi://Gio';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

export const KimaiIndicator = GObject.registerClass(
    { GTypeName: 'KimaiIndicator' },
    class KimaiIndicator extends PanelMenu.Button {
        _init(extension) {
            super._init(0.5, 'Kimai Tracker', false);
            this.extension = extension;
            this.activeTimesheet = null;

            // Icona nella barra superiore
            this.icon = new St.Icon({
                gicon: new Gio.ThemedIcon({ name: 'media-playback-start-symbolic' }),
                style_class: 'system-status-icon'
            });
            this.add_child(this.icon);

            // Carichiamo i dati ogni volta che il menu viene cliccato/aperto
            this.menu.connect('open-state-changed', (menu, open) => {
                if (open) {
                    this._refreshMenu();
                }
            });
        }

        async _refreshMenu() {
            this.menu.removeAll();

            // Se c'è un'attività in corso, mostriamo solo il tasto STOP
            if (this.activeTimesheet) {
                let stopItem = new PopupMenu.PopupMenuItem("🛑 Ferma Attività in corso");
                stopItem.connect('activate', () => this._stopCurrentTimer());
                this.menu.addMenuItem(stopItem);
                return;
            }

            // Recupero Clienti dal server
            const customers = await this.extension.api.getCustomers();
            
            if (!customers || customers.length === 0) {
                this.menu.addMenuItem(new PopupMenu.PopupMenuItem("Nessun cliente trovato o errore API"));
                return;
            }

            customers.forEach(customer => {
                let customerItem = new PopupMenu.PopupSubMenuMenuItem(customer.name);
                this.menu.addMenuItem(customerItem);

                // Lazy loading dei Progetti quando si espande il Cliente
                customerItem.menu.connect('open-state-changed', async (cMenu, cOpen) => {
                    if (cOpen && cMenu.isEmpty()) {
                        const projects = await this.extension.api.getProjects(customer.id);
                        
                        projects.forEach(project => {
                            let projectItem = new PopupMenu.PopupSubMenuMenuItem(project.name);
                            cMenu.addMenuItem(projectItem);

                            // Lazy loading delle Attività quando si espande il Progetto
                            projectItem.menu.connect('open-state-changed', async (pMenu, pOpen) => {
                                if (pOpen && pMenu.isEmpty()) {
                                    const activities = await this.extension.api.getActivities(project.id);
                                    
                                    activities.forEach(activity => {
                                        let actItem = new PopupMenu.PopupMenuItem(`  ↳ ${activity.name}`);
                                        actItem.connect('activate', () => {
                                            this._startTimer(project.id, activity.id, activity.name);
                                        });
                                        pMenu.addMenuItem(actItem);
                                    });
                                    
                                    // Tasto "+" rapido per nuova attività in questo progetto
                                    let addAct = new PopupMenu.PopupMenuItem("➕ Nuova Attività...");
                                    addAct.connect('activate', () => this._createNewActivity(project.id));
                                    pMenu.addMenuItem(addAct);
                                }
                            });
                        });
                    }
                });
            });
        }

        async _startTimer(projectId, activityId, name) {
            const result = await this.extension.api.startTimer(projectId, activityId);
            if (result) {
                this.activeTimesheet = result;
                this.icon.gicon = new Gio.ThemedIcon({ name: 'media-playback-stop-symbolic' });
                // Volendo qui potremmo cambiare il colore dell'icona in rosso
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
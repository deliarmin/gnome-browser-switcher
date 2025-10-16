import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class BrowserSwitcherPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings('org.gnome.shell.extensions.browser-switcher');
        
        const page = new Adw.PreferencesPage();
        const group = new Adw.PreferencesGroup({
            title: 'Custom Browsers',
            description: 'Add custom browser commands to the browser switcher',
        });
        
        const scrolled = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            min_content_height: 200,
            max_content_height: 300,
            hexpand: true,
            vexpand: true,
        });
        
        const listBox = new Gtk.ListBox({
            selection_mode: Gtk.SelectionMode.NONE,
            margin_top: 12,
            margin_bottom: 12,
        });
        
        const addButton = new Gtk.Button({
            label: 'Add Custom Browser',
            halign: Gtk.Align.END,
            margin_top: 12,
        });
        
        const saveBrowsers = () => {
            const browsers = [];
            let row = listBox.get_first_child();
            
            while (row) {
                const grid = row.get_child();
                // In GTK4, we need to get children differently
                // Grid layout: nameEntry (0,0), commandEntry (1,0), validationIcon (2,0), removeButton (3,0)
                const nameEntry = grid.get_child_at(0, 0);
                const commandEntry = grid.get_child_at(1, 0);
                
                if (nameEntry && commandEntry) {
                    const name = nameEntry.get_text().trim();
                    const command = commandEntry.get_text().trim();
                    
                    if (name && command) {
                        browsers.push(`${name}|${command}`);
                    }
                }
                
                row = row.get_next_sibling();
            }
            
            settings.set_strv('custom-browsers', browsers);
        };
        
        const addBrowserRow = (name = '', command = '') => {
            const row = new Gtk.ListBoxRow({
                activatable: false,
                selectable: false,
            });
            const grid = new Gtk.Grid({
                column_spacing: 12,
                margin_start: 6,
                margin_end: 6,
                margin_top: 12,
                margin_bottom: 12,
            });
            
            const nameEntry = new Gtk.Entry({
                text: name,
                placeholder_text: 'Browser Name',
                hexpand: true,
            });
            
            const commandEntry = new Gtk.Entry({
                text: command,
                placeholder_text: 'Command (e.g., /usr/bin/my-browser %u)',
                hexpand: true,
            });
            
            // Add validation icon
            const validationIcon = new Gtk.Image({
                icon_name: 'dialog-warning-symbolic',
                visible: false,
                tooltip_text: 'Command not found',
            });
            
            // Validate command
            const validateCommand = () => {
                const cmd = commandEntry.get_text().trim();
                if (!cmd) {
                    validationIcon.set_visible(false);
                    return;
                }
                
                const cmdParts = cmd.split(' ');
                const executable = cmdParts[0];
                
                // Check if command exists using GLib.find_program_in_path
                const found = GLib.find_program_in_path(executable);
                
                // If not found in PATH, check if it's an absolute path
                if (!found) {
                    try {
                        const file = GLib.file_test(executable, GLib.FileTest.EXISTS | GLib.FileTest.IS_EXECUTABLE);
                        validationIcon.set_visible(!file);
                    } catch (e) {
                        validationIcon.set_visible(true);
                    }
                } else {
                    validationIcon.set_visible(false);
                }
            };
            
            // Validate on change
            commandEntry.connect('changed', () => {
                validateCommand();
                saveBrowsers();
            });
            
            const removeButton = new Gtk.Button({
                icon_name: 'user-trash-symbolic',
                tooltip_text: 'Remove',
                valign: Gtk.Align.CENTER,
                can_focus: true,
                receives_default: true,
            });
            removeButton.add_css_class('destructive-action');
            
            grid.attach(nameEntry, 0, 0, 1, 1);
            grid.attach(commandEntry, 1, 0, 1, 1);
            grid.attach(validationIcon, 2, 0, 1, 1);
            grid.attach(removeButton, 3, 0, 1, 1);
            
            row.set_child(grid);
            listBox.append(row);
            
            // Initial validation
            validateCommand();
            
            removeButton.connect('clicked', () => {
                try {
                    listBox.remove(row);
                    saveBrowsers();
                } catch (e) {
                    console.error('Error removing row:', e);
                }
            });
            
            nameEntry.connect('changed', saveBrowsers);
            
            return { nameEntry, commandEntry };
        };
        
        addButton.connect('clicked', () => {
            addBrowserRow();
            window.show();
        });
        
        // Load existing custom browsers
        const customBrowsers = settings.get_strv('custom-browsers');
        customBrowsers.forEach(browser => {
            const [name, command] = browser.split('|');
            addBrowserRow(name, command);
        });
        
        // Add a default row if no browsers exist
        if (customBrowsers.length === 0) {
            addBrowserRow('', '');
        }
        
        scrolled.set_child(listBox);
        group.add(scrolled);
        group.add(addButton);
        
        const infoLabel = new Adw.ActionRow({
            title: 'Note',
            subtitle: 'The browser switcher will show all installed browsers automatically. ' +
                     'Use this section to add custom browser commands if needed.',
            activatable: false,
        });
        
        group.add(infoLabel);
        page.add(group);
        
        // Add a page for general settings
        const generalPage = new Adw.PreferencesPage();
        const generalGroup = new Adw.PreferencesGroup({
            title: 'General Settings',
            description: 'Configure general browser switcher settings',
        });
        
        const defaultBrowserRow = new Adw.ActionRow({
            title: 'Default Browser on Startup',
            subtitle: 'Choose which browser to use when logging in',
        });
        
        const defaultBrowserCombo = new Gtk.DropDown({
            model: Gtk.StringList.new(['Last Used', 'System Default']),
            selected: settings.get_boolean('use-last-browser') ? 0 : 1,
        });
        
        defaultBrowserCombo.connect('notify::selected', (dropdown) => {
            settings.set_boolean('use-last-browser', dropdown.get_selected() === 0);
        });
        
        defaultBrowserRow.add_suffix(defaultBrowserCombo);
        defaultBrowserRow.set_activatable_widget(defaultBrowserCombo);
        generalGroup.add(defaultBrowserRow);
        
        generalPage.add(generalGroup);
        
        // Add pages to the window
        window.add(page);
        window.add(generalPage);
        
        window.set_default_size(600, 500);
    }
}

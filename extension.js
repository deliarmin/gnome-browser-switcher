import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

// Utility functions
const Util = {
    spawn: (args) => {
        try {
            const [command, ...rest] = args;
            const appInfo = Gio.AppInfo.create_from_commandline(
                command,
                null,
                Gio.AppInfoCreateFlags.NONE
            );
            if (appInfo) {
                return appInfo.launch_uris(
                    rest,
                    Gio.AppLaunchContext.new()
                );
            }
        } catch (e) {
            console.error('Failed to execute command:', args, e);
        }
        return false;
    }
};

// BrowserSwitcher class
const BrowserSwitcher = GObject.registerClass(
class BrowserSwitcher extends PanelMenu.Button {
    _init(settings, extensionUuid) {
        super._init(0.0, 'Browser Switcher');
        
        if (!settings) {
            console.error('BrowserSwitcher: settings is null or undefined');
            return;
        }
        
        this._settings = settings;
        this._extensionUuid = extensionUuid;
        this._updateCustomBrowsers();
        
        // Create the panel icon
        this._box = new St.BoxLayout();
        this._icon = new St.Icon({
            icon_name: 'web-browser-symbolic',
            style_class: 'system-status-icon'
        });
        this._box.add_child(this._icon);
        this.add_child(this._box);
        
        // Set up the menu
        this._menu = this.menu;
        
        // Connect to settings changes
        this._settings.connect('changed::custom-browsers', () => {
            this._updateCustomBrowsers();
            this._buildMenu();
        });
        
        // Initial build of the menu
        this._buildMenu();
        this._updateCurrentBrowser();
    }
    
    _updateCustomBrowsers() {
        this.customBrowsers = this._settings.get_strv('custom-browsers')
            .map(b => {
                const [name, cmd] = b.split('|');
                return { name: name?.trim() || 'Unnamed Browser', command: cmd?.trim() || '' };
            })
            .filter(b => b.command);
    }
    
    _buildMenu() {
        this._menu.removeAll();
        
        // Add default browsers
        const defaultBrowsers = this._getDefaultBrowsers();
        const installedBrowsers = this._getInstalledBrowsers();
        const allBrowsers = [...defaultBrowsers, ...installedBrowsers, ...this.customBrowsers];
        
        // Remove duplicates by name and filter out invalid entries
        const uniqueBrowsers = [];
        const names = new Set();
        
        allBrowsers.forEach(browser => {
            if (browser?.name && browser.command && !names.has(browser.name.toLowerCase())) {
                names.add(browser.name.toLowerCase());
                uniqueBrowsers.push(browser);
            }
        });

        // Sort browsers alphabetically
        uniqueBrowsers.sort((a, b) => a.name.localeCompare(b.name));

        // Add each browser to the menu
        uniqueBrowsers.forEach(browser => {
            const item = new PopupMenu.PopupMenuItem(browser.name);
            item.connect('activate', () => this._setDefaultBrowser(browser));
            this._menu.addMenuItem(item);
        });

        // Add separator
        this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // Add settings item
        const settingsItem = new PopupMenu.PopupMenuItem(_('Settings...'));
        settingsItem.connect('activate', () => {
            try {
                Gio.Subprocess.new(
                    ['gnome-extensions', 'prefs', this._extensionUuid],
                    Gio.SubprocessFlags.NONE
                );
            } catch (e) {
                console.error('Failed to open preferences:', e);
            }
        });
        this._menu.addMenuItem(settingsItem);
    }
    
    _getDefaultBrowsers() {
        // Return empty array - we'll only use installed browsers from _getInstalledBrowsers()
        return [];
    }
    
    _getInstalledBrowsers() {
        const browsers = [];
        const seenIds = new Set();
        
        // Get all registered web browsers (includes both native and Flatpak)
        const allApps = Gio.AppInfo.get_all_for_type('x-scheme-handler/http');
        
        // Also check for https handlers
        const httpsApps = Gio.AppInfo.get_all_for_type('x-scheme-handler/https');
        
        // Combine both lists
        const combinedApps = [...allApps, ...httpsApps];
        
        combinedApps.forEach(appInfo => {
            try {
                const name = appInfo.get_display_name();
                const id = appInfo.get_id();
                const command = appInfo.get_commandline();
                
                // Don't filter by should_show() - we want to show all browsers
                // even if they're marked as hidden in the application menu
                
                // Skip if we've already added this app or if it's missing required info
                if (!name || !id || !command || seenIds.has(id)) {
                    return;
                }
                
                seenIds.add(id);
                
                browsers.push({
                    name: name,
                    command: command,
                    desktopId: id,
                    icon: appInfo.get_icon(),
                    appInfo: appInfo
                });
            } catch (e) {
                console.error(`Error processing browser:`, e);
            }
        });
        return browsers;
    }
    
    _setDefaultBrowser(browser) {
        if (!browser?.name || !browser.command) {
            console.error('Invalid browser object:', browser);
            return;
        }

        this._settings.set_string('last-used-browser', `${browser.name}|${browser.command}|${browser.desktopId || ''}`);
        this._updateCurrentBrowser();
        
        // Update the default web browser
        try {
            if (browser.appInfo) {
                // For installed browsers with appInfo
                browser.appInfo.set_as_default_for_type('x-scheme-handler/http');
                browser.appInfo.set_as_default_for_type('x-scheme-handler/https');
                
                // Also try xdg-settings with the desktop file ID
                if (browser.desktopId) {
                    try {
                        Gio.Subprocess.new(
                            ['xdg-settings', 'set', 'default-web-browser', browser.desktopId],
                            Gio.SubprocessFlags.NONE
                        );
                    } catch (e) {
                        console.log('xdg-settings failed (this is okay):', e.message);
                    }
                }
                
            } else {
                // For custom browsers without appInfo, create a temporary AppInfo
                
                try {
                    // First, validate that the command exists
                    const commandParts = browser.command.split(' ');
                    const executable = commandParts[0];
                    
                    // Check if the executable exists
                    const executableFile = Gio.File.new_for_path(executable);
                    if (!executableFile.query_exists(null)) {
                        // Try to find it in PATH
                        const foundInPath = GLib.find_program_in_path(executable);
                        if (!foundInPath) {
                            console.error(`Custom browser command not found: ${executable}`);
                            Main.notify(
                                'Browser Switcher',
                                `Cannot set "${browser.name}" as default: Command "${executable}" not found`
                            );
                            return;
                        }
                    }
                    
                    const appInfo = Gio.AppInfo.create_from_commandline(
                        browser.command,
                        browser.name,
                        Gio.AppInfoCreateFlags.SUPPORTS_URIS
                    );
                    
                    if (appInfo) {
                        appInfo.set_as_default_for_type('x-scheme-handler/http');
                        appInfo.set_as_default_for_type('x-scheme-handler/https');
                        Main.notify(
                            'Browser Switcher',
                            `Default browser changed to: ${browser.name}`
                        );
                    } else {
                        console.error('Failed to create AppInfo for custom browser');
                        Main.notify(
                            'Browser Switcher',
                            `Failed to set "${browser.name}" as default browser`
                        );
                    }
                } catch (e) {
                    console.error('Failed to set custom browser as default:', e);
                    Main.notify(
                        'Browser Switcher',
                        `Error setting "${browser.name}": ${e.message}`
                    );
                }
            }
        } catch (e) {
            console.error('Failed to set default browser:', e);
        }
    }
    
    _updateCurrentBrowser() {
        const lastUsed = this._settings.get_string('last-used-browser');
        if (lastUsed) {
            const [name] = lastUsed.split('|');
            this._setBrowserIcon(name);
        } else {
            this._setBrowserIcon('default');
        }
    }
    
    _setBrowserIcon(browserName) {
        if (!browserName || browserName === 'default') {
            this._icon.icon_name = 'web-browser-symbolic';
            return;
        }
        
        const iconName = this._getBrowserIconName(browserName);
        this._icon.icon_name = iconName;
        this._icon.visible = true;
    }
    
    _getBrowserIconName(browserName) {
        if (!browserName) return 'web-browser-symbolic';
        
        const lowerName = browserName.toLowerCase();
        
        // Check for known browser names first
        if (lowerName.includes('firefox')) return 'firefox-symbolic';
        if (lowerName.includes('chrome')) return 'google-chrome-symbolic';
        if (lowerName.includes('chromium')) return 'chromium-browser-symbolic';
        if (lowerName.includes('brave')) return 'brave-browser-symbolic';
        if (lowerName.includes('vivaldi')) return 'vivaldi-symbolic';
        if (lowerName.includes('edge')) return 'microsoft-edge-symbolic';
        if (lowerName.includes('opera')) return 'opera-symbolic';
        if (lowerName.includes('safari')) return 'safari-symbolic';
        if (lowerName.includes('epiphany') || lowerName.includes('web')) return 'web-browser-symbolic';
        
        return 'web-browser-symbolic';
    }
});

// Main extension class
export default class BrowserSwitcherExtension extends Extension {
    enable() {
        try {
            // getSettings() without parameters uses the default schema from metadata.json
            const settings = this.getSettings();
            if (!settings) {
                console.error('Failed to get settings for browser-switcher extension');
                return;
            }
            
            this._browserSwitcher = new BrowserSwitcher(settings, this.uuid);
            Main.panel.addToStatusArea('browser-switcher', this._browserSwitcher);
        } catch (e) {
            console.error('Error enabling browser-switcher extension:', e);
        }
    }

    disable() {
        if (this._browserSwitcher) {
            this._browserSwitcher.destroy();
            this._browserSwitcher = null;
        }
    }
}

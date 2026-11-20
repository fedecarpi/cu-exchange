import { green, red } from 'ansicolor';
import { Tray, app, ipcMain, BrowserWindow, Point, nativeTheme } from 'electron';
import * as fs from 'fs';
import { menubar } from 'menubar';
import * as path from 'path';
import { log } from 'electron-log';
const os = require('os');
import { CATEGORY_SOURCES, NormalizedQuote, PROVIDERS, QuotationConfig, Source, normalizeQuotation } from './providers';
import { buildTrayMenu, popupPositionFor, trayAnchor } from './tray-linux';

const platforms = {
  WINDOWS: 'WINDOWS',
  MAC: 'MAC',
  LINUX: 'LINUX',
  SUN: 'SUN',
  OPENBSD: 'OPENBSD',
  ANDROID: 'ANDROID',
  AIX: 'AIX',
};

const platformsNames = {
  win32: platforms.WINDOWS,
  darwin: platforms.MAC,
  linux: platforms.LINUX,
  sunos: platforms.SUN,
  openbsd: platforms.OPENBSD,
  android: platforms.ANDROID,
  aix: platforms.AIX,
};

const currentPlatform = platformsNames[os.platform()];
const isMac = currentPlatform == platforms.MAC;
const isLinux = currentPlatform == platforms.LINUX;

const args = process.argv.slice(1),
  serve = args.some(val => val === '--serve');

const POPUP_WIDTH = 240;
const POPUP_MIN_HEIGHT = 120;
const HISTORY_CACHE_TTL_MS = 60 * 60 * 1000;
const trayNumberFormatter = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let mb = null;
let tray = null
let preferenceWin: BrowserWindow = null;
let historyWin: BrowserWindow = null;
let preferencesFilePath = null;
let popupAnchor: Point | null = null;
const historyCache = new Map<string, { timestamp: number; points: { date: string; value: number }[] }>();

function themeBackgroundColor() {
  return nativeTheme.shouldUseDarkColors ? '#0e131b' : '#f5f7fb';
}

function applyTheme(jsonProperties) {
  const theme = jsonProperties && jsonProperties.theme;
  nativeTheme.themeSource = theme === 'light' || theme === 'dark' ? theme : 'system';
}

function rendererURL(route: string) {
  if (serve) {
    return 'http://localhost:4200/#/' + route;
  }
  // Path when running electron executable
  let pathIndex = './index.html';
  if (fs.existsSync(path.join(__dirname, '../dist/index.html'))) {
    // Path when running electron in local folder
    pathIndex = '../dist/index.html';
  }
  const url = new URL(path.join('file:', __dirname, pathIndex));
  url.hash = '/' + route;
  return url.href;
}

function createTrayApp() {
  //Preventing running more than one tray instance
  if (!mb) {
      if (serve) {
        require('electron-debug');
        require('electron-reloader')(module);
      }

      tray = new Tray(path.resolve(__dirname, 'icons/MenuIconTemplate.png'))

      mb = menubar({
        tray,
        index: rendererURL('home'),
        showDockIcon: false,
        preloadWindow: true,
        browserWindow: {
          width: POPUP_WIDTH,
          height: 260,
          minHeight: POPUP_MIN_HEIGHT,
          minWidth: POPUP_WIDTH,
          resizable: (serve)?true:false,
          skipTaskbar: true,
          roundedCorners: true,
          transparent: isMac,
          vibrancy: isMac ? 'popover' : undefined,
          visualEffectState: isMac ? 'active' : undefined,
          backgroundColor: isMac ? '#00000000' : themeBackgroundColor(),
          webPreferences: {
            nodeIntegration: true,
            allowRunningInsecureContent: (serve),
            contextIsolation: false,  // false if you want to run e2e test with Spectron
          }}
      });

      if (isLinux) {
        setupLinuxTray();
      }
  }
}

function setupLinuxTray() {
  // menubar has no tray bounds on Linux and falls back to a screen corner; it reads browserWindow.x/y right after 'show'.
  mb.on('show', () => {
    popupAnchor = trayAnchor(tray);
    const [width, height] = mb.window.getSize();
    const { x, y } = popupPositionFor(popupAnchor, { width, height });
    mb.setOption('browserWindow', { ...mb.getOption('browserWindow'), x, y });
  });
  mb.on('ready', () => updateTrayMenu(null));
}

function updateTrayMenu(header: string | null) {
  tray.setContextMenu(buildTrayMenu(header, app.getLocale(), {
    show: () => mb.showWindow(),
    refresh: () => getCurrencyValues(null),
    preferences: () => openPreferences(),
    quit: () => app.quit()
  }));
}

try {

  preferencesFilePath = resolvePreferencesPath();

  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    log('Instance app does not get the lock ... closing it!');
    app.quit()
  } else {
    log('Running first instance app ...');
    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    // Added 400 ms to fix the black background issue while using transparent window. More detais at https://github.com/electron/electron/issues/15947
    app.on('ready', () => {
      applyTheme(getJsonProperties());
      setTimeout(()=> {
        createTrayApp();
        if (isMac) {
          app.dock.hide();
        }
      }, 400);

      nativeTheme.on('updated', () => {
        BrowserWindow.getAllWindows().forEach(win => {
          if (!(isMac && mb && win === mb.window)) {
            win.setBackgroundColor(themeBackgroundColor());
          }
        });
      });
    });

    // Quit when all windows are closed.
    app.on('window-all-closed', () => {
      // On OS X it is common for applications and their menu bar
      // to stay active until the user quits explicitly with Cmd + Q
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('activate', () => {
      // On OS X it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      createTrayApp();
      if (isMac) {
        app.dock.hide();
      }
    });
  }
} catch (e) {
  // Catch Error
  log(e);
}

// Packaged builds ship the defaults inside read-only resources (e.g. /opt on the Linux .deb),
// so the user's copy lives in userData, seeded from the bundled file on first run.
function resolvePreferencesPath() {
  const bundled = serve
    ? path.resolve(__dirname, 'config/cu-exchange-properties.json')
    : path.resolve(__dirname, '../app/config/cu-exchange-properties.json');
  if (!app.isPackaged) {
    return bundled;
  }
  const userFile = path.join(app.getPath('userData'), 'cu-exchange-properties.json');
  if (!fs.existsSync(userFile)) {
    fs.mkdirSync(path.dirname(userFile), { recursive: true });
    fs.copyFileSync(bundled, userFile);
  }
  return userFile;
}

function getJsonProperties() {
  let rawdata = fs.readFileSync(preferencesFilePath, 'utf8');
  let jsonPref = JSON.parse(rawdata);
  const quotations = Array.isArray(jsonPref.quotations) ? jsonPref.quotations : [];
  jsonPref.quotations = quotations.map(normalizeQuotation).filter(q => q !== null);
  return jsonPref;
}

function getSelectedCurrency() {
  let jsonProperties = getJsonProperties();  
  if (jsonProperties) {
    return jsonProperties.defaultCurrency;
  } else {
    return 'oficial';
  }
}

function getQuotations(): QuotationConfig[] {
  return getJsonProperties().quotations;
}

function updateTray(quotes: Record<string, NormalizedQuote>) {
  const selectedCurrency = getSelectedCurrency();
  const quote = quotes[selectedCurrency];
  if (!quote) {
    return;
  }
  const quotation = getQuotations().find(q => q.name == selectedCurrency);
  const label = !quotation || quotation.category == 'dolar' ? selectedCurrency.slice(0, 3) : selectedCurrency;
  const prefix = quote.currency == 'USD' ? 'US$' : '$';
  const value = trayNumberFormatter.format(quote.value);
  const variation = trayNumberFormatter.format(quote.variation) + '%';
  const arrow = quote.trend == 'up' || quote.trend == 'equal' ? '↗' : '↘';
  tray.setToolTip(selectedCurrency + ': ' + prefix + value + ' (' + variation + ')');
  // Tray.setTitle only renders on macOS, so on Linux the value lives in the tooltip and the menu header.
  if (isLinux) {
    updateTrayMenu(label + ': ' + prefix + value + ' ' + arrow + ' (' + variation + ')');
    return;
  }
  if (arrow == '↗') {
    tray.setTitle(label + ': ' + green(value + '↗'));
  } else {
    tray.setTitle(label + ': ' + red(value + '↘'));
  }
}

async function fetchAllQuotes(): Promise<Record<string, NormalizedQuote>> {
  const bySource = new Map<Source, QuotationConfig[]>();
  getQuotations().forEach(q => bySource.set(q.source, [...(bySource.get(q.source) || []), q]));
  const results = await Promise.all(Array.from(bySource.entries()).map(([source, items]) =>
    PROVIDERS[source].fetchQuotes(items)
      .then(quotes => ({ ok: true, quotes }))
      .catch(err => {
        log('Error fetching ' + source + ' quotes: ' + err);
        return { ok: false, quotes: {} as Record<string, NormalizedQuote> };
      })
  ));
  if (results.length > 0 && results.every(r => !r.ok)) {
    throw new Error('No provider returned quotes');
  }
  return results.reduce((all, r) => ({ ...all, ...r.quotes }), {} as Record<string, NormalizedQuote>);
}

function getCurrencyValues(event) {
  const target = event ? event.sender : (mb && mb.window ? mb.window.webContents : null);
  fetchAllQuotes().then(quotes => {
    updateTray(quotes);
    if (target && !target.isDestroyed()) {
      if (!event) {
        target.send('load-json-properties', getJsonProperties());
      }
      target.send('update-currency-values-ui', quotes);
    }
  }).catch(err => {
    log('Error fetching currency values: ' + err);
    if (target && !target.isDestroyed()) {
      target.send('currency-values-error', String(err));
    }
  });
}

ipcMain.handle('get-currency-history', async (event, { name, from, to }) => {
  const quotation = getQuotations().find(q => q.name == name);
  if (!quotation) {
    return [];
  }
  const key = [quotation.source, quotation.category, quotation.symbol || quotation.fetchURL || name, from, to].join('|');
  const cached = historyCache.get(key);
  if (cached && Date.now() - cached.timestamp < HISTORY_CACHE_TTL_MS) {
    return cached.points;
  }
  try {
    const points = await PROVIDERS[quotation.source].fetchHistory(quotation, from, to);
    historyCache.set(key, { timestamp: Date.now(), points });
    return points;
  } catch (err) {
    log('Error fetching history for ' + name + ': ' + err);
    return [];
  }
});

ipcMain.handle('get-catalog', async (event, category) => {
  const provider = PROVIDERS[CATEGORY_SOURCES[category]];
  if (!provider || !provider.fetchCatalog) {
    return [];
  }
  try {
    return await provider.fetchCatalog(category);
  } catch (err) {
    log('Error fetching ' + category + ' catalog: ' + err);
    return [];
  }
});

ipcMain.on('get-currency-values', (event, data) => {
  getCurrencyValues(event);
});

ipcMain.on('resize-popup', (event, height) => {
  if (mb && mb.window && typeof height === 'number' && height > 0) {
    const newHeight = Math.max(POPUP_MIN_HEIGHT, Math.ceil(height));
    const [width, currentHeight] = mb.window.getSize();
    if (currentHeight === newHeight) {
      return;
    }
    if (isLinux && !mb.window.isResizable()) {
      // GTK pins min = max size hints on non-resizable windows, so setSize can't shrink them.
      mb.window.setResizable(true);
      mb.window.setSize(width, newHeight);
      mb.window.setResizable(false);
    } else {
      mb.window.setSize(width, newHeight);
    }
    if (isLinux && popupAnchor && mb.window.isVisible()) {
      const { x, y } = popupPositionFor(popupAnchor, { width, height: newHeight });
      mb.window.setPosition(x, y);
    }
  }
});

ipcMain.on('close-app', (event, value) => {
  app.quit();
});

function secondaryWindowOptions(title: string, width: number, height: number) {
  return {
    // Linux and Windows would otherwise show Electron's default File/Edit/View menu bar.
    autoHideMenuBar: !isMac,
    width,
    height,
    title,
    show: false,
    backgroundColor: themeBackgroundColor(),
    titleBarStyle: isMac ? 'hiddenInset' as const : 'default' as const,
    webPreferences: {
      nodeIntegration: true,
      allowRunningInsecureContent: (serve),
      contextIsolation: false,  // false if you want to run e2e test with Spectron
    },
  };
}

function createPreferenceWindow() {
  preferenceWin = new BrowserWindow({
    ...secondaryWindowOptions('Preferences', 460, 780),
    alwaysOnTop: true,
    resizable: (serve)?true:false,
  });

  preferenceWin.on('close', (e) => {
    preferenceWin = null;
    // Revert a theme preview that was not saved.
    applyTheme(getJsonProperties());
  })

  if (!isMac) {
    preferenceWin.removeMenu();
  }
  preferenceWin.once('ready-to-show', () => preferenceWin && preferenceWin.show());
  preferenceWin.center();
  preferenceWin.loadURL(rendererURL('preferences'));
}

function openPreferences() {
  //Check if preference win is already open
  if (preferenceWin) {
    preferenceWin.reload();
    preferenceWin.focus();
  } else {
    createPreferenceWindow();
  }
}

ipcMain.on('show-preferences', () => openPreferences());

function createHistoryWindow(name: string) {
  historyWin = new BrowserWindow({
    ...secondaryWindowOptions('Histórico', 780, 520),
    minWidth: 560,
    minHeight: 420,
  });

  historyWin.on('close', () => {
    historyWin = null;
  });

  if (!isMac) {
    historyWin.removeMenu();
  }
  historyWin.once('ready-to-show', () => historyWin && historyWin.show());
  historyWin.center();
  historyWin.loadURL(rendererURL('history/' + encodeURIComponent(name)));
}

ipcMain.on('open-history', (event, name) => {
  if (mb && !serve) {
    mb.hideWindow();
  }
  if (historyWin) {
    historyWin.webContents.send('history-select-currency', name);
    historyWin.show();
    historyWin.focus();
  } else {
    createHistoryWindow(name);
  }
});

ipcMain.on('load-preferences', (event, value) => {
    let jsonProperties = getJsonProperties();
    event.sender.send('load-json-properties', jsonProperties );
});


ipcMain.on('preview-theme', (event, theme) => {
  nativeTheme.themeSource = theme === 'light' || theme === 'dark' ? theme : 'system';
});

ipcMain.on('close-preference-win', (event, value) => {
  if (preferenceWin) {
    preferenceWin.close();
  }
});

// Ámbito dollars are fixed; only market instruments can be added or removed from Preferences.
function mergeQuotations(current: QuotationConfig[], requested: any[]): QuotationConfig[] {
  const merged = current.filter(q => q.source == 'ambito');
  const names = new Set(merged.map(q => q.name));
  requested.forEach(raw => {
    if (!raw || raw.category == 'dolar' || !(raw.category in CATEGORY_SOURCES)) {
      return;
    }
    const quotation = normalizeQuotation({
      name: String(raw.name),
      category: raw.category,
      source: CATEGORY_SOURCES[raw.category],
      symbol: String(raw.symbol || raw.name).toUpperCase()
    });
    if (quotation && !names.has(quotation.name)) {
      names.add(quotation.name);
      merged.push(quotation);
    }
  });
  return merged;
}

ipcMain.on('save-preferences', (event, newPreferences) => {
  const jsonProperties = getJsonProperties();
  if (newPreferences) {
    if (Array.isArray(newPreferences.quotations)) {
      jsonProperties.quotations = mergeQuotations(jsonProperties.quotations, newPreferences.quotations);
    }
    const names = new Set(jsonProperties.quotations.map(q => q.name));
    jsonProperties.defaultCurrency = names.has(newPreferences.defaultCurrency)
      ? newPreferences.defaultCurrency : jsonProperties.quotations[0]?.name;
    jsonProperties.showCurrencies = (newPreferences.showCurrencies || []).filter(name => names.has(name));
    jsonProperties.theme = newPreferences.theme === 'light' || newPreferences.theme === 'dark'
      ? newPreferences.theme : 'system';
    try {
      fs.writeFileSync(preferencesFilePath, JSON.stringify(jsonProperties, null, 2), 'utf8');
    } catch (err) {
      log('Error saving preferences: ' + err);
    }
    getCurrencyValues(null);
    if (historyWin) {
      historyWin.webContents.send('load-json-properties', jsonProperties);
    }
    if (preferenceWin) {
      preferenceWin.close();
    }
  }
});

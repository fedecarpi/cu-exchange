import { green, red } from 'ansicolor';
import { Tray, app, ipcMain, BrowserWindow, screen, nativeTheme } from 'electron';
import * as fs from 'fs';
import { menubar } from 'menubar';
import * as path from 'path';
import { log } from 'electron-log';
const os = require('os');
import axios from 'axios';

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

const args = process.argv.slice(1),
  serve = args.some(val => val === '--serve');

const POPUP_WIDTH = 240;
const POPUP_MIN_HEIGHT = 120;
const HISTORY_CACHE_TTL_MS = 60 * 60 * 1000;
const AMBITO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  'Referer': 'https://www.ambito.com/',
  'Origin': 'https://www.ambito.com',
};

let mb = null;
let tray = null
let preferenceWin: BrowserWindow = null;
let historyWin: BrowserWindow = null;
let preferencesFilePath = null;
let quotations = [];
let currencies = [];
const historyCache = new Map<string, { timestamp: number; points: { date: string; value: number }[] }>();

function themeBackgroundColor() {
  return nativeTheme.shouldUseDarkColors ? '#0e131b' : '#f5f7fb';
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
          x: (currentPlatform == platforms.LINUX)?screen.getCursorScreenPoint().x - 20:undefined,
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

  }
}

try {

  if (serve) {
    preferencesFilePath = path.resolve(__dirname, 'config/cu-exchange-properties.json');
  } else {
    preferencesFilePath = path.resolve(__dirname, '../app/config/cu-exchange-properties.json');
  }

  const gotTheLock = app.requestSingleInstanceLock();
  currencies = getQuotationsNames();
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

function getJsonProperties() {
  let rawdata = fs.readFileSync(preferencesFilePath, 'utf8');
  let jsonPref = JSON.parse(rawdata);
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

function getQuotations() {
  if (!quotations || quotations.length == 0) {
    let json = getJsonProperties();
    quotations = json.quotations;
  }
  return quotations;
}

function getQuotationsNames() {
  if (!quotations || quotations.length == 0) {
    let json = getJsonProperties();
    quotations = json.quotations;
  }
  let names = [];
  quotations.forEach(q => {
    names.push(q.name);
  });
  return names;
}

function calculateQName(axiosResp) {
  const qs = getQuotations();
  for (let index = 0; index < qs.length; index++) {
    const element = qs[index];
    if (element['fetchURL'] == axiosResp['config']['url'] ) {
      return element['name'];
    }
  }
}

function getDataFromRequests(axiosData) { 
  let resp = {};
  axiosData.forEach(axiosResp => {
    const qName = calculateQName(axiosResp);
    resp[qName] = axiosResp['data'];
  });
  return resp;
}

function parseAmbitoNumber(raw) {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  if (typeof raw === 'number') {
    return raw;
  }
  let text = String(raw).replace('%', '').trim();
  if (text.includes(',')) {
    text = text.replace(/\./g, '').replace(',', '.');
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function updateTray(jsonObj) {
  const selectedCurrency = getSelectedCurrency();
  const quote = jsonObj[selectedCurrency];
  if (!quote) {
    return;
  }
  const value = quote['valor'] || quote['compra'];
  tray.setToolTip(selectedCurrency + ': $' + value + ' (' + quote['variacion'] + ')');
  if (quote['class-variacion'] == 'up' || quote['class-variacion'] == 'equal') {
    tray.setTitle(selectedCurrency.slice(0, 3) + ': ' + green(value + '↗'));
  } else {
    tray.setTitle(selectedCurrency.slice(0, 3) + ': ' + red(value + '↘'));
  }
}

function getCurrencyValues(event) {
  const target = event ? event.sender : (mb && mb.window ? mb.window.webContents : null);
  try {
    const quotations = getQuotations();
    const requests = [];
    quotations.forEach(q => {
      requests.push(axios.get(q.fetchURL, { timeout: 15000 }));
    });
    Promise.all(requests).then(function(values) {
      if (values) {
        const jsonObj = getDataFromRequests(values);
        if (jsonObj) {
          updateTray(jsonObj);
          if (target && !target.isDestroyed()) {
            if (!event) {
              target.send('load-json-properties', getJsonProperties());
            }
            target.send('update-currency-values-ui', jsonObj);
          }
        }
      }
    }).catch(err => {
      log('Error fetching currency values: ' + err);
      if (target && !target.isDestroyed()) {
        target.send('currency-values-error', String(err));
      }
    });
  } catch (err) {
    log(err);
    if (target && !target.isDestroyed()) {
      target.send('currency-values-error', String(err));
    }
  }
}

function historyURLFor(quotation, from: string, to: string) {
  if (quotation.historyURL) {
    return quotation.historyURL.replace('{from}', from).replace('{to}', to);
  }
  if (/\/variacion\/?$/.test(quotation.fetchURL)) {
    return quotation.fetchURL.replace(/\/variacion\/?$/, `/historico-general/${from}/${to}`);
  }
  return null;
}

// Ambito returns [["Fecha","Compra","Venta"], ["dd/mm/yyyy","1.234,56",...], ...] with duplicates and no stable order.
function parseHistory(rows) {
  if (!Array.isArray(rows) || rows.length < 2 || !Array.isArray(rows[0])) {
    return [];
  }
  const header = rows[0].map(h => String(h).toLowerCase());
  let column = header.indexOf('compra');
  if (column < 0) {
    column = header.length - 1;
  }
  const byDate = new Map<string, number>();
  rows.slice(1).forEach(row => {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(row[0]));
    const value = parseAmbitoNumber(row[column]);
    if (match && value !== null) {
      byDate.set(`${match[3]}-${match[2]}-${match[1]}`, value);
    }
  });
  return Array.from(byDate.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

ipcMain.handle('get-currency-history', async (event, { name, from, to }) => {
  const quotation = getQuotations().find(q => q.name == name);
  if (!quotation) {
    return [];
  }
  const url = historyURLFor(quotation, from, to);
  if (!url) {
    return [];
  }
  const cached = historyCache.get(url);
  if (cached && Date.now() - cached.timestamp < HISTORY_CACHE_TTL_MS) {
    return cached.points;
  }
  try {
    const resp = await axios.get(url, { headers: AMBITO_HEADERS, timeout: 15000 });
    const points = parseHistory(resp.data);
    historyCache.set(url, { timestamp: Date.now(), points });
    return points;
  } catch (err) {
    log('Error fetching history for ' + name + ': ' + err);
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
    if (currentHeight !== newHeight) {
      mb.window.setSize(width, newHeight);
    }
  }
});

ipcMain.on('close-app', (event, value) => {
  app.quit();
});

function secondaryWindowOptions(title: string, width: number, height: number) {
  return {
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
    ...secondaryWindowOptions('Preferences', 440, 480),
    alwaysOnTop: true,
    resizable: (serve)?true:false,
  });

  preferenceWin.on('close', (e) => {
    preferenceWin = null;
  })

  preferenceWin.once('ready-to-show', () => preferenceWin && preferenceWin.show());
  preferenceWin.center();
  preferenceWin.loadURL(rendererURL('preferences'));
}

ipcMain.on('show-preferences', (event, value) => {
  //Check if preference win is already open
  if (preferenceWin) {
    preferenceWin.reload();
    preferenceWin.focus();
  } else {
    createPreferenceWindow();
  }
});

function createHistoryWindow(name: string) {
  historyWin = new BrowserWindow({
    ...secondaryWindowOptions('Histórico', 780, 520),
    minWidth: 560,
    minHeight: 420,
  });

  historyWin.on('close', () => {
    historyWin = null;
  });

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


ipcMain.on('close-preference-win', (event, value) => {
  if (preferenceWin) {
    preferenceWin.close();
  }
});

ipcMain.on('save-preferences', (event, newPreferences) => {
  const jsonProperties = getJsonProperties();
  if (newPreferences) {
    jsonProperties.defaultCurrency = newPreferences.defaultCurrency;
    jsonProperties.showCurrencies = newPreferences.showCurrencies;
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

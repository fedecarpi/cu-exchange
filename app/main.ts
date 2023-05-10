import { green, red } from 'ansicolor';
import { Tray, app, ipcMain, BrowserWindow, screen } from 'electron';
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

const args = process.argv.slice(1),
  serve = args.some(val => val === '--serve');

let mb = null;
let tray = null
let preferenceWin: BrowserWindow = null;
let preferencesFilePath = null;
let quotations = [];
let currencies = [];

function createTrayApp() {
  //Preventing running more than one tray instance
  if (!mb) {
      let indexURL = null;

      if (serve) {
        const debug = require('electron-debug');
        require('electron-reloader')(module);
        //win.loadURL('http://localhost:4200');
        indexURL = 'http://localhost:4200';
        //preferencesFilePath = path.resolve(__dirname, 'config/cu-exchange-properties.json');
      } else {
        // Path when running electron executable
        let pathIndex = './index.html';
        if (fs.existsSync(path.join(__dirname, '../dist/index.html'))) {
          // Path when running electron in local folder
          pathIndex = '../dist/index.html';
        }
        const url = new URL(path.join('file:', __dirname, pathIndex));
        //win.loadURL(url.href);
        indexURL = url.href;
        //preferencesFilePath = path.resolve(__dirname, '../app/config/cu-exchange-properties.json');
      }

      tray = new Tray(path.resolve(__dirname, 'icons/MenuIconTemplate.png'))

      mb = menubar({
        tray,
        index: indexURL,
        showDockIcon: false,
        preloadWindow: true,
        browserWindow: {
          x: (currentPlatform == platforms.LINUX)?screen.getCursorScreenPoint().x - 20:undefined,
          width: 185,
          height: 160,
          minHeight: 160,
          minWidth: 185,
          resizable: (serve)?true:false,
          skipTaskbar: true,
          roundedCorners: true,
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
        //initVariables(createTrayApp);
        if (currentPlatform == platforms.MAC) {
          app.dock.hide();
        }
      }, 400);
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
      //initVariables(createTrayApp);
      if (currentPlatform == platforms.MAC) {
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
  //jsonPref['currencies'] = currencies;
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

function getCurrencyValues(event) {
  try {
    const quotations = getQuotations();
    const requests = [];
    quotations.forEach(q => {
      requests.push(axios.get(q.fetchURL));
    });
    Promise.all(requests).then(function(values) {
      if (values) {
        const jsonObj = getDataFromRequests(values);
        if (jsonObj) {
          var selectedCurrency = getSelectedCurrency();
          tray.setToolTip(selectedCurrency + ': ' +  jsonObj[selectedCurrency]['compra']);
          if (jsonObj[selectedCurrency]['class-variacion'] == 'up' || jsonObj[selectedCurrency]['class-variacion'] == 'equal') {
            tray.setTitle(selectedCurrency.slice(0, 3) + ': ' + green(jsonObj[selectedCurrency]['compra'] + '↗'));
          } else {
            tray.setTitle(selectedCurrency.slice(0, 3) + ': ' + red(jsonObj[selectedCurrency]['compra'] + '↘'));
          }
          if (event) {
            event.sender.send('update-currency-values-ui', jsonObj);
          } else {
            let props = getJsonProperties();
            mb.window.send('load-json-properties', props);
            mb.window.send('update-currency-values-ui', jsonObj);
          }
        }
      }
    });
  } catch (err) {
    log(err);
  }
}

ipcMain.on('get-currency-values', (event, data) => {
  getCurrencyValues(event);
});

ipcMain.on('close-app', (event, value) => {
  app.quit();
});

function createPreferenceWindow() {
  const size = screen.getPrimaryDisplay().workAreaSize;
  preferenceWin = new BrowserWindow({
    x: 0,
    y: 0,
    width: Math.round((size.width / 4) - 50),
    height: Math.round((size.height / 3) + 70),
    alwaysOnTop: true,
    title: 'Preferences',
    resizable: (serve)?true:false,
    webPreferences: {
      nodeIntegration: true,
      allowRunningInsecureContent: (serve),
      contextIsolation: false,  // false if you want to run e2e test with Spectron
    },
  });

  preferenceWin.on('close', (e) => {
    preferenceWin = null;
  })

  preferenceWin.center();

  if (serve) {
    const debug = require('electron-debug');
    require('electron-reloader')(module);
    preferenceWin.loadURL('http://localhost:4200/#/preferences');
  } else {
    // Path when running electron executable
    let pathIndex = './index.html#/preferences';

    if (fs.existsSync(path.join(__dirname, '../dist/index.html'))) {
       // Path when running electron in local folder
      pathIndex = '../dist/index.html#/preferences';
    }

    const url = new URL(path.join('file:', __dirname, pathIndex));
    preferenceWin.loadURL(url.href);
  }
}

ipcMain.on('show-preferences', (event, value) => {
  //Check if preference win is already open
  if (preferenceWin) {
    preferenceWin.reload();
  } else {
    createPreferenceWindow();
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
    preferenceWin.close();
  }
});



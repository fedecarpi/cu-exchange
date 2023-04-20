import { green, red } from 'ansicolor';
import { Tray, app, ipcMain, net, BrowserWindow, screen } from 'electron';
import * as fs from 'fs';
import { menubar } from 'menubar';
import * as path from 'path';
import { log } from 'electron-log';
const os = require('os');

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
let fetchUrl = null;

function createTrayApp() {
  //Preventing running more than one tray instance
  if (!mb) {
      let indexURL = null;

      if (serve) {
        const debug = require('electron-debug');
        require('electron-reloader')(module);
        //win.loadURL('http://localhost:4200');
        indexURL = 'http://localhost:4200';
        preferencesFilePath = path.resolve(__dirname, 'config/cu-exchange-properties.json');
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
        preferencesFilePath = path.resolve(__dirname, '../app/config/cu-exchange-properties.json');
      }

      tray = new Tray(path.resolve(__dirname, 'icons/MenuIconTemplate.png'))

      mb = menubar({
        tray,
        index: indexURL,
        showDockIcon: false,
        preloadWindow: true,
        browserWindow: {
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
      setTimeout(()=> {
        createTrayApp();
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
      if (currentPlatform == platforms.MAC) {
        app.dock.hide();
      }
    });
  }
} catch (e) {
  // Catch Error
  // throw e;
}

function getVariationAsNumber(strVariation) {
  if (strVariation) {
    return Number(strVariation.replace(',','.'));
  } else {
    return 0;
  }
}

function getJsonProperties() {
  let rawdata = fs.readFileSync(preferencesFilePath, 'utf8');
  return JSON.parse(rawdata);
}

function getSelectedCurrency() {
  let jsonProperties = getJsonProperties();  
  if (jsonProperties) {
    return jsonProperties.defaultCurrency;
  } else {
    return 'oficial';
  }
}

function getFetchURL() {
  if (!fetchUrl) {
    let json = getJsonProperties();
    fetchUrl = json.fetchUrl;
  }
  return fetchUrl;
}

function getCurrencyValues(event) {
  try {
    const req = net.request(getFetchURL());
    req.on("response", (response) => {
      const data = [];
      response.on("data", (chunk) => {
        data.push(chunk);
      })
      response.on("end", () => {
        const json = Buffer.concat(data).toString();
        if (json) {
          const jsonObj = JSON.parse(json);
          if (jsonObj) {
            var selectedCurrency = getSelectedCurrency();
            var variation = getVariationAsNumber(jsonObj[selectedCurrency]['variation']);
            tray.setToolTip(selectedCurrency);
            if (variation >= 0) {
              tray.setTitle(selectedCurrency.slice(0, 3) + ': ' + green(jsonObj[selectedCurrency]['buy'] + '↗'));
            } else {
              tray.setTitle(selectedCurrency.slice(0, 3) + ': ' + red(jsonObj[selectedCurrency]['buy'] + '↘'));
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
      })
    });
    req.end();
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
    width: size.width / 4 - 50,
    height: size.height / 3 + 70,
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



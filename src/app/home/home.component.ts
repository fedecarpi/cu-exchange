import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ElectronService } from '../core/services';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  dolData = {
    informal: {
      sell: 0,
      variation: 0,
      date: null
    },
    oficial: {
      sell: 0,
      variation: 0,
      date: null
    },
    ccl: {
      buy: 0,
      variation: 0,
      date: null
    }
  };
  loading = false;
  currencies = [];
  defaultCurrency = null;
  showCurrencies = [];

  constructor(
    private http: HttpClient, 
    private router: Router,
    private electronService: ElectronService,
    private cRef: ChangeDetectorRef) {}

  getCurrencyExchanges() {
    if (this.electronService.isElectron) {
      this.electronService.ipcRenderer.send("get-currency-values", null);
      this.loading = true;
      this.cRef.detectChanges();
    }
  }

  parseVariationToNumber(currencieData) {
    currencieData['variacion'] = Number(currencieData['variacion'].replace(',','.').replace('%', ''));
 }

 processProperties(propertiesData) {
  this.defaultCurrency = propertiesData['defaultCurrency'];
  this.currencies = propertiesData['currencies'];
  this.showCurrencies = propertiesData['showCurrencies'];
}

  setEventListener() {
    if (this.electronService.isElectron) {
      this.electronService.ipcRenderer.on('update-currency-values-ui', (event, data) => {
        //this.parseVariationToNumber(data);
        setTimeout (() => {
          this.loading = false;
          this.dolData = data;
          this.cRef.detectChanges();
        }, 400);
      });
      this.electronService.ipcRenderer.on('load-json-properties', (event, propertiesData) => {
        if (propertiesData) {
          this.processProperties(propertiesData);
        }
        this.loading = false;
        this.cRef.detectChanges();
      });
    } else {
      this.loading = false;
    }
  }

  exit() {
    if (this.electronService.isElectron) {
      this.electronService.ipcRenderer.send("close-app", null);
    }
  }

  ngOnInit(): void {
    console.log('HomeComponent INIT');
    this.setEventListener();
    this.getCurrencyExchanges();
    setInterval(() => {
      this.getCurrencyExchanges(); 
    }, 50000);
    this.electronService.ipcRenderer.send("load-preferences", null);
  }

  showPreferences() {
    if (this.electronService.isElectron) {
      this.electronService.ipcRenderer.send("show-preferences", null);
    }
  }

}

import { Component, OnInit } from '@angular/core';
import { ElectronService } from '../core/services';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-prefences',
  templateUrl: './preferences.component.html',
  styleUrls: ['./preferences.component.scss']
})
export class PreferencesComponent implements OnInit {
  loading = false;
  properties = null;
  currencies = [];
  defaultCurrency = null;
  showCurrencies = [];

  constructor(
    private electronService: ElectronService,
    private cRef: ChangeDetectorRef) { }

  getCurrencies(qs) {
    let resp = [];
    qs.forEach(element => {
      resp.push(element.name);
    });
    return resp;
  } 

  processProperties(propertiesData) {
    this.defaultCurrency = propertiesData['defaultCurrency'];
    this.currencies = this.getCurrencies(propertiesData['quotations']);
    this.showCurrencies = propertiesData['showCurrencies'];
  }

  setEventListener() {
    if (this.electronService.isElectron) {
      this.electronService.ipcRenderer.on('load-json-properties', (event, propertiesData) => {
        if (propertiesData) {
          this.processProperties(propertiesData);
        }
        this.loading = false;
        this.cRef.detectChanges();
      })
    } else {
      this.loading = false;
      this.cRef.detectChanges();
    }
  }

  isSelectedCurrency(cur) {
    const found = this.showCurrencies.find(element => element == cur);
    return (found != null);
  }

  cancel() {
    this.electronService.ipcRenderer.send("close-preference-win", null);
  }

  save() {
    this.electronService.ipcRenderer.send("save-preferences", {
      defaultCurrency: this.defaultCurrency, 
      showCurrencies: this.showCurrencies
    });
  }

  selectCurrency(value, event) {
    if (event.target.checked === true) {
      if (this.showCurrencies.length < 3) {
        this.addCurrency(value);
      } else {
        event.target.checked = false;
      }
    } else {
      this.removeCurrency(value);
    }
  }

  removeCurrency(curValue) {
    if (this.isSelectedCurrency(curValue)) {
      this.showCurrencies = this.showCurrencies.filter(e => e !== curValue);
      this.cRef.detectChanges();
    }
  }

  addCurrency(curValue) {
    if (!this.isSelectedCurrency(curValue)) {
      this.showCurrencies.push(curValue);
      this.cRef.detectChanges();
    }
  }

  ngOnInit(): void {
    this.loading = true;
    this.setEventListener();
    this.electronService.ipcRenderer.send("load-preferences", null);
    this.cRef.detectChanges();
   }

}

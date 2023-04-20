import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { PreferencesRoutingModule } from './preferences-routing.module';

import { PreferencesComponent } from './preferences.component';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  declarations: [PreferencesComponent],
  imports: [CommonModule, SharedModule, PreferencesRoutingModule]
})
export class PreferencesModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { PreferencesComponent } from './preferences.component';

const routes: Routes = [
  {
    path: 'preferences',
    component: PreferencesComponent
  }
];

@NgModule({
  declarations: [],
  imports: [CommonModule, RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PreferencesRoutingModule {}

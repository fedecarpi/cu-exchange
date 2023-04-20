import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CoreModule } from '../core/core.module';

import { HomeRoutingModule } from './home-routing.module';

import { HomeComponent } from './home.component';
import { SharedModule } from '../shared/shared.module';
import { AlertModule } from 'ngx-bootstrap/alert';

@NgModule({
  declarations: [HomeComponent],
  imports: [CommonModule, CoreModule, SharedModule, HomeRoutingModule, AlertModule.forRoot()]
})
export class HomeModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { HistoryRoutingModule } from './history-routing.module';
import { HistoryComponent } from './history.component';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  declarations: [HistoryComponent],
  imports: [CommonModule, SharedModule, HistoryRoutingModule]
})
export class HistoryModule {}

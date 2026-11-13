import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TranslateModule } from '@ngx-translate/core';

import { CurrencyCardComponent, PageNotFoundComponent, SparklineComponent } from './components/';
import { AnimatedNumberDirective, WebviewDirective } from './directives/';
import { TimeAgoPipe } from './pipes/time-ago.pipe';
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [
    PageNotFoundComponent,
    WebviewDirective,
    AnimatedNumberDirective,
    SparklineComponent,
    CurrencyCardComponent,
    TimeAgoPipe
  ],
  imports: [CommonModule, TranslateModule, FormsModule],
  exports: [
    TranslateModule,
    WebviewDirective,
    FormsModule,
    AnimatedNumberDirective,
    SparklineComponent,
    CurrencyCardComponent,
    TimeAgoPipe
  ]
})
export class SharedModule {}

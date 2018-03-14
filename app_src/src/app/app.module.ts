import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { MatIconRegistry } from '@angular/material';

import { MaterialModule } from './material';
import { SearchModule } from './search';

import { AppComponent } from './app.component';


@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    CommonModule,
    MaterialModule,
    HttpClientModule,

    SearchModule
  ],
  exports: [
    MaterialModule,
    HttpClientModule
  ],
  providers: [
      MatIconRegistry
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
    constructor(public iconRegistry:MatIconRegistry) {
        iconRegistry.registerFontClassAlias('fontawesome', 'fa');
        //console.log('default font class',iconRegistry.getDefaultFontSetClass());
        iconRegistry.setDefaultFontSetClass('fa');
    }
}
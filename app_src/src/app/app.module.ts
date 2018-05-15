import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import {HashLocationStrategy, Location, LocationStrategy} from '@angular/common';
import { AgmCoreModule } from '@agm/core';

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
    AgmCoreModule.forRoot({
        apiKey: 'AIzaSyBGz5D-zS4gcVsJYBpYc6tEMO-supU5Y3Y',
        //libraries: ['drawing']
    }),
    SearchModule
  ],
  exports: [
    MaterialModule,
    HttpClientModule,
    AgmCoreModule
  ],
  providers: [
      MatIconRegistry,
      Location,
      {provide: LocationStrategy, useClass: HashLocationStrategy}
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

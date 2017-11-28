import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { FlexLayoutModule } from '@angular/flex-layout';

// angular material
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatSidenavModule } from '@angular/material';
import 'hammerjs'; // for angular-material

// app imports
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { StylePreviewModule } from './style_preview';
import { NavComponentsModule } from './nav_components';

import { DashboardComponentsModule } from './routes/dashboard';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FlexLayoutModule,
    // material
    MatSidenavModule,
    // app imports
    AppRoutingModule,
    StylePreviewModule,
    NavComponentsModule,
    // route modules
    DashboardComponentsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }

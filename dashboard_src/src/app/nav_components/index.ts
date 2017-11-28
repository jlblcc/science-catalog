import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';

import { NavbarComponent } from './navbar/navbar.component';
import { SidebarComponent } from './sidebar/sidebar.component';

import { MatToolbarModule, MatButtonModule } from '@angular/material';

@NgModule({
    imports: [
        BrowserModule,
        RouterModule,
        MatToolbarModule,
        MatButtonModule
    ],
    declarations: [
        NavbarComponent,
        SidebarComponent
    ],
    exports: [
        NavbarComponent,
        SidebarComponent
    ]
})
export class NavComponentsModule {}

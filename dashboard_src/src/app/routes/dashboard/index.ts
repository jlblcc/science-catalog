import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatTableModule, MatSortModule } from '@angular/material';

import { ProvidersModule } from '../../providers';

import { LccTableComponent } from './lcc-table.component';
import { DashboardComponent } from './dashboard.component';

@NgModule({
    imports:[
        CommonModule,
        MatTableModule,
        MatSortModule,
        ProvidersModule
    ],
    declarations:[
        LccTableComponent,
        DashboardComponent,
    ],
    exports: [
        LccTableComponent,
        DashboardComponent
    ]
})
export class DashboardComponentsModule {}

export {DashboardComponent} from './dashboard.component';

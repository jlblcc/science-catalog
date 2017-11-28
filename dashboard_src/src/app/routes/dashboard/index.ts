import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatTableModule, MatSortModule, MatCardModule } from '@angular/material';

import { ProvidersModule } from '../../providers';
import { CommonComponentsModule } from '../../common_components';

import { LccTableComponent } from './lcc-table.component';
import { DashboardComponent } from './dashboard.component';

@NgModule({
    imports:[
        CommonModule,
        MatTableModule,
        MatSortModule,
        MatCardModule,
        ProvidersModule,
        CommonComponentsModule
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

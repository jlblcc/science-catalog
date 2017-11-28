import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import {MatCardModule} from '@angular/material';

import { ProvidersModule } from '../providers';

import { ProjectStatusReportComponent } from './project-status-report.component';

@NgModule({
    imports: [
        CommonModule,
        MatCardModule,
        ProvidersModule
    ],
    declarations: [
        ProjectStatusReportComponent
    ],
    exports: [
        ProjectStatusReportComponent
    ]
})
export class CommonComponentsModule {

}

//export { ProjectStatusReportComponent } from './project-status-report.component';

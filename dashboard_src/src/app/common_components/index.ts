import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { MatTableModule, MatCardModule } from '@angular/material';

import { ProvidersModule } from '../providers';

import { ProjectStatusReportComponent } from './project-status-report.component';
import { ProjectFundingReportComponent } from './project-funding-report.component';

@NgModule({
    imports: [
        CommonModule,
        MatCardModule,
        MatTableModule,
        ProvidersModule
    ],
    declarations: [
        ProjectStatusReportComponent,
        ProjectFundingReportComponent
    ],
    exports: [
        ProjectStatusReportComponent,
        ProjectFundingReportComponent
    ]
})
export class CommonComponentsModule {

}

//export { ProjectStatusReportComponent } from './project-status-report.component';

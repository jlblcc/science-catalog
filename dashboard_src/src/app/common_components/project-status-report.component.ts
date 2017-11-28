import { Component, Input } from '@angular/core';

import 'rxjs/add/operator/toPromise';

import { CatalogService } from '../providers';

@Component({
    selector: 'project-status-report',
    template: `
    <mat-card>
        <mat-card-title>Project Status Report</mat-card-title>
        <mat-card-subtitle *ngIf="!lccId">LCC Network wide</mat-card-subtitle>
        <mat-card-content>
            <ul *ngIf="report">
                <li *ngFor="let key of reportKeys"><label>{{key}}:</label> {{report[key]}}</li>
            </ul>
        </mat-card-content>
    </mat-card>
    `,
    styles:[`
        ul {
            list-style: none;
            padding: 0px;
        }
        li>label {
            font-weight: bold;
        }
    `]
})
export class ProjectStatusReportComponent {
    @Input()
    lccId:string;
    reportKeys:string[];
    report:any;

    constructor(private catalog:CatalogService) {}

    ngOnInit() {
        this.report = this.catalog.projectStatusReport(this.lccId).toPromise()
            .then(report => {
                this.reportKeys = Object.keys(report);
                this.report = report
            })
            .catch(e => console.error(e));
    }
}

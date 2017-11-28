import { Component, Input } from '@angular/core';

import 'rxjs/add/operator/toPromise';

import { CatalogService, LCC } from '../providers';

@Component({
    selector: 'project-status-report',
    template: `
    <mat-card>
        <mat-card-title>Project Status Report</mat-card-title>
        <mat-card-subtitle *ngIf="!lccId">LCC Network wide</mat-card-subtitle>
        <mat-card-subtitle *ngIf="lcc">{{lcc.title}}</mat-card-subtitle>
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
    lcc:LCC;
    reportKeys:string[];
    report:any;

    constructor(private catalog:CatalogService) {}

    ngOnInit() {
        let handleError = (e) => console.error(e);
        this.report = this.catalog.projectStatusReport(this.lccId).toPromise()
            .then(report => {
                this.reportKeys = Object.keys(report);
                this.report = report
            })
            .catch(handleError);
        if(this.lccId) {
            this.catalog.lcc(this.lccId)
                .then(lcc => this.lcc = lcc)
                .catch(handleError);
        }
    }
}

import { Component, Input } from '@angular/core';
import {DataSource} from '@angular/cdk/collections';
import {Observable} from 'rxjs/Observable';
import 'rxjs/add/observable/of';
import 'rxjs/add/operator/toPromise';

import { CatalogService, LCC } from '../providers';

@Component({
    selector: 'project-funding-report',
    template: `
    <mat-card>
        <mat-card-title>Project Funding Report</mat-card-title>
        <mat-card-subtitle>
        <span *ngIf="!lccId">LCC Network wide</span>
        <span *ngIf="lcc">{{lcc.title}}</span>
        ({{totalFunding | currency}})
        </mat-card-subtitle>
        <mat-card-content>
            <mat-table #table *ngIf="dataSource" [dataSource]="dataSource" matSort>
              <ng-container matColumnDef="name">
                <mat-header-cell *matHeaderCellDef mat-sort-header> Source </mat-header-cell>
                <mat-cell *matCellDef="let row"> {{row.name}}</mat-cell>
              </ng-container>

              <ng-container matColumnDef="allocations">
                <mat-header-cell *matHeaderCellDef mat-sort-header> Allocations </mat-header-cell>
                <mat-cell *matCellDef="let row"> {{row.allocations}}</mat-cell>
              </ng-container>

              <ng-container matColumnDef="total">
                <mat-header-cell *matHeaderCellDef mat-sort-header> Total </mat-header-cell>
                <mat-cell *matCellDef="let row"> {{row.total | currency}}</mat-cell>
              </ng-container>

              <mat-header-row *matHeaderRowDef="displayedColumns"></mat-header-row>
              <mat-row *matRowDef="let row; columns: displayedColumns;"></mat-row>
            </mat-table>
        </mat-card-content>
    </mat-card>
    `,
    styles:[`
        :host {
            flex-basis: 100%;
        }
        ul {
            list-style: none;
            padding: 0px;
        }
        li>label {
            font-weight: bold;
        }
        mat-card-content {
            max-height: 500px;
            overflow-y: auto;
        }
    `]
})
export class ProjectFundingReportComponent {
    @Input()
    lccId:string;
    lcc:LCC;
    report:any;
    totalFunding:number;
    dataSource:FundingReportDataSource;

    displayedColumns = ['name','allocations','total'];

    constructor(private catalog:CatalogService) {}

    ngOnInit() {
        let handleError = (e) => console.error(e);
        this.report = this.catalog.projectFundingReport(this.lccId).toPromise()
            .then(report => {
                this.report = report.map(row => {
                    row = row.value;
                    return {
                        name: row.contact.name,
                        allocations: row.allocations.length,
                        total: row.total
                    };
                });
                this.report.sort((a,b) => b.total - a.total);
                this.totalFunding = this.report.reduce((sum,row) => sum+row.total,0);
                this.dataSource = new FundingReportDataSource(this.report);
                console.log('totalFunding',this.totalFunding);
            })
            .catch(handleError);
        if(this.lccId) {
            this.catalog.lcc(this.lccId)
                .then(lcc => this.lcc = lcc)
                .catch(handleError);
        }
    }
}

export class FundingReportDataSource extends DataSource<any> {
    constructor(private data:any) {
        super();
    }

    connect(): Observable<any[]> {
        return Observable.of(this.data);
    }

    disconnect() {}
}

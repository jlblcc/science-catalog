import { Component, Input, SimpleChanges } from '@angular/core';

import { Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { SearchService } from './search.service';
import { MonitorsDestroy } from '../common';

@Component({
    selector: 'funds-by-year',
    template: `
    <div class="sum-line" *ngIf="years?.length">
        <span class="mat-subheading-2">{{title}}</span>
        <div class="sum-grid">
            <div *ngFor="let year of years">
                <span class="mat-subheading-1">{{year === 999 ? 'Unspecified' : year}}</span> \${{map[year] | number:'1.2-2'}}
            </div>
        </div>
    </div>
    `
})
export class FundsByYear {
    @Input() title:string;
    @Input() funds:any;
    years;
    map;

    ngOnChanges(changes:SimpleChanges) {
        if(changes.funds.currentValue) {
            setTimeout(() => {
                this.map = this.funds.reduce((map,f) => {
                        map[f.key] = f.value;
                        return map;
                    },{})
                this.years = this.funds.map(f => parseInt(f.key)).sort((a,b) => b-a); // keys are years, sort numerically
            });
        }
    }
}

@Component({
    selector: 'summary-statistics',
    template: `
    <div class="stats-running-shade" *ngIf="search.summaryRunning">
        <mat-spinner></mat-spinner>
    </div>
    <mat-tab-group *ngIf="data">

        <mat-tab label="General">
            <div class="sum-line inline" *ngIf="data.projectCount || data.productCount">
                <div *ngIf="data.projectCount"><span class="mat-subheading-2">Number of Projects</span>{{data.projectCount}}</div>
                <div *ngIf="data.productCount"><span class="mat-subheading-2">Number of Products</span> {{data.productCount}}</div>
            </div>
            <div class="sum-line" *ngIf="data.projectsByProjectCategory">
                <span class="mat-subheading-2">Projects by Category</span>
                <div class="sum-grid">
                    <div *ngFor="let d of data.projectsByProjectCategory"><span class="mat-subheading-1">{{d.key}}</span> {{d.value}}</div>
                </div>
            </div>
            <div class="sum-line" *ngIf="data.productsByResourceType">
                <span class="mat-subheading-2">Products by Resource Type</span>
                <div class="sum-grid">
                    <div *ngFor="let d of data.productsByResourceType"><span class="mat-subheading-1">{{d.key | resourceType}}</span> {{d.value}}</div>
                </div>
            </div>
        </mat-tab>

        <mat-tab label="Agency Funds" *ngIf="data.agencyFundsTotal || data.agencyFundsBySourceType">
            <div class="sum-line inline">
                <div><span class="mat-subheading-2">Total Funds</span> \${{data.totalFunds | number:'1.2-2'}}</div>
                <div><span class="mat-subheading-2">Agency Funds</span> \${{data.agencyFundsTotal | number:'1.2-2'}}</div>
                <div><span class="mat-subheading-2">Matching/In-kind Funds</span> \${{data.matchingFundsTotal | number:'1.2-2'}}</div>
            </div>
            <div class="sum-line">
                <div><span class="mat-subheading-2">Number of Funding Recipients</span> {{data.agencyFundsRecipientCount}}</div>
            </div>
            <funds-by-year [funds]="data.agencyFundsByFiscalYear" title="Agency Funds by Year"></funds-by-year>
            <div class="sum-line" *ngIf="data.agencyFundsByRecipientType">
                <span class="mat-subheading-2">Agency Funds by Recipient Type</span>
                <div class="sum-grid">
                    <div *ngFor="let d of data.agencyFundsByRecipientType"><span class="mat-subheading-1">{{d.key | collaborator}}</span> \${{d.value | number:'1.2-2'}}</div>
                </div>
            </div>
            <div class="sum-line" *ngIf="data.agencyFundsBySourceType">
                <span class="mat-subheading-2">Agency Funds by Source Type</span>
                <div class="sum-grid">
                    <div *ngFor="let d of data.agencyFundsBySourceType"><span class="mat-subheading-1">{{d.key | collaborator}}</span> \${{d.value | number:'1.2-2'}}</div>
                </div>
            </div>
        </mat-tab>

        <mat-tab label="Matching/In-kind Funds" *ngIf="data.matchingFundsTotal || data.matchingFundsSourceCount || data.matchingFundsBySourceType">
            <div class="sum-line inline">
                <div><span class="mat-subheading-2">Total Funds</span> \${{data.totalFunds | number:'1.2-2'}}</div>
                <div><span class="mat-subheading-2">Agency Funds</span> \${{data.agencyFundsTotal | number:'1.2-2'}}</div>
                <div><span class="mat-subheading-2">Matching/In-kind Funds</span> \${{data.matchingFundsTotal | number:'1.2-2'}}</div>
            </div>
            <div class="sum-line">
                <div><span class="mat-subheading-2">Number of Organizations Providing Matching Contributions</span> {{data.matchingFundsSourceCount}}</div>
            </div>
            <funds-by-year [funds]="data.matchingFundsByFiscalYear" title="Matching Funds by Year"></funds-by-year>
            <div class="sum-line" *ngIf="data.matchingFundsBySourceType">
                <span class="mat-subheading-2">Matching Funds by Source Type</span>
                <div class="sum-grid">
                    <div *ngFor="let d of data.matchingFundsBySourceType"><span class="mat-subheading-1">{{d.key | collaborator}}</span> \${{d.value | number:'1.2-2'}}</div>
                </div>
            </div>
        </mat-tab>

        <mat-tab label="Collaborators" *ngIf="data.uniqueCollaboratorsByOrgType">
            <div class="sum-line">
                <span class="mat-subheading-2">Unique Collaborators by Organization Type</span>
                <div class="sum-grid">
                    <div *ngFor="let d of data.uniqueCollaboratorsByOrgType"><span class="mat-subheading-1">{{d.key | collaborator}}</span> {{d.value}}</div>
                </div>
            </div>
        </mat-tab>
    </mat-tab-group>
    `
})
export class SummaryStatistics extends MonitorsDestroy {
    data:any = null;

    constructor(public search:SearchService) {
        super();
    }

    ngOnInit() {
        this.search.summaryStatistics()
            .pipe(
                takeUntil(this.componentDestroyed)
            )
            .subscribe(stats => this.data = stats);
    }
}

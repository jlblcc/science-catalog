import { Component, Input, SimpleChanges } from '@angular/core';

import { Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { SearchService } from './search.service';
import { MonitorsDestroy } from '../common';

@Component({
    selector: 'funds-by-year',
    template: `
    <div class="sum-line" *ngIf="years?.length">
        <span class="mat-subheading-2">Funds by year</span>
        <div class="sum-grid">
            <div *ngFor="let year of years">
                <span class="mat-subheading-1">{{year === 999 ? 'Unspecified' : year}}</span> \${{map[year] | number:'1.2-2'}}
            </div>
        </div>
    </div>
    `
})
export class FundsByYear {
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
                <div *ngIf="data.projectCount"><span class="mat-subheading-2">Number of projects</span>{{data.projectCount}}</div>
                <div *ngIf="data.productCount"><span class="mat-subheading-2">Number of products</span> {{data.productCount}}</div>
            </div>
            <div class="sum-line" *ngIf="data.projectsByProjectCategory">
                <span class="mat-subheading-2">Projects by category</span>
                <div class="sum-grid">
                    <div *ngFor="let d of data.projectsByProjectCategory"><span class="mat-subheading-1">{{d.key}}</span> {{d.value}}</div>
                </div>
            </div>
            <div class="sum-line" *ngIf="data.productsByResourceType">
                <span class="mat-subheading-2">Products by resource type</span>
                <div class="sum-grid">
                    <div *ngFor="let d of data.productsByResourceType"><span class="mat-subheading-1">{{d.key | resourceType}}</span> {{d.value}}</div>
                </div>
            </div>
        </mat-tab>

        <mat-tab label="Agency funding" *ngIf="data.agencyFundsTotal || data.agencyFundsBySourceType">
            <div class="sum-line inline">
                <div><span class="mat-subheading-2">Sources providing agency funds</span> {{data.agencyFundsSourceCount}}</div>
                <div><span class="mat-subheading-2">Total funds</span> \${{data.agencyFundsTotal | number:'1.2-2'}} / \${{data.totalFunds | number:'1.2-2'}}</div>
            </div>
            <funds-by-year [funds]="data.agencyFundsByFiscalYear"></funds-by-year>
            <div class="sum-line" *ngIf="data.agencyFundsByRecipientType">
                <span class="mat-subheading-2">Funds by recipient type</span>
                <div class="sum-grid">
                    <div *ngFor="let d of data.agencyFundsByRecipientType"><span class="mat-subheading-1">{{d.key | collaborator}}</span> \${{d.value | number:'1.2-2'}}</div>
                </div>
            </div>
            <div class="sum-line" *ngIf="data.agencyFundsBySourceType">
                <span class="mat-subheading-2">Funds by source type</span>
                <div class="sum-grid">
                    <div *ngFor="let d of data.agencyFundsBySourceType"><span class="mat-subheading-1">{{d.key | collaborator}}</span> \${{d.value | number:'1.2-2'}}</div>
                </div>
            </div>
        </mat-tab>

        <mat-tab label="Matching contributions" *ngIf="data.matchingFundsTotal || data.matchingFundsSourceCount || data.matchingFundsBySourceType">
            <div class="sum-line inline">
                <div><span class="mat-subheading-2">Organizations providing matching contributions</span> {{data.matchingFundsSourceCount}}</div>
                <div><span class="mat-subheading-2">Total funds</span> \${{data.matchingFundsTotal | number:'1.2-2'}} / \${{data.totalFunds | number:'1.2-2'}}</div>
            </div>
            <funds-by-year [funds]="data.matchingFundsByFiscalYear"></funds-by-year>
            <div class="sum-line" *ngIf="data.matchingFundsBySourceType">
                <span class="mat-subheading-2">Matching contributions by organization type</span>
                <div class="sum-grid">
                    <div *ngFor="let d of data.matchingFundsBySourceType"><span class="mat-subheading-1">{{d.key | collaborator}}</span> \${{d.value | number:'1.2-2'}}</div>
                </div>
            </div>
        </mat-tab>

        <mat-tab label="Collaborators" *ngIf="data.uniqueCollaboratorsByOrgType">
            <div class="sum-line">
                <span class="mat-subheading-2">Unique collaborators by org type</span>
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

    constructor(private search:SearchService) {
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

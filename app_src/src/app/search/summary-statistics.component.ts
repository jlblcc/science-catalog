import { Component } from '@angular/core';

import { Observable } from 'rxjs/Observable';
import { takeUntil } from 'rxjs/operators';

import { SearchService } from './search.service';
import { MonitorsDestroy } from '../common';

@Component({
    selector: 'summary-statistics',
    template: `
    <mat-tab-group *ngIf="data">
        <mat-tab label="General">
            <div class="sum-line" *ngIf="data.projectsInLastMonth"><label>Projects in the last month</label> {{data.projectsInLastMonth}}</div>
            <div class="sum-line" *ngIf="data.productsInLastMonth"><label>Products in the last month</label> {{data.productsInLastMonth}}</div>
            <div class="sum-line" *ngIf="data.projectsByResourceType">
                <label>Projects by resource type</label>
                <div class="sum-grid">
                    <div *ngFor="let d of data.projectsByResourceType"><label>{{d.key | resourceType}}</label> {{d.value}}</div>
                </div>
            </div>
            <div class="sum-line" *ngIf="data.productsByResourceType">
                <label>Products by resource type</label>
                <div class="sum-grid">
                    <div *ngFor="let d of data.productsByResourceType"><label>{{d.key | resourceType}}</label> {{d.value}}</div>
                </div>
            </div>
        </mat-tab>
        <mat-tab label="Funds">
            <div class="sum-line"><label>Total funds</label> \${{data.fundingTotal | number:'1.2-2'}}</div>
            <div class="sum-line" *ngIf="data.fundsBySourceType">
                <label>Funds by source type</label>
                <div class="sum-grid">
                    <div *ngFor="let d of data.fundsBySourceType"><label>{{d.key | resourceType}}</label> \${{d.value | number:'1.2-2'}}</div>
                </div>
            </div>
            <div class="sum-line" *ngIf="data.fundsByRecipientType">
                <label>Funds by recipient type</label>
                <div class="sum-grid">
                    <div *ngFor="let d of data.fundsByRecipientType"><label>{{d.key | resourceType}}</label> \${{d.value | number:'1.2-2'}}</div>
                </div>
            </div>
        </mat-tab>
        <mat-tab label="Matching contributions" *ngIf="data.orgsProvidingInKindMatch || data.matchingContributionsByOrgType">
            <div class="sum-line"><label>Organizations providing matching contributions</label> {{data.orgsProvidingInKindMatch}}</div>
            <div class="sum-line" *ngIf="data.matchingContributionsByOrgType">
                <label>Matching contributions by organization type</label>
                <div class="sum-grid">
                    <div *ngFor="let d of data.matchingContributionsByOrgType"><label>{{d.key | resourceType}}</label> \${{d.value | number:'1.2-2'}}</div>
                </div>
            </div>
        </mat-tab>
        <mat-tab label="Collaborators" *ngIf="data.uniqueCollaboratorsByOrgType">
            <div class="sum-line">
                <label>Unique collaborators by org type</label>
                <div class="sum-grid">
                    <div *ngFor="let d of data.uniqueCollaboratorsByOrgType"><label>{{d.key | resourceType}}</label> {{d.value}}</div>
                </div>
            </div>
        </mat-tab>
    </mat-tab-group>
    `,
    styles:[`
        .sum-line {
            margin:5px;
        }
        .sum-line label {
            font-weight: bold;
            display: block;
            margin-bottom: 5px;
        }
        .sum-line ul {
            list-style: none;
        }
        .cols {
            display: flex;
            flex-wrap: wrap;
        }
        .sum-grid {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            border-top: 1px solid #aaa;
        }
        /* TODO adaptive layout */
        .sum-grid > * {
            flex-basis: 22%;
            padding: 5px;
        }
    `]
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

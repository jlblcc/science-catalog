import { Component } from '@angular/core';

import { Observable } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { SearchService } from './search.service';
import { MonitorsDestroy } from '../common';

@Component({
    selector: 'summary-statistics',
    template: `
    <mat-tab-group *ngIf="data">
        <mat-tab label="General">
            <div class="sum-line" *ngIf="data.projectsInLastMonth"><span class="mat-subheading-2">Projects in the last month</span>{{data.projectsInLastMonth}}
            </div>
            <div class="sum-line" *ngIf="data.productsInLastMonth"><span class="mat-subheading-2">Products in the last month</span> {{data.productsInLastMonth}}</div>
            <div class="sum-line" *ngIf="data.projectsByResourceType">
                <span class="mat-subheading-2">Projects by resource type</span>
                <div class="sum-grid">
                    <div *ngFor="let d of data.projectsByResourceType"><span class="mat-subheading-1">{{d.key | resourceType}}</span> {{d.value}}</div>
                </div>
            </div>
            <div class="sum-line" *ngIf="data.productsByResourceType">
                <span class="mat-subheading-2">Products by resource type</span>
                <div class="sum-grid">
                    <div *ngFor="let d of data.productsByResourceType"><span class="mat-subheading-1">{{d.key | resourceType}}</span> {{d.value}}</div>
                </div>
            </div>
        </mat-tab>
        <mat-tab label="Funds" *ngIf="data.fundingTotal || data.fundsBySourceType">
            <div class="sum-line"><span class="mat-subheading-2">Total funds</span> \${{data.fundingTotal | number:'1.2-2'}}</div>
            <div class="sum-line" *ngIf="data.fundsBySourceType">
                <span class="mat-subheading-2">Funds by source type</span>
                <div class="sum-grid">
                    <div *ngFor="let d of data.fundsBySourceType"><span class="mat-subheading-1">{{d.key | resourceType}}</span> \${{d.value | number:'1.2-2'}}</div>
                </div>
            </div>
            <div class="sum-line" *ngIf="data.fundsByRecipientType">
                <span class="mat-subheading-2">Funds by recipient type</span>
                <div class="sum-grid">
                    <div *ngFor="let d of data.fundsByRecipientType"><span class="mat-subheading-1">{{d.key | resourceType}}</span> \${{d.value | number:'1.2-2'}}</div>
                </div>
            </div>
        </mat-tab>
        <mat-tab label="Matching contributions" *ngIf="data.orgsProvidingInKindMatch || data.matchingContributionsByOrgType">
            <div class="sum-line"><span class="mat-subheading-2">Organizations providing matching contributions</span> {{data.orgsProvidingInKindMatch}}</div>
            <div class="sum-line" *ngIf="data.matchingContributionsByOrgType">
                <span class="mat-subheading-2">Matching contributions by organization type</span>
                <div class="sum-grid">
                    <div *ngFor="let d of data.matchingContributionsByOrgType"><span class="mat-subheading-1">{{d.key | resourceType}}</span> \${{d.value | number:'1.2-2'}}</div>
                </div>
            </div>
        </mat-tab>
        <mat-tab label="Collaborators" *ngIf="data.uniqueCollaboratorsByOrgType">
            <div class="sum-line">
                <span class="mat-subheading-2">Unique collaborators by org type</span>
                <div class="sum-grid">
                    <div *ngFor="let d of data.uniqueCollaboratorsByOrgType"><span class="mat-subheading-1">{{d.key | resourceType}}</span> {{d.value}}</div>
                </div>
            </div>
        </mat-tab>
    </mat-tab-group>
    `,
    styles:[`
        .sum-line {
            margin:5px;
        }
        .mat-subheading-1,
        .mat-subheading-2 {
            display: block;
            margin-bottom: 0px;
        }
        .mat-subheading-2 {
            font-weight: 500;
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

import { Component, Input } from '@angular/core';

@Component({
    selector: 'item-teaser',
    template: `
    <mat-card>
        <mat-card-title class="item-title">
            <item-icon [item]="item"></item-icon>
            <item-link [item]="item" [highlight]="highlight"></item-link>
            <lcc-list [item]="item"></lcc-list>
        </mat-card-title>
        <mat-card-subtitle>
            <span *ngIf="item.simplified.responsibleParty?.principalInvestigator"><label>Principal Investigator:</label> <principal-investigators [item]="item" [highlight]="highlight"></principal-investigators></span>
            <span *ngIf="item.simplified.funding && item.simplified.funding.fiscalYears.length"><label>Years funded:</label>{{item.simplified.funding.fiscalYears.join(', ')}}</span>
            <span *ngIf="item.simplified.dates && item.simplified.dates.sort"><label>Date:</label> <item-date [item]="item"></item-date></span>
        </mat-card-subtitle>
        <mat-card-content>
            <highlight-text [text]="item.simplified.abstract" [highlight]="highlight"></highlight-text>
        </mat-card-content>
    </mat-card>
    `,
    styles:[`
        mat-card {
            margin-bottom: 10px;
        }
        mat-card .mat-card-title {
            font-size: 1.1em;
        }
        mat-card-subtitle label {
            font-weight: bold;
            margin-left: 10px;
            margin-right: 3px;
        }
        item-icon {
            font-size: 0.75em;
        }
    `]
})
export class ItemTeaser {
    @Input() item:any;
    @Input() highlight:string[];
}

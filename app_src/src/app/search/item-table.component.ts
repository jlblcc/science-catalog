import { Component, Input, ViewChild } from '@angular/core';

import { MatSort, Sort } from '@angular/material';

export const DEFAULT_SORT_DIRECTION = 'desc';
export const DEFAULT_ACTIVE_SORT = 'simplified.dates.sort';
export const TABLE_COLUMNS = [{
    property: 'simplified.dates.sort',
    label: 'Date'
},{
    property: 'simplified.combinedResourceType',
    label: 'Resource type'
},{
    property: 'simplified.title',
    label: 'Title'
},{
    property: 'simplified.lcc',
    label: 'LCC'
},{
    property: 'simplified.responsibleParty.principalInvestigator.name',
    label: 'Principal investigator'
},{
    property: 'simplified.funding.fiscalYears',
    label: 'Fiscal year(s)'
}];

/**
 * Display search results in a table.
 */
@Component({
    selector: 'item-table',
    template: `
    <mat-table [dataSource]="dataSource" matSort>
        <ng-container matColumnDef="simplified.dates.sort">
            <mat-header-cell *matHeaderCellDef mat-sort-header disableClear="true" class="item-date"> Date </mat-header-cell>
            <mat-cell *matCellDef="let item" class="item-date"><item-date [item]="item"></item-date></mat-cell>
        </ng-container>

        <ng-container matColumnDef="simplified.combinedResourceType">
            <mat-header-cell *matHeaderCellDef mat-sort-header disableClear="true" class="item-type"> Resource type </mat-header-cell>
            <mat-cell *matCellDef="let item" class="item-type"><item-icon [item]="item"></item-icon></mat-cell>
        </ng-container>

        <ng-container matColumnDef="simplified.title">
            <mat-header-cell *matHeaderCellDef mat-sort-header disableClear="true" class="item-title"> Title </mat-header-cell>
            <mat-cell *matCellDef="let item" class="item-title"><item-link [item]="item" [highlight]="highlight"></item-link></mat-cell>
        </ng-container>

        <ng-container matColumnDef="simplified.lcc">
            <mat-header-cell *matHeaderCellDef mat-sort-header  disableClear="true" class="item-lcc"> LCC </mat-header-cell>
            <mat-cell *matCellDef="let item" class="item-lcc">{{item.simplified.lcc | lccTitle}}</mat-cell>
        </ng-container>

        <ng-container matColumnDef="simplified.responsibleParty.principalInvestigator.name">
            <mat-header-cell *matHeaderCellDef mat-sort-header  disableClear="true" class="item-pi"> Principal investigator </mat-header-cell>
            <mat-cell *matCellDef="let item" class="item-pi"><principal-investigators [item]="item" [highlight]="highlight"></principal-investigators></mat-cell>
        </ng-container>

        <ng-container matColumnDef="simplified.funding.fiscalYears">
            <mat-header-cell *matHeaderCellDef mat-sort-header  disableClear="true" class="item-fiscal"> Fiscal year(s) </mat-header-cell>
            <mat-cell *matCellDef="let item" class="item-fiscal">{{item.simplified.funding ? item.simplified.funding.fiscalYears.join(', ') : ''}}</mat-cell>
        </ng-container>

        <mat-header-row *matHeaderRowDef="displayedColumns"></mat-header-row>
        <mat-row *matRowDef="let row; columns: displayedColumns;"></mat-row>
    </mat-table>
    `,
    styles:[`
        .item-date {
            flex-grow: 0.8;
        }
        .item-type {
            flex-grow: 0.9;
        }
        .item-fiscal {
            flex-grow: 0.8;
        }
        .item-title {
            flex-grow: 3;
        }
        .item-pi {
            flex-grow: 2;
        }
        .item-lcc {
            flex-grow: 1.5;
        }
        .item-title {
            padding-left: 4px;
            padding-right: 2px;
        }
        .item-lcc {
            padding-left: 2px;
            padding-right: 4px;
        }
    `]
})
export class ItemTable {
    displayedColumns = TABLE_COLUMNS.map(c => c.property);
    @Input() highlight:string[];
    @Input() dataSource;

    @ViewChild(MatSort) sort:MatSort;

    ngOnInit() {
        this.sort.active = DEFAULT_ACTIVE_SORT;
        this.sort.direction = DEFAULT_SORT_DIRECTION;
    }
}

import { Component, Input, ViewChild } from '@angular/core';

import { MatSort, Sort } from '@angular/material';

export const DEFAULT_SORT_DIRECTION = 'asc';
export const DEFAULT_ACTIVE_SORT = 'simplified.title';
export const TABLE_COLUMNS = [{
    property: 'simplified.resourceType',
    label: 'Resource type'
},{
    property: 'simplified.title',
    label: 'Title'
},{
    property: 'simplified.lcc',
    label: 'LCC'
},{
    property: 'simplified.pointOfContact.principalInvestigator.name',
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
        <ng-container matColumnDef="simplified.resourceType">
            <mat-header-cell *matHeaderCellDef mat-sort-header disableClear="true" class="item-type"> Resource type </mat-header-cell>
            <mat-cell *matCellDef="let item"><item-icon [item]="item" class="item-type"></item-icon></mat-cell>
        </ng-container>

        <ng-container matColumnDef="simplified.title">
            <mat-header-cell *matHeaderCellDef mat-sort-header disableClear="true" class="item-title"> Title </mat-header-cell>
            <mat-cell *matCellDef="let item" class="item-title"><a target="_blank"[href]="'https://www.sciencebase.gov/catalog/item/'+item._id"><highlight-text [text]="item.simplified.title" [highlight]="highlight"></highlight-text></a></mat-cell>
        </ng-container>

        <ng-container matColumnDef="simplified.lcc">
            <mat-header-cell *matHeaderCellDef mat-sort-header  disableClear="true" class="item-lcc"> LCC </mat-header-cell>
            <mat-cell *matCellDef="let item" class="item-lcc">{{item.simplified.lcc | lccTitle}}</mat-cell>
        </ng-container>

        <ng-container matColumnDef="simplified.pointOfContact.principalInvestigator.name">
            <mat-header-cell *matHeaderCellDef mat-sort-header  disableClear="true" class="item-pi"> Principal investigator </mat-header-cell>
            <mat-cell *matCellDef="let item" class="item-pi">{{item.simplified.pointOfContact.principalInvestigator ? item.simplified.pointOfContact.principalInvestigator[0].name : ''}}</mat-cell>
        </ng-container>

        <ng-container matColumnDef="simplified.funding.fiscalYears">
            <mat-header-cell *matHeaderCellDef mat-sort-header  disableClear="true" class="item-fiscal"> Fiscal year(s) </mat-header-cell>
            <mat-cell *matCellDef="let item" class="item-pi">{{item.simplified.funding ? item.simplified.funding.fiscalYears.join(', ') : ''}}</mat-cell>
        </ng-container>

        <mat-header-row *matHeaderRowDef="displayedColumns"></mat-header-row>
        <mat-row *matRowDef="let row; columns: displayedColumns;"></mat-row>
    </mat-table>
    `,
    styles:[`
        .item-type,
        .item-fiscal {
            flex-grow: 1;
        }
        .item-title {
            flex-grow: 3;
        }
        .item-pi,
        .item-lcc {
            flex-grow: 2;
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

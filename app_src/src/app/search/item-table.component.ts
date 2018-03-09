import { Component, Input, ViewChild } from '@angular/core';

import { MatSort, Sort } from '@angular/material';

export const DEFAULT_SORT_DIRECTION = 'asc';
export const DEFAULT_ACTIVE_SORT = 'simplified.title';
export const TABLE_COLUMNS = [{
    property: 'simplified.title',
    label: 'Title'
},{
    property: 'simplified.lcc',
    label: 'LCC'
},{
    property: 'simplified.contacts.principalInvestigator.name',
    label: 'Principal Investigator'
}];

/**
 * Display search results in a table.
 */
@Component({
    selector: 'item-table',
    template: `
    <mat-table [dataSource]="dataSource" matSort>
        <ng-container matColumnDef="simplified.title">
            <mat-header-cell *matHeaderCellDef mat-sort-header disableClear="true"> Title </mat-header-cell>
            <mat-cell *matCellDef="let item"><highlight-text [text]="item.simplified.title" [highlight]="highlight"></highlight-text></mat-cell>
        </ng-container>

        <ng-container matColumnDef="simplified.lcc">
            <mat-header-cell *matHeaderCellDef mat-sort-header  disableClear="true"> LCC </mat-header-cell>
            <mat-cell *matCellDef="let item">{{item.simplified.lcc | lccTitle}}</mat-cell>
        </ng-container>

        <ng-container matColumnDef="simplified.contacts.principalInvestigator.name">
            <mat-header-cell *matHeaderCellDef mat-sort-header  disableClear="true"> Principal Investigator </mat-header-cell>
            <mat-cell *matCellDef="let item">{{item.simplified.contacts.principalInvestigator ? item.simplified.contacts.principalInvestigator[0].name : ''}}</mat-cell>
        </ng-container>

        <mat-header-row *matHeaderRowDef="displayedColumns"></mat-header-row>
        <mat-row *matRowDef="let row; columns: displayedColumns;"></mat-row>
    </mat-table>
    `
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

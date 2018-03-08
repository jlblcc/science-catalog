import { Component, Input } from '@angular/core';

@Component({
    selector: 'item-table',
    template: `
    <mat-table [dataSource]="dataSource" matSort>

        <ng-container matColumnDef="title">
            <mat-header-cell *matHeaderCellDef mat-sort-header> Title </mat-header-cell>
            <mat-cell *matCellDef="let item"><highlight-text [text]="item.simplified.title" [highlight]="highlight"></highlight-text></mat-cell>
        </ng-container>

        <ng-container matColumnDef="lcc">
            <mat-header-cell *matHeaderCellDef mat-sort-header> LCC </mat-header-cell>
            <mat-cell *matCellDef="let item">{{item.simplified.lcc | lccTitle}}</mat-cell>
        </ng-container>

        <mat-header-row *matHeaderRowDef="displayedColumns"></mat-header-row>
        <mat-row *matRowDef="let row; columns: displayedColumns;"></mat-row>
    </mat-table>
    `
})
export class ItemTable {
    displayedColumns = ['title','lcc'];

    @Input() highlight:string[];
    @Input() dataSource;
}

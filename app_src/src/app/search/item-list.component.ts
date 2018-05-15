import { Component, Input } from '@angular/core';

import { MatSort, Sort, MatSortable, MatSelectChange, SortDirection, MatTableDataSource } from '@angular/material';

import { DEFAULT_SORT_DIRECTION, DEFAULT_ACTIVE_SORT, TABLE_COLUMNS } from './item-table.component';

/**
 * Display search results in a list.  Unlike `ItemTable` this component drives
 * sorting (via `MatSort`) manually.
 */
@Component({
    selector: 'item-list',
    template: `
    <div class="sort-controls">
        <mat-form-field class="sort-column">
            <mat-select (selectionChange)="sortChange()" [(value)]="sort.active">
                <mat-option *ngFor="let c of tableColumns" [value]="c.property">{{c.label}}</mat-option>
            </mat-select>
            <span matPrefix>Sort by:&nbsp;</span>
        </mat-form-field>
        <mat-button-toggle class="sort-direction-toggle"
            [checked]="sortDescending"
            matTooltip="Change sort direction"
            (change)="sortDirectionChange()">
            <mat-icon [fontIcon]="sortDescending ? 'fa-arrow-down' :'fa-arrow-up'"></mat-icon>
        </mat-button-toggle>
    </div>
    <item-teaser *ngFor="let item of dataSource.data" [item]="item" [highlight]="highlight"></item-teaser>
    `
})
export class ItemList {
    tableColumns = TABLE_COLUMNS;

    @Input() highlight:string[];
    @Input() dataSource: MatTableDataSource<any>;

    sortDescending:boolean;
    sort:MatSort;

    ngOnInit() {
        let sort = new MatSort();
        TABLE_COLUMNS.forEach(c => {
            sort.register({
                disableClear: false,
                id: c.property,
                start: DEFAULT_SORT_DIRECTION
            });
        });
        sort.active = DEFAULT_ACTIVE_SORT;
        sort.direction = DEFAULT_SORT_DIRECTION;
        this.sortDescending = (DEFAULT_SORT_DIRECTION as string) === 'desc';
        this.sort = sort;
    }

    sortChange() {
        this.sort.sortChange.emit({
            active: this.sort.active,
            direction: this.sort.direction
        });
    }

    sortDirectionChange() {
        this.sort.direction = this.sort.direction === 'desc' ? 'asc' : 'desc';
        // annoying but toggle won't re-evaluate [checked]="sort.direction === 'desc'"
        this.sortDescending = this.sort.direction === 'desc';
        this.sortChange();
    }
}

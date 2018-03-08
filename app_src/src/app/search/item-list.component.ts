import { Component, Input } from '@angular/core';

import { MatSort, Sort, MatSortable, MatSelectChange, SortDirection } from '@angular/material';

import { DEFAULT_SORT_DIRECTION, DEFAULT_ACTIVE_SORT, TABLE_COLUMNS } from './item-table.component';

/**
 * Display search results in a list.  Unlike `ItemTable` this component drives
 * sorting (via `MatSort`) manually.
 */
@Component({
    selector: 'item-list',
    template: `
    <mat-form-field>
        <mat-select placeholder="Sort by" (selectionChange)="sortChange()" [(value)]="sort.active">
            <mat-option *ngFor="let c of tableColumns" [value]="c.property">{{c.label}}</mat-option>
        </mat-select>
    </mat-form-field>
    <mat-button-toggle class="sort-direction-toggle"
        [checked]="sortDescending"
        matTooltip="Change sort direction"
        (change)="sortDirectionChange()">
        <mat-icon [fontIcon]="sortDescending ? 'fa-arrow-down' :'fa-arrow-up'"></mat-icon>
    </mat-button-toggle>

    <mat-list>
        <mat-list-item *ngFor="let item of dataSource.data">
            <h4 mat-line><highlight-text [text]="item.simplified.title" [highlight]="highlight"></highlight-text></h4>
            <h5 mat-line>{{item.simplified.lcc | lccTitle}}</h5>
            <p mat-line><highlight-text [text]="item.simplified.abstract" [highlight]="highlight"></highlight-text></p>
        </mat-list-item>
    </mat-list>
    `
})
export class ItemList {
    tableColumns = TABLE_COLUMNS;

    @Input() highlight:string[];
    @Input() dataSource;

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

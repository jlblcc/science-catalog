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
    <div class="sort-controls">
        <mat-form-field class="sort-column">
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
    </div>
    <mat-card *ngFor="let item of dataSource.data">
        <mat-card-title><highlight-text [text]="item.simplified.title" [highlight]="highlight"></highlight-text> ({{item.simplified.lcc | lccTitle}})</mat-card-title>
        <mat-card-subtitle>Principal Investigator: {{item.simplified.contacts.principalInvestigator ? item.simplified.contacts.principalInvestigator[0].name : ''}}</mat-card-subtitle>
        <mat-card-content>
            <highlight-text [text]="item.simplified.abstract" [highlight]="highlight"></highlight-text>
        </mat-card-content>
    </mat-card>
    `,
    styles: [`
        mat-card {
            margin-bottom: 10px;
        }
        .sort-controls {
            display: flex;
            flex-direction: row;
            align-items: center;
        }
        .sort-controls .sort-column {
            flex-grow: 1;
        }
        .sort-controls .sort-column /deep/ .mat-input-underline {
            // no idea why, this is ootb 1.25em and for this ONE control that causes
            // the underling to not show up.
            bottom: 1.26em;
        }
        .sort-controls .sort-direction-toggle {
            margin-left: 15px;
        }
    `]
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

import { Component, ViewChild } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { Subject ,  merge as mergeObservables ,  of as observableOf } from 'rxjs';
import { debounceTime, map, switchMap, startWith, catchError, takeUntil, distinctUntilChanged, filter } from 'rxjs/operators';

import { MatTableDataSource, MatPaginator, MatSort, Sort, PageEvent } from '@angular/material';

import { MonitorsDestroy } from '../common';
import { LccSelect } from './lcc-select.component';
import { SctypeSelect } from './sctype-select.component';
import { TextSearch } from './text-search.component';
import { KeywordSelect } from './keyword-select.component';
import { FundingSearchControls } from './funding-search-controls.component';
import { GeneralAdvancedControls } from './general-advanced-controls.component';

import { ItemIfc } from '../../../../src/db/models';

import { ItemList } from './item-list.component';
import { ItemTable } from './item-table.component';
import { ItemMap } from './item-map.component';

import { SearchCriteria, SearchService } from './search.service';

const BASE_QUERY_ARGS = {
    $select: 'scType simplified'
};

@Component({
    selector: 'item-search',
    template: `
    <div class="search-running-shade" *ngIf="search.searchRunning">
        <mat-spinner></mat-spinner>
    </div>

    <div class="search-controls">
        <div class="basic-controls-line-1">
            <text-search></text-search>
            <sctype-select></sctype-select>
            <reset></reset>
            <share></share>
        </div>
        <lcc-select></lcc-select>
    </div>

    <mat-expansion-panel>
        <mat-expansion-panel-header>
            <mat-panel-title>Advanced search</mat-panel-title>
        </mat-expansion-panel-header>
        <general-advanced-controls></general-advanced-controls>
        <funding-search-controls></funding-search-controls>
    </mat-expansion-panel>

    <mat-expansion-panel (opened)="summaryStatsOpened=true" (closed)="summaryStatsOpened=false">
        <mat-expansion-panel-header>
            <mat-panel-title>Summary statistics</mat-panel-title>
        </mat-expansion-panel-header>
        <summary-statistics *ngIf="summaryStatsOpened"></summary-statistics>
    </mat-expansion-panel>

    <div class="search-results">
        <mat-button-toggle-group [formControl]="resultsListType" class="results-list-type" vertical="true">
            <mat-button-toggle value="list" matTooltip="Display results as a list" matTooltipPosition="left">
                <mat-icon fontIcon="fa-bars"></mat-icon>
            </mat-button-toggle>
            <mat-button-toggle value="table" matTooltip="Display results in a table" matTooltipPosition="left">
                <mat-icon fontIcon="fa-table"></mat-icon>
            </mat-button-toggle>
            <mat-button-toggle value="map" matTooltip="Display results on a map" matTooltipPosition="left">
                <mat-icon fontIcon="fa-map"></mat-icon>
            </mat-button-toggle>
        </mat-button-toggle-group>
        <item-list *ngIf="resultsListType.value === 'list'" [dataSource]="dataSource" [highlight]="$text.highlight"></item-list>
        <item-table *ngIf="resultsListType.value === 'table'" [dataSource]="dataSource" [highlight]="$text.highlight"></item-table>
        <item-map *ngIf="resultsListType.value === 'map'" [dataSource]="dataSource" [highlight]="$text.highlight"></item-map>
        <mat-paginator [length]="search.totalItems" [pageSize]="search.pageSize" [pageSizeOptions]="[10, 20, 50, 100, 200]"></mat-paginator>
    </div>
    <sync-status></sync-status>
    `,
    styleUrls: [ './item-search.component.scss']
})
export class ItemSearch extends MonitorsDestroy {
    /** The LCC selection component */
    @ViewChild(LccSelect) lcc: LccSelect;
    /** The text search input */
    @ViewChild(TextSearch) $text: TextSearch;
    /** The type selection component */
    @ViewChild(SctypeSelect) scType: SctypeSelect;
    /** The general advanced control */
    @ViewChild(GeneralAdvancedControls) general: GeneralAdvancedControls;

    /** The funding controls */
    @ViewChild(FundingSearchControls) funding: FundingSearchControls;
    /** Holds the current page of search results to pass down to the table/list view */
    dataSource = new MatTableDataSource<ItemIfc>();

    /** Toggles between table/list view */
    resultsListType: FormControl;
    /** Controls which page is current in the results */
    @ViewChild(MatPaginator) paginator:MatPaginator;
    /** If on list view contains ItemList child component */
    @ViewChild(ItemList) itemList:ItemList;
    /** If on table view contains ItemTable child component */
    @ViewChild(ItemTable) itemTable:ItemTable;
    /** If on the map view contains ItemMap child component */
    @ViewChild(ItemMap) itemMap:ItemMap;

    /** Kicked when the view changes to update the underlying sorter */
    private sorterChanges:Subject<MatSort> = new Subject();
    /** Pass through for events comming from `currentSorter`. */
    private sortChanges:Subject<Sort> = new Subject();

    summaryStatsOpened:boolean = false;

    constructor(public search:SearchService) {
        super();
        const initialCriteria:SearchCriteria = search.initial;
        initialCriteria.$view = initialCriteria.$view||'table';
        this.resultsListType = new FormControl(initialCriteria.$view)
    }

    ngOnInit() {
        this.search.paginator = this.paginator;
    }

    ngAfterViewInit() {
        // roll up all criteria input into a group so we can react to
        // any change to the criteria input.
        let criteriaGroup = new FormGroup({
            lcc: this.lcc.control,
            scType: this.scType.control,
            general: this.general.controls,
            funding: this.funding.controls,
            $view: this.resultsListType,
            $text: this.$text.control
        });

        // when one of several things happen reset to page zero
        mergeObservables(
            criteriaGroup.valueChanges, // criteria changed
            this.resultsListType.valueChanges, // view changed between table/list
            this.sortChanges, // sort order changed
        )
        .pipe(
            takeUntil(this.componentDestroyed)
        )
        .subscribe(() => this.paginator.pageIndex = 0);

        // when one of several things happen re-execute the query
        mergeObservables(
            criteriaGroup.valueChanges, // criteria changed
            this.paginator.page.asObservable(), // page navigation
            this.sortChanges, // sort property/direction change
            this.search.searchReset // search criteria reset
        ).pipe(
            takeUntil(this.componentDestroyed),
            switchMap(() => this.search.search(criteriaGroup.value as SearchCriteria)),
            catchError(() => {
                this.search.searchRunning = false;
                return observableOf([]);
            })
        ).subscribe(items => this.dataSource.data = items);

        let sortSubscription;
        // this will happen when the component is loaded and whenever
        // the view is toggled between table/list (switching who's controlling
        // how the results are sorted (the table column headers or control in list view)
        this.sorterChanges
          .pipe(
              takeUntil(this.componentDestroyed),
              distinctUntilChanged()
          ) // only do this once per view change
          .subscribe((sorter:MatSort) => {
              this.search.currentSorter = sorter;
              if(sortSubscription) {
                  // if toggling back and forth make sure to cleanup
                  // takeUntil(sorterChanges) might be cleaner but
                  // it gets called repeatedly so manually unsubscribe
                  sortSubscription.unsubscribe();
              }
              sortSubscription = sorter.sortChange.asObservable()
                  .pipe(
                      takeUntil(this.componentDestroyed),
                      startWith({
                          active: sorter.active,
                          direction: sorter.direction
                      })
                  )
                  .subscribe((sort:Sort) => setTimeout(() => this.sortChanges.next(sort)));
          });
    }

    ngAfterViewChecked() {
        // will be called after @ViewChild/s are updated (many times)
        // based on whether the list or table view is being used update the
        // underlying MatSort implementation dictating column sorting
        let matSort = this.itemList && this.itemList.sort ? this.itemList.sort :
                      this.itemTable && this.itemTable.sort ? this.itemTable.sort :
                      this.itemMap && this.itemMap.sort ? this.itemMap.sort : null;
        this.sorterChanges.next(matSort);
    }
}

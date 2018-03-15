import { Component, ViewChild } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { Subject } from 'rxjs/Subject';
import { debounceTime, map, switchMap, startWith, catchError, takeUntil, distinctUntilChanged } from 'rxjs/operators';
import { merge as mergeObservables } from 'rxjs/observable/merge';
import { of as observableOf } from 'rxjs/observable/of';

import { MatTableDataSource, MatPaginator, MatButtonToggleGroup, MatSort, Sort } from '@angular/material';

import { LccSelect } from './lcc-select.component';
import { SctypeSelect } from './sctype-select.component';
import { KeywordSelect } from './keyword-select.component';
import { FundingSearchControls } from './funding-search-controls.component';

import { ItemIfc } from '../../../../src/db/models';

import { ItemList } from './item-list.component';
import { ItemTable } from './item-table.component';

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
            <mat-form-field class="text-search">
                <input matInput placeholder="Title/Description" [formControl]="$text" />
            </mat-form-field>
            <sctype-select></sctype-select>
            <mat-button-toggle-group #resultsListType="matButtonToggleGroup" value="table" class="results-list-type">
                <mat-button-toggle value="list" matTooltip="Display results as a list">
                    <mat-icon fontIcon="fa-bars"></mat-icon>
                </mat-button-toggle>
                <mat-button-toggle value="table" matTooltip="Display results in a table">
                    <mat-icon fontIcon="fa-table"></mat-icon>
                </mat-button-toggle>
            </mat-button-toggle-group>
        </div>

        <lcc-select></lcc-select>

        <mat-expansion-panel class="advanced-search-panel" expanded="false">
            <mat-expansion-panel-header>Advanced search</mat-expansion-panel-header>
            <div class="advanced-search-controls">
                <mat-expansion-panel  expanded="true">
                    <mat-expansion-panel-header>Keywords</mat-expansion-panel-header>
                    <keyword-select></keyword-select>
                </mat-expansion-panel>
                <funding-search-controls></funding-search-controls>
            </div>
        </mat-expansion-panel>
        <mat-expansion-panel class="summary-statistics-panel"
            [expanded]="statisticsExpanded"
            (opened)="statisticsExpanded = true"
            (closed)="statisticsExpanded = false">
            <mat-expansion-panel-header>Summary statistics</mat-expansion-panel-header>
            <summary-statistics *ngIf="statisticsExpanded"></summary-statistics>
        </mat-expansion-panel>
    </div>

    <div class="search-results">
        <item-list *ngIf="resultsListType.value === 'list'" [dataSource]="dataSource" [highlight]="highlight"></item-list>
        <item-table *ngIf="resultsListType.value === 'table'" [dataSource]="dataSource" [highlight]="highlight"></item-table>
        <mat-paginator [length]="search.totalItems" [pageSize]="search.pageSize"></mat-paginator>
    </div>
    `,
    styleUrls: [ './item-search.component.scss']
})
export class ItemSearch {
    /** The LCC selection component */
    @ViewChild(LccSelect) lcc: LccSelect;
    /** The type selection component */
    @ViewChild(SctypeSelect) scType: SctypeSelect;
    /** The keyword selection component (advanced) */
    @ViewChild(KeywordSelect) keywords: KeywordSelect;
    /** The funding controls */
    @ViewChild(FundingSearchControls) funding: FundingSearchControls;
    /** FormControl for $text based search */
    $text:FormControl = new FormControl();
    /** Individual words entered into the $text input so results displays can highlight them */
    highlight:string[] = [];
    /** Holds the current page of search results to pass down to the table/list view */
    dataSource = new MatTableDataSource<ItemIfc>();

    /** Toggles between table/list view */
    @ViewChild(MatButtonToggleGroup) resultsListType: MatButtonToggleGroup;
    /** Controls which page is current in the results */
    @ViewChild(MatPaginator) paginator:MatPaginator;
    /** If on list view contains ItemList child component */
    @ViewChild(ItemList) itemList:ItemList;
    /** If on table view contains ItemTable child component */
    @ViewChild(ItemTable) itemTable:ItemTable;

    /** Kicked when the view changes to update the underlying sorter */
    private sorterChanges:Subject<MatSort> = new Subject();
    /** Pass through for events comming from `currentSorter`. */
    private sortChanges:Subject<Sort> = new Subject();

    statisticsExpanded:boolean = false;

    constructor(public search:SearchService) {}

    ngOnInit() {
        this.search.paginator = this.paginator;
    }

    ngAfterViewInit() {
        // capture input from the $text control and push it into the
        // criteriaGroup, doing this so we can debounce the input so
        // we're not running a query per character press
        this.$text.valueChanges.pipe(
            debounceTime(500)
        ).subscribe((v:string) => {
            let regex = new RegExp('"([\\w\\s^"]+)"|\\b(\\w+)\\b','g'),
                match, matches = [];
            while ((match = regex.exec(v)) !== null) {
                match = match[0];
                if(match.charAt(0) === '"' && match.charAt(match.length-1) === '"') {
                    match = match.substring(1,match.length-1);
                }
                matches.push(match);
            }
            this.highlight = matches;
            criteriaGroup.setValue({
                ...criteriaGroup.value,
                $text: v
            });
        });

        // roll up all criteria input into a group so we can react to
        // any change to the criteria input.
        let criteriaGroup = new FormGroup({
            lcc: this.lcc.control,
            scType: this.scType.control,
            keywords: this.keywords.control,
            funding: this.funding.controls,
            $text: new FormControl() // to catch $text values
        });

        // when one of several things happen reset to page zero
        mergeObservables(
            criteriaGroup.valueChanges, // criteria changed
            this.resultsListType.valueChange.asObservable(), // view changed between table/list
            this.sortChanges // sort order changed
        ).subscribe(() => this.paginator.pageIndex = 0);

        // when one of several things happen re-execute the query
        mergeObservables(
            criteriaGroup.valueChanges, // criteria changed
            this.paginator.page, // page navigation
            this.sortChanges // sort property/direction change
        ).pipe(
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
          .pipe(distinctUntilChanged()) // only do this once per view change
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
                      this.itemTable && this.itemTable.sort ? this.itemTable.sort : null;
        this.sorterChanges.next(matSort);
    }
}

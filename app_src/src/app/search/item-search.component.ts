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

const BASE_QUERY_ARGS = {
    $select: 'scType simplified'
};

@Component({
    selector: 'item-search',
    template: `
    <div class="search-running-shade" *ngIf="searchRunning">
        <mat-spinner></mat-spinner>
    </div>

    <div class="search-controls">
        <div class="lcc-output-select">
            <lcc-select></lcc-select>
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

        <mat-form-field>
            <input matInput placeholder="Title/Description" [formControl]="$text" />
        </mat-form-field>

        <mat-expansion-panel class="advanced-search-panel" expanded="true">
            <mat-expansion-panel-header>Advanced search</mat-expansion-panel-header>
            <div class="advanced-search-controls">
                <mat-expansion-panel  expanded="true">
                    <mat-expansion-panel-header>Keywords</mat-expansion-panel-header>
                    <keyword-select></keyword-select>
                </mat-expansion-panel>
                <funding-search-controls></funding-search-controls>
            </div>
        </mat-expansion-panel>
    </div>

    <div class="search-results">
        <item-list *ngIf="resultsListType.value === 'list'" [dataSource]="dataSource" [highlight]="highlight"></item-list>
        <item-table *ngIf="resultsListType.value === 'table'" [dataSource]="dataSource" [highlight]="highlight"></item-table>
        <mat-paginator [length]="totalItems" [pageSize]="pageSize"></mat-paginator>
    </div>
    `,
    styleUrls: [ './item-search.component.scss']
})
export class ItemSearch {
    /** Whether a search is currently running (show spinner) */
    searchRunning = false;
    /** How many items to display per page (hard coded) */
    pageSize = 10;
    /** How many items are in the current search result */
    totalItems = 0;

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

    /** The sort control for the current Item[List|Table] */
    private currentSorter:MatSort;
    /** Kicked when the view changes to update the underlying sorter */
    private sorterChanges:Subject<MatSort> = new Subject();
    /** Pass through for events comming from `currentSorter`. */
    private sortChanges:Subject<Sort> = new Subject();

    constructor(private http:HttpClient) {}

    ngOnInit() {
        this.keywords.sctypeSelect = this.scType;
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
          switchMap(() => {
              let qargs:any = {
                  ...BASE_QUERY_ARGS,
                  $top: this.pageSize,
                  $skip: this.paginator.pageIndex * this.pageSize,
                  $ellipsis: '300',
                  $orderby: `${this.currentSorter.direction === 'desc' ? '-' : ''}${this.currentSorter.active}`,
              };
              let criteria = criteriaGroup.value;
              console.log('criteria',criteria);
              // if $text search, pass along
              if(criteria.$text) {
                  qargs.$text = criteria.$text;
              }
              // build the $filter value
              // require simplified not equal null so that we can avoid picking up
              // items that are currently being sync'ed into the system and have yet
              // to have simplification run on them.
              let $filter = 'simplified ne null';
              if(criteria.scType) {
                  $filter += ` and scType eq '${criteria.scType}'`;
              }
              if(criteria.lcc.length) {
                  let ids = criteria.lcc.map(id => `'${id}'`);
                  $filter += ` and in(_lcc,${ids.join(',')})`;
              }
              criteria.keywords.forEach(k => {
                 $filter += ` and simplified.keywords.keywords.${k.typeKey} eq '${k.value}'` ;
              });
              // if $filter is truthy pass along
              if($filter) {
                  qargs.$filter = $filter;
              }
              let page = this.http.get('/api/item',{params:qargs})
                              .pipe(map((response:any) => {
                                  this.searchRunning = false;
                                  return response.list as ItemIfc[]
                              }));
              this.searchRunning = true;
              // if this is page 0 run a count and then fetch the page contents
              // so we can update the pager, otherwise just fetch the page.
              return !qargs.$skip ?
                this.http.get('/api/item/count',{params:{...qargs,$top:99999}})
                    .pipe(
                        switchMap((response) => {
                            console.log(`Total results ${response}`);
                            this.totalItems = response as number;
                            return page;
                        })
                    ) : page;
          }),
          catchError(() => {
              this.searchRunning = false;
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
              this.currentSorter = sorter;
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

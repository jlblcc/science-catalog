import { Component, ViewChild } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { debounceTime, map, switchMap, startWith, catchError } from 'rxjs/operators';
import { merge as mergeObservables } from 'rxjs/observable/merge';
import { of as observableOf } from 'rxjs/observable/of';

import { MatTableDataSource, MatPaginator, MatButtonToggleGroup } from '@angular/material';

import { LccSelect } from './lcc-select.component';

import { ItemIfc } from '../../../../src/db/models';

const BASE_QUERY_ARGS = {
    $select: 'simplified'
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
            
            <mat-button-toggle-group #resultsListType="matButtonToggleGroup" value="list" class="results-list-type">
                <mat-button-toggle value="list" matTooltip="Display results as a list">
                    <mat-icon fontIcon="fa-bars"></mat-icon>
                </mat-button-toggle>
                <mat-button-toggle value="table" matTooltip="Display results in a table">
                    <mat-icon fontIcon="fa-table"></mat-icon>
                </mat-button-toggle>
            </mat-button-toggle-group>
        </div>

        <mat-form-field>
            <input matInput placeholder="Title/Description" [formControl]="keywords" />
        </mat-form-field>
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
    searchRunning = false;

    @ViewChild(MatButtonToggleGroup) resultsListType: MatButtonToggleGroup;
    @ViewChild(LccSelect) lcc: LccSelect;

    keywords:FormControl = new FormControl();
    highlight:string[] = [];

    private controlsGroup:FormGroup;

    dataSource = new MatTableDataSource<ItemIfc>();
    @ViewChild(MatPaginator) paginator:MatPaginator;
    pageSize = 10;
    totalItems = 0;

    constructor(private http:HttpClient) {}

    ngOnInit() {
        // just hold onto its value.
        this.keywords.valueChanges.pipe(
            debounceTime(500)
        ).subscribe((v:string) => {
            this.highlight = v ? v.split(' ') : [];
            this.controlsGroup.setValue({
                ...this.controlsGroup.value,
                keywords: v
            });
        });

        this.controlsGroup = new FormGroup({
            lcc: this.lcc.control,
            keywords: new FormControl() // to catch keywords values
        });

        // if any criteria, or the view type changes reset to page 0
        mergeObservables(this.controlsGroup.valueChanges,this.resultsListType.valueChange.asObservable())
            .subscribe(() => this.paginator.pageIndex = 0);

        mergeObservables(this.controlsGroup.valueChanges, this.paginator.page) // TODO merge paginator, etc.
            .pipe(
              startWith(null),
              switchMap(() => {
                  let inputs = this.controlsGroup.value,
                      $filter = '';
                  console.log('inputs',inputs);
                  if(inputs.lcc.length) {
                      let ids = inputs.lcc.map(id => `'${id}'`);
                      $filter = `in(_lcc,${ids.join(',')})`;
                  }
                  let qargs:any = {...BASE_QUERY_ARGS,$top: this.pageSize};
                  qargs.$skip = this.paginator.pageIndex * qargs.$top;
                  if(inputs.keywords) {
                      qargs.$text = inputs.keywords;
                  }
                  if($filter) {
                      qargs.$filter = $filter;
                  }
                  let page = this.http.get('/api/item',{params:qargs})
                      .pipe(map((response:any) => response.list as ItemIfc[]));
                  this.searchRunning = true;
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
          ).subscribe(items => {
              this.searchRunning = false;
              this.dataSource.data = items;
          });
    }
}

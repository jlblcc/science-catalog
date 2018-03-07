import { Component, ViewChild } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { debounceTime, map, switchMap, startWith } from 'rxjs/operators';
import { merge as mergeObservables } from 'rxjs/observable/merge';

import { MatTableDataSource, MatPaginator } from '@angular/material';

import { LccSelect } from './lcc-select.component';

import { ItemIfc } from '../../../../src/db/models';

const BASE_QUERY_ARGS = {
    $select: 'title _lcc simplified'
};
@Component({
    selector: 'item-search',
    template: `
    <lcc-select></lcc-select>
    <mat-form-field>
        <input matInput placeholder="Keywords" [formControl]="keywords" />
    </mat-form-field>

    <item-list [dataSource]="dataSource" [highlight]="highlight"></item-list>
    <mat-paginator [length]="totalItems" [pageSize]="pageSize"></mat-paginator>
    `,
    styles: [`
        mat-form-field {
            display: block;
        }
    `]
})
export class ItemSearch {
    @ViewChild(LccSelect) lcc;

    keywords:FormControl = new FormControl();
    highlight:string[] = [];

    private controlsGroup:FormGroup;

    dataSource = new MatTableDataSource<ItemIfc>();
    @ViewChild(MatPaginator) paginator:MatPaginator;
    pageSize = 10;
    totalItems = 0;

    constructor(private http:HttpClient) {}

    ngOnInit() {
        // handling the keywords control separately so it can be debounced
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
        // if any criteria changes reset to page 0
        this.controlsGroup.valueChanges.subscribe(() => this.paginator.pageIndex = 0);

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
                  return !qargs.$skip ?
                    this.http.get('/api/item/count',{params:{...qargs,$top:99999}})
                        .pipe(
                            switchMap((response) => {
                                console.log(`Total results ${response}`);
                                this.totalItems = response as number;
                                return page;
                            })
                        ) : page;
              })
          ).subscribe(items => {
              console.log(`items`,items);
              this.dataSource.data = items;
          });
    }
}

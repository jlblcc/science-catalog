import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { MatPaginator, MatSort } from '@angular/material';

import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { map, switchMap, startWith } from 'rxjs/operators';

import { ScType, ItemIfc } from '../../../../src/db/models';

const BASE_QUERY_ARGS = {
    $select: 'scType simplified'
};

export interface FundingSearchCriteria {
    fiscalYears?: number [];
    awardId?: string;
    match?:boolean;
    lowerAmount?:number;
    upperAmount?:number;

    sourceType?: string[];
    source?: string;
    recipientType?: string[];
    recipient?: string;
}
export interface KeywordSearchCriteria {
    /** The keyword type key */
    typeKey:string;
    /** The keyword type label */
    typeLabel:string;
    /** The keyword value */
    value:string;
}
export interface SearchCriteria {
    /** Sciencebase item type */
    scType?: ScType;
    /** List of LCC ids to include */
    lcc?: string[];
    /** List of keyword criteria */
    keywords?: KeywordSearchCriteria[];
    /** text index search input */
    $text?: string;
    /** funding criteria */
    funding?: FundingSearchCriteria;
}

@Injectable()
export class SearchService {
    private current$Filter:string;
    $filterChanges:Subject<string> = new Subject();
    /** How many items to display per page */
    readonly pageSize = 10;
    /** How many items are in the last search result */
    totalItems = 0;
    /** Whether a search is currently active */
    searchRunning:boolean = false;
    /** Controls which page is current in the results */
    paginator:MatPaginator;
    /** The sort control for the current Item[List|Table] */
    currentSorter:MatSort;

    constructor(private http:HttpClient) {}

    search(criteria:SearchCriteria):Observable<ItemIfc[]> {
        console.log('SearchService.search',criteria);
        let qargs:any = {
            ...BASE_QUERY_ARGS,
            $top: this.pageSize,
            $skip: this.paginator.pageIndex * this.pageSize,
            $ellipsis: '300',
            $orderby: `${this.currentSorter.direction === 'desc' ? '-' : ''}${this.currentSorter.active}`,
        };
        // if $text search, pass along
        if(criteria.$text) {
            qargs.$text = criteria.$text;
        }
        // build the $filter value
        // require simplified not equal null so that we can avoid picking up
        // items that are currently being sync'ed into the system and have yet
        // to have simplification run on them.
        let $filter = 'simplified ne null',tmp:any;
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
        if(criteria.funding) {
            let f = criteria.funding;
            if(f.fiscalYears && f.fiscalYears.length) {
                $filter += ` and in(simplified.funding.fiscalYears,${f.fiscalYears.join(',')})`;
            }
            if(f.awardId) {
                $filter += ` and simplified.funding.awardIds eq '${f.awardId}'`;
            }
            if(typeof(f.match) === 'boolean') {
                $filter += ` and simplified.funding.matching eq ${f.match}`;
            }
            if(f.lowerAmount) {
                $filter += ` and simplified.funding.amount ge ${f.lowerAmount}`;
            }
            if(f.upperAmount) {
                $filter += ` and simplified.funding.amount le ${f.upperAmount}`;
            }
            if(f.source) {
                $filter += ` and simplified.funding.sources.name eq '${f.source}'`;
            }
            if(f.sourceType && f.sourceType.length) {
                tmp = f.sourceType.map(t => `'${t}'`).join(',');
                $filter += ` and in(simplified.funding.sources.contactType,${tmp})`
            }
            if(f.recipient) {
                $filter += ` and simplified.funding.recipients.name eq '${f.recipient}'`;
            }
            if(f.recipientType && f.recipientType.length) {
                tmp = f.recipientType.map(t => `'${t}'`).join(',');
                $filter += ` and in(simplified.funding.recipients.contactType,${tmp})`
            }
        }

        qargs.$filter = $filter;

        let page = this.http.get('/api/item',{params:qargs})
                        .pipe(map((response:any) => {
                            this.searchRunning = false;
                            if(this.current$Filter !== $filter) {
                                this.$filterChanges.next(this.current$Filter = $filter);
                            }
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
    }

    distinct<T>($select:string,$filter?:string,$contains?:string):Observable<T []> {
        let $f = this.current$Filter;
        const params:any = {
            $select: $select
        };
        if($f || $filter) {
            params.$filter = $f && $filter ? `{$f} and ${$filter}` : ($f ? $f : $filter);
        }
        if($contains) {
            params.$contains = $contains;
        }
        return this.http.get<T []>('/api/item/distinct',{ params: params });
    }

    liveDistinct<T>($select:string,$filter?:string,$contains?:string):Observable<T []> {
        return this.$filterChanges.pipe(
            //don't start until the initial query has fired
            //startWith(this.current$Filter),
            switchMap($f => {
                //console.log(`$f = "${$f}"`);
                const params:any = {
                    $select: $select
                };
                if($f || $filter) {
                    params.$filter = $f && $filter ? `{$f} and ${$filter}` : ($f ? $f : $filter);
                }
                if($contains) {
                    params.$contains = $contains;
                }
                return this.http.get<T []>('/api/item/distinct',{ params: params });
            })
        );
    }
}

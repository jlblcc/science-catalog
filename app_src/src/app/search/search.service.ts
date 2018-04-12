import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Location } from '@angular/common';

import { MatPaginator, MatSort } from '@angular/material';

import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { map, switchMap, startWith, filter } from 'rxjs/operators';

import { ConfigService, CacheService } from '../common';

import { ScType, ItemIfc, LccIfc } from '../../../../src/db/models';

import * as pako from 'pako';

const BASE_QUERY_ARGS = {
    $select: 'scType simplified lccnet'
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
export interface KeywordCriteria {
    /** The keyword type key */
    typeKey:string;
    /** The keyword type label */
    typeLabel:string;
    /** The keyword value */
    value:string;
}
export interface KeywordSearchCriteria {
    /** Whether to `and` or `or` the keywords together during search */
    logicalOperator: string;
    /** The list of `KeywordCriteria` */
    criteria: KeywordCriteria[];
}
export interface SearchCriteria {
    /** Sciencebase item type */
    scType?: ScType;
    /** List of LCC ids to include */
    lcc?: string[];
    /** List of keyword criteria */
    keywords?: KeywordSearchCriteria;
    /** text index search input */
    $text?: string;
    /** funding criteria */
    funding?: FundingSearchCriteria;
    /** The $filter value built from these criteria */
    $filter?: string;
}

const CACHED_CRITERIA_KEY = 'science-catalog-search-criteria';

@Injectable()
export class SearchService {
    private initialCriteria:SearchCriteria;
    private currentCriteria:SearchCriteria;
    private criteriaChanges:Subject<SearchCriteria> = new Subject();
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

    constructor(private http:HttpClient,
                private location:Location,
                private config:ConfigService,
                private cache:CacheService) {
        let path = location.path();
        if(path) {
            if(path.charAt(0) === '/') {
                path = path.substring(1);
            }
            try {
                this.initialCriteria = this.deserialize(path);
                console.log('initial criteria',this.initialCriteria);
            } catch(e) {
                console.error(`Error deserializing criteria`,e);
            }
        } else {
            this.initialCriteria = this.cache.get(CACHED_CRITERIA_KEY);
        }
    }

    get initial():SearchCriteria {
        return this.initialCriteria;
    }

    get current():SearchCriteria {
        return this.currentCriteria;
    }

    getShareableUrl():string {
        let href = window.location.href,
            hash = href.indexOf('#');
        if(hash !== -1) {
            href = href.substring(0,hash);
        }
        return href+this.location.prepareExternalUrl(this.serialize(this.currentCriteria));
    }

    /**
     * @returns A copy of `criteria` with all null/empty keys stripped out.
     */
    private simplify(criteria:SearchCriteria):SearchCriteria {
        let copy = JSON.parse(JSON.stringify(criteria)),
            simplify = (o) => {
                Object.keys(o).forEach(k => {
                    if((o[k] === null || o[k] === undefined || o[k] === '') || (o[k] instanceof Array && !o[k].length)) {
                        delete o[k];
                    } else if (typeof(o[k]) === 'object') {
                        o[k] = simplify(o[k]);
                        if(!o[k]) {
                            delete o[k];
                        }
                    }
                });
                return Object.keys(o).length ? o : null;
            };
        // recursively remove null/empty keys to bring the object size down to
        // the minimum necessary.
        copy = simplify(copy);
        return copy;
    }

    /**
     * Take some search criteria and serialize it into a string that can be
     * re-constituted later.
     */
    private serialize(criteria:SearchCriteria):string {
        // using pako to gzip the result, for small filters is not much
        // space savings but for larger filters it can decrease the char count
        // by hundreds of chars once base 64 encoded
        let binaryString = pako.deflate(JSON.stringify(this.simplify(criteria)),{to:'string'});
        return window.btoa(binaryString);
    }

    private deserialize(encodedCriteria:string):SearchCriteria {
        const binaryString = window.atob(encodedCriteria);
        return JSON.parse(pako.inflate(binaryString, { to: 'string' }));
    }

    lccs():Observable<LccIfc []> {
        return this.http.get(this.config.qualifyApiUrl('/lcc'),{params:{$orderby:'title'}})
            .pipe(
                map((response:any) => response.list as LccIfc[])
            );
    }

    private buildFilter(criteria:SearchCriteria):string {
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
        if(criteria.keywords && criteria.keywords.criteria.length) {
            let keywordFilter =
                criteria.keywords.criteria.map(k => `simplified.keywords.keywords.${k.typeKey} eq '${k.value}'`)
                    .join(` ${criteria.keywords.logicalOperator} `);
            $filter += ` and (${keywordFilter})`;
        }
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

        return (criteria.$filter = $filter);
    }

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

        qargs.$filter = this.buildFilter(criteria);

        let page = this.http.get(this.config.qualifyApiUrl('/item'),{params:qargs})
                        .pipe(map((response:any) => {
                            this.searchRunning = false;
                            if(!this.currentCriteria ||
                               criteria.$filter !== this.currentCriteria.$filter ||
                               criteria.$text !== this.currentCriteria.$text) {
                              this.criteriaChanges.next(this.currentCriteria = criteria);
                              this.cache.set(CACHED_CRITERIA_KEY,this.currentCriteria);
                            }
                            return response.list as ItemIfc[]
                        }));
        this.searchRunning = true;
        // if this is page 0 run a count and then fetch the page contents
        // so we can update the pager, otherwise just fetch the page.
        return !qargs.$skip ?
          this.http.get(this.config.qualifyApiUrl('/item/count'),{params:{...qargs,$top:99999}})
              .pipe(
                  switchMap((response) => {
                      console.log(`Total results ${response}`);
                      this.totalItems = response as number;
                      return page;
                  })
              ) : page;
    }

    private _distinct<T>(criteria:SearchCriteria,$select:string,$filter?:string,$contains?:string):Observable<T []> {
        let $f = criteria ? criteria.$filter : undefined;
        const params:any = {
            $select: $select
        };
        if($f || $filter) {
            params.$filter = $f && $filter ? `{$f} and ${$filter}` : ($f ? $f : $filter);
        }
        if(criteria && criteria.$text) {
            params.$text = criteria.$text;
        }
        if($contains) {
            params.$contains = $contains;
        }
        return this.http.get<T []>(this.config.qualifyApiUrl('/item/distinct'),{ params: params });
    }

    distinct<T>($select:string,$filter?:string,$contains?:string):Observable<T []> {
        return this._distinct(this.currentCriteria,$select,$filter,$contains);
    }

    liveDistinct<T>($select:string,$filter?:string,$contains?:string,startWithCurrent?:boolean):Observable<T []> {
        const switchTo = (criteria:SearchCriteria):Observable<T []> => this._distinct(criteria,$select,$filter,$contains);
        return startWithCurrent && this.currentCriteria ?
            this.criteriaChanges.pipe(
                startWith(this.currentCriteria),
                switchMap(switchTo)
            ) :
            this.criteriaChanges.pipe(
                //don't start until the initial query has fired
                switchMap(switchTo)
            );
    }

    summaryStatistics():Observable<any> {
        return this.criteriaChanges.pipe(
            startWith(this.currentCriteria),
            filter(c => !!c), // will never be empty except for at load time
            switchMap(c => {
                let params:any = {
                    $filter: c.$filter
                };
                if(c.$text) {
                    params.$text = c.$text;
                }
                return this.http.get<any>(this.config.qualifyApiUrl('/item/summaryStatistics'),{params:params});
            })
        );
    }
}

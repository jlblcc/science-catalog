import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Location } from '@angular/common';

import { MatPaginator, MatSort, SortDirection } from '@angular/material';

import { Observable ,  Subject } from 'rxjs';
import { map, switchMap, startWith, filter, tap } from 'rxjs/operators';

import { ConfigService, CacheService } from '../common';

import { ScType, ItemIfc, LccIfc } from '../../../../src/db/models';

import * as pako from 'pako';

export const DEFAULT_PAGE_SIZE = 10;
export const DEFAULT_SORT_DIRECTION = 'desc';
export const DEFAULT_ACTIVE_SORT = 'simplified.funding.fiscalYears';

const BASE_QUERY_ARGS = {
    $select: 'scType simplified lccnet'
};

/**
 * Basic interface all search controls should implement.  All search controls
 * must register themselves with the `SearchService` via its `register` method.
 */
export interface SearchControl {
    /**
     * Reset the control state.  Implementation should not emit any form events
     * since many controls will be reset at the same time there should not be a
     * flurry of updates.
     */
    reset():void;
}

export interface FundingSearchCriteria {
    awardId?: string;
    match?:boolean;
    amountRange?:number[][];
    sourceType?: string[];
    source?: string;
    recipientType?: string[];
    recipient?: string;
}
export interface KeywordCriteria {
    /** The keyword type key */
    typeKey?:string;
    /** The keyword type label */
    typeLabel?:string;
    /** The keyword value */
    value:string;
}
export interface KeywordSearchCriteria {
    /** Whether to `and` or `or` the keywords together during search */
    logicalOperator: string;
    /** The list of `KeywordCriteria` */
    criteria: KeywordCriteria[];
}
export interface GeneralAdvancedCriteria {
    /** List of resource types */
    resourceType?: string[];
    /** List of fiscal years */
    fiscalYears?: number[];
    /** List of keyword criteria */
    keywords?: KeywordSearchCriteria;
    /** Single status */
    status?: string[];
    /** Associated organization by name */
    assocOrgNames?: string;
    /** Lead organization by name */
    leadOrgNames?: string;
    /** Filter for data.gov bound items */
    dataDotGov?:boolean;
}
export interface SearchContext {
    /** The current view */
    $view?: string;
    $pageSize?: number;
    $pageIndex?: number;
    $sortDirection?: SortDirection;
    $sortActive?: string;
}
export interface SearchCriteria {
    /** Sciencebase item type */
    scType?: ScType;
    /** List of LCC ids to include */
    lcc?: string[];
    /** General advanced criteria */
    general?: GeneralAdvancedCriteria;
    /** text index search input */
    $text?: string;
    /** funding criteria */
    funding?: FundingSearchCriteria;
    $control?: SearchContext;
    /** The $filter value built from these criteria */
    $filter?: string;
}

const CACHED_CRITERIA_KEY = 'science-catalog-search-criteria';

@Injectable()
export class SearchService {
    private initialCriteria:SearchCriteria;
    private currentCriteria:SearchCriteria;
    private criteriaChanges:Subject<SearchCriteria> = new Subject();
    private controls:SearchControl[] = [];
    /** How many items are in the last search result */
    totalItems = 0;
    /** Whether a search is currently active */
    searchRunning:boolean = false;
    /** Whether a summary statistics request is currently active */
    summaryRunning:boolean = false;
    /** Controls which page is current in the results */
    paginator:MatPaginator;
    /** The sort control for the current Item[List|Table] */
    currentSorter:MatSort;
    /** Will emit whenever the search controls are reset */
    searchReset:Subject<void> = new Subject();

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
        // other views use the initialCriteria to initialize paging, sorting, etc. so
        // make sure $control is completely populated
        this.initialCriteria = this.initialCriteria||{};
        this.initialCriteria.$control = this.initialCriteria.$control||{};
        this.initialCriteria.$control.$view = this.initialCriteria.$control.$view||'table';
        this.initialCriteria.$control.$pageSize = this.initialCriteria.$control.$pageSize||DEFAULT_PAGE_SIZE;
        this.initialCriteria.$control.$pageIndex = this.initialCriteria.$control.$pageIndex||0;
        this.initialCriteria.$control.$sortDirection = this.initialCriteria.$control.$sortDirection||DEFAULT_SORT_DIRECTION;
        this.initialCriteria.$control.$sortActive = this.initialCriteria.$control.$sortActive||DEFAULT_ACTIVE_SORT;
        console.log('initialCriteria',this.initialCriteria);
        // the "share" functionality was implemented to initialize the control state based on persisted criteria
        // it was not implemented to dynamically re-initialize that state. while that would be possible to implement
        // there are some chicken/egg issues in doing so since there is a mixture of programmiatic passing of "initial values"
        // and angular data binding.  So the easiest thing to do is to watch for changes in the URL and simply reload the page
        // this way if say a menu of saved "share" links is built then a visitor can navigate between them without having
        // to leave the app first (otherwise nothing happens)
        window.addEventListener('popstate', () => window.location.reload());
    }

    register(control:SearchControl):void {
        if(this.controls.indexOf(control) === -1) {
            this.controls.push(control);
        }
    }

    reset():void {
        this.controls.forEach(c => c.reset());
        this.searchReset.next();
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
        if(criteria.$control.$view === 'map') {
            $filter += ` and simplified.extent.representativePoint ne null`;
        }
        if(criteria.scType) {
            $filter += ` and scType eq '${criteria.scType}'`;
        }
        if(criteria.lcc && criteria.lcc.length) {
            let ids = criteria.lcc.map(id => `'${id}'`);
            $filter += ` and in(_lccs,${ids.join(',')})`;
        }

        if(criteria.general) {
            const general = criteria.general;
            if(general.resourceType && general.resourceType.length) {
                const rTypesQuoted = general.resourceType.map(rt => `'${rt}'`);
                $filter += ` and (in(simplified.combinedResourceType.type,${rTypesQuoted.join(',')}))`;
            }
            if(general.fiscalYears && general.fiscalYears.length) {
                $filter += ` and in(simplified.funding.fiscalYears,${general.fiscalYears.join(',')})`;
            }
            if(general.keywords && general.keywords.criteria.length) {
                let keywordFilter =
                    general.keywords.criteria.map(k => k.typeKey ?
                            `simplified.keywords.keywords.${k.typeKey} eq '${k.value}'` :
                            `simplified.allKeywords eq '${k.value}'`)
                        .join(` ${general.keywords.logicalOperator} `);
                $filter += ` and (${keywordFilter})`;
            }
            if(general.status && general.status.length) {
                const statusQuoted = general.status.map(s => `'${s}'`);
                $filter += ` and in(simplified.status,${statusQuoted.join(',')})`;
            }
            if(general.assocOrgNames) {
                $filter += ` and simplified.assocOrgNames eq '${general.assocOrgNames}'`;
            }
            if(general.leadOrgNames) {
                $filter += ` and simplified.leadOrgNames eq '${general.leadOrgNames}'`;
            }
            if(general.dataDotGov) {
                $filter += ` and mdJson.metadataRepository.repository eq 'data.gov'`;
            }
        }
        if(criteria.funding) {
            let f = criteria.funding;
            if(f.awardId) {
                $filter += ` and simplified.funding.awardIds eq '${f.awardId}'`;
            }
            if(typeof(f.match) === 'boolean') {
                $filter += ` and simplified.funding.matching eq ${f.match}`;
            }
            if(f.amountRange && f.amountRange.length) {
                let clauses = f.amountRange.map(range => {
                    let $f = `simplified.funding.amount ge ${range[0]}`;
                    if(range.length > 1) {
                        $f += ` and simplified.funding.amount le ${range[1]}`;
                    }
                    return $f;
                });
                if(clauses.length === 1) {
                    $filter += ` and ${clauses[0]}`;
                } else {
                    clauses = clauses.map(c => `(${c})`);
                    $filter += ` and (${clauses.join(' or ')})`;
                }
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
        // fill in the blanks in the current criteria, ideally these inputs
        // would come via controls and drive search changes but often they're
        // tangled up in other details and driver other circular change so it's
        // easier to simply push the data into the criteria so it's cached and
        // later restored properly (all but pageIndex)
        criteria.$control.$pageSize = this.paginator.pageSize||DEFAULT_PAGE_SIZE;
        criteria.$control.$pageIndex = this.paginator.pageIndex;
        criteria.$control.$sortDirection = this.currentSorter.direction;
        criteria.$control.$sortActive = this.currentSorter.active;
        console.log('SearchService.search',criteria);
        let qargs:any = {
            ...BASE_QUERY_ARGS,
            $top: criteria.$control.$pageSize,
            $skip: criteria.$control.$pageIndex * criteria.$control.$pageSize,
            $ellipsis: '300',
            $orderby: `${criteria.$control.$sortDirection === 'desc' ? '-' : ''}${criteria.$control.$sortActive}`,
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
                            }
                            if(this.currentCriteria) {
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
            params.$filter = $f && $filter ? `${$f} and ${$filter}` : ($f ? $f : $filter);
        }
        if(criteria && criteria.$text) {
            params.$text = criteria.$text;
        }
        if($contains) {
            params.$contains = $contains;
        }
        return this.http.get<T []>(this.config.qualifyApiUrl('/item/distinct'),{ params: params });
    }

    distinct<T>($select:string,$filter?:string,$contains?:string,unfiltered?:boolean):Observable<T []> {
        return this._distinct(unfiltered ? null : this.currentCriteria,$select,$filter,$contains);
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
                this.summaryRunning = true;
                return this.http.get<any>(this.config.qualifyApiUrl('/item/summaryStatistics'),{params:params})
                    .pipe(tap(() => this.summaryRunning = false));
            })
        );
    }
}

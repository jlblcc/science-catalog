import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {DataSource} from '@angular/cdk/collections';
import {Observable} from 'rxjs/Observable';

import 'rxjs/add/operator/map';
import 'rxjs/add/operator/toPromise';

const API_ROOT = '/api/';

@Injectable()
export class CatalogService {
    fetchedLccs = {};

    constructor(private http:HttpClient) {}

    lcc(lccId:string):Promise<LCC> {
        return this.fetchedLccs[lccId] ?
            Promise.resolve(this.fetchedLccs[lccId]) :
            new Promise((resolve,reject) => {
                this.http.get(`${API_ROOT}lcc/${lccId}`)
                    .toPromise()
                    .then((lcc:LCC) => {
                        resolve(this.fetchedLccs[lccId] = lcc);

                    })
                    .catch(reject);
            });
    }

    lccs():Observable<LCC[]> {
        return this.http.get<LCCListResponse>(`${API_ROOT}lcc`).map(response => response.list.map(lcc => {
            lcc.lastSync = new Date(lcc.lastSync);
            return lcc;
        }));
    }

    lccsDataSource():LCCListDataSource {
        return new LCCListDataSource(this);
    }

    private projectReport(report:string,lccid?:string):Observable<any> {
        // building URLs feels like bad form...
        let url = lccid ?
            `${API_ROOT}lcc/${lccid}/${report}` :
            `${API_ROOT}item/${report}`;
        return this.http.get(url);
    }

    projectStatusReport(lccid?:string):Observable<any> {
        return this.projectReport(lccid ?  'item_status_report' : 'status_report',lccid);
    }

    projectFundingReport(lccid?:string):Observable<any> {
        return this.projectReport(lccid ?  'item_funding_report' : 'funding_report',lccid);
    }
}

export interface LCCListResponse {
    list: LCC[];
}

export interface LCC {
    _id: string;
    title: string;
    lastSync: Date;
    projectCount: number;
    _links: any;
}

export class LCCListDataSource extends DataSource<any> {
    constructor(private catalog:CatalogService) {
        super();
    }

    connect(): Observable<LCC[]> {
        return this.catalog.lccs();
    }

    disconnect() {}
}

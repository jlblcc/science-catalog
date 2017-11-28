import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {DataSource} from '@angular/cdk/collections';
import {Observable} from 'rxjs/Observable';
import 'rxjs/add/observable/of';

import 'rxjs/add/operator/map';

const API_ROOT = '/api/';

@Injectable()
export class CatalogService {
    constructor(private http:HttpClient) {}

    lccs():Observable<LCC[]> {
        return this.http.get<LCCListResponse>(`${API_ROOT}lcc`).map(response => response.list.map(lcc => {
            lcc.lastSync = new Date(lcc.lastSync);
            return lcc;
        }));
    }

    lccsDataSource():LCCListDataSource {
        return new LCCListDataSource(this);
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

import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormControl } from '@angular/forms';

import { Observable } from 'rxjs/Observable';
import { map } from 'rxjs/operators';

import { LccIfc } from '../../../../src/db/models';

@Component({
    selector: 'lcc-select',
    template: `
    <mat-form-field>
        <mat-select placeholder="LCC(s)" [formControl]="control" multiple>
            <mat-option *ngFor="let lcc of lccs | async" [value]="lcc._id">{{lcc.title | lccTitle}}</mat-option>
        </mat-select>
    </mat-form-field>
    `,
    styles:[`
        mat-form-field {
            display: block;
        }
    `]
})
export class LccSelect {
    lccs:Observable<LccIfc[]>;
    control:FormControl = new FormControl([]);

    constructor(private http:HttpClient){}

    ngOnInit() {
        this.lccs = this.http.get('/api/lcc',{params:{$orderby:'title'}})
            .pipe(
                map((response:any) => response.list as LccIfc[])
            );
    }
}

import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';

import { Observable } from 'rxjs/Observable';
import { map } from 'rxjs/operators';

import { SearchService } from './search.service';
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
    control:FormControl;

    constructor(private search:SearchService){
        let initial = search.initial;
        this.control = new FormControl(initial ? initial.lcc||[] : []);
    }

    ngOnInit() {
        this.lccs = this.search.lccs();
    }
}

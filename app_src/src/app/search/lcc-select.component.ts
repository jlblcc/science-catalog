import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { SearchService, SearchControl } from './search.service';
import { LccIfc } from '../../../../src/db/models';

@Component({
    selector: 'lcc-select',
    template: `
    <mat-form-field>
        <mat-select placeholder="Filter by LCC(s)" [formControl]="control" multiple>
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
export class LccSelect implements SearchControl {
    lccs:Observable<LccIfc[]>;
    control:FormControl;

    constructor(private search:SearchService){
        let initial = search.initial;
        this.control = new FormControl(initial ? initial.lcc||[] : []);
        search.register(this);
    }

    ngOnInit() {
        this.lccs = this.search.lccs();
    }

    reset() {
        this.control.setValue(null,{emitEvent:false});
    }
}

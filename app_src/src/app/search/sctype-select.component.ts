import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';

import { MatButtonToggleChange } from '@angular/material';

import { SearchService, SearchControl } from './search.service';

@Component({
    selector: 'sctype-select',
    template: `
    <mat-radio-group [formControl]="control">
        <mat-radio-button [value]="null">All</mat-radio-button>
        <mat-radio-button [value]="'project'">Projects only</mat-radio-button>
        <mat-radio-button [value]="'product'">Products only</mat-radio-button>
    </mat-radio-group>
    `,
    styles:[`
        mat-radio-button {
            padding-right: 10px;
        }
    `]
})
export class SctypeSelect implements SearchControl {
    control:FormControl;

    constructor(private search:SearchService) {
        let initial = search.initial,
            scType = initial ? initial.scType : null;
        this.control = new FormControl(scType);
        search.register(this);
    }

    reset() {
        this.control.setValue(null,{emitEvent:false});
    }
}

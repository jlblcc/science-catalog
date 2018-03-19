import { Component, Input } from '@angular/core';
import { FormControl } from '@angular/forms';

import { MatAutocompleteSelectedEvent } from '@angular/material';

import { Observable } from 'rxjs/Observable';
import { debounceTime, switchMap, startWith, tap, takeUntil } from 'rxjs/operators';

import { MonitorsDestroy } from '../common';
import { SearchService } from './search.service';

@Component({
    selector: 'distinct-autocomplete',
    template: `
    <mat-form-field>
      <input type="text" matInput [formControl]="typeAhead" [placeholder]="placeholder" [matAutocomplete]="distinctAuto" />
    </mat-form-field>

    <mat-autocomplete #distinctAuto="matAutocomplete" (optionSelected)="optionSelected($event)">
        <mat-option *ngFor="let o of options | async" [value]="o">{{o}}</mat-option>
    </mat-autocomplete>
    `,
    styles:[`
        mat-form-field {
            display: block;
        }
    `]
})
export class DistinctAutocomplete extends MonitorsDestroy {
    @Input() initialValue:any;
    @Input() placeholder:string;
    @Input() distinctProperty:string;
    @Input() containsMode:boolean = false;
    control:FormControl;

    typeAhead:FormControl;
    options:Observable<any[]>;

    constructor(private search:SearchService) {
        super();
    }

    ngOnInit() {
        this.control = new FormControl(this.initialValue);
        this.typeAhead = new FormControl(this.initialValue);
        this.options = this.typeAhead.valueChanges.pipe(
                takeUntil(this.componentDestroyed),
                debounceTime(500),
                startWith(this.initialValue),
                tap(v => {
                    if(!v && this.control.value) {
                        this.control.setValue(null);
                    }
                }),
                switchMap(v => this.search.liveDistinct<any>(
                    this.distinctProperty,
                    !this.containsMode ? `contains(${this.distinctProperty},'${v}')` : null,
                    this.containsMode ? v : null,
                    true /* fire immediately */))
            ).pipe(
                tap((arr:any[]) => arr.length ? this.typeAhead.enable({emitEvent:false}) : this.typeAhead.disable({emitEvent:false}))
            );
    }

    optionSelected(event:MatAutocompleteSelectedEvent) {
        this.control.setValue(event.option.value);
    }
}

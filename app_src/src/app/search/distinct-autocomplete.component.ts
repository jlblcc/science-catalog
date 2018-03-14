import { Component, Input } from '@angular/core';
import { FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { MatAutocompleteSelectedEvent } from '@angular/material';

import { Observable } from 'rxjs/Observable';
import { debounceTime, switchMap } from 'rxjs/operators';

@Component({
    selector: 'distinct-autocomplete',
    template: `
    <mat-form-field>
      <input type="text" matInput [formControl]="typeAhead" [placeholder]="placeholder" [matAutocomplete]="distinctAuto" />
    </mat-form-field>

    <mat-autocomplete #distinctAuto="matAutocomplete" (optionSelected)="optionSelected($event)">
        <mat-option *ngFor="let o of options | async" [value]="o">{{o}}</mat-option>
    </mat-autocomplete>
    `
})
export class DistinctAutocomplete {
    @Input() placeholder:string;
    @Input() distinctProperty:string;
    @Input() containsMode:boolean = false;
    control:FormControl = new FormControl();

    typeAhead:FormControl = new FormControl();
    options:Observable<any[]>;

    constructor(private http:HttpClient) {}

    ngOnInit() {
        this.options = this.typeAhead.valueChanges.pipe(
                debounceTime(500),
                switchMap(v => {
                    let params:any = {
                        $select: this.distinctProperty
                    };
                    if(this.containsMode) {
                        params.$contains = v;
                    } else {
                        params.$filter = `contains(${this.distinctProperty},'${v}')`;
                    }
                    return this.http.get<any []>('/api/item/distinct',{ params: params});
                })
            )
    }

    optionSelected(event:MatAutocompleteSelectedEvent) {
        this.control.setValue(event.option.value);
    }
}

import { Component, Input } from '@angular/core';
import { FormControl } from '@angular/forms';

import { Observable } from 'rxjs/Observable';
import { tap } from 'rxjs/operators';

import { SearchService } from './search.service';

@Component({
    selector: 'distinct-select',
    template: `
    <mat-form-field>
        <mat-select [placeholder]="placeholder" [formControl]="control" multiple>
            <mat-option *ngFor="let o of options | async" [value]="o">{{o}}</mat-option>
        </mat-select>
    </mat-form-field>
    `
})
export class DistinctSelect {
    @Input() initialValue:any[];
    @Input() placeholder:string;
    @Input() distinctProperty:string;
    control:FormControl;

    options:Observable<any[]>;

    constructor(private search:SearchService) {}

    ngOnInit() {
        this.control = new FormControl(this.initialValue);
        this.options = this.search.liveDistinct<any>(this.distinctProperty)
            .pipe(
                tap((arr:any[]) => arr.length ? this.control.enable({emitEvent:false}) : this.control.disable({emitEvent:false}))
            );
    }
}

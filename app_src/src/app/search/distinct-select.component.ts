import { Component, Input } from '@angular/core';
import { FormControl } from '@angular/forms';

import { Observable } from 'rxjs/Observable';

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
    @Input() placeholder:string;
    @Input() distinctProperty:string;
    control:FormControl = new FormControl();

    options:Observable<any[]>;

    constructor(private search:SearchService) {}

    ngOnInit() {
        this.options = this.search.distinct<any>(this.distinctProperty);
    }
}

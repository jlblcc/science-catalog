import { Component, Input } from '@angular/core';
import { FormControl } from '@angular/forms';

import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { SearchService, SearchControl } from './search.service';
import { MD_CODES } from './md-codes';

@Component({
    selector: 'distinct-select',
    template: `
    <mat-form-field>
        <mat-select [placeholder]="placeholder" [formControl]="control" [multiple]=multiple>
            <mat-option *ngFor="let o of options | async" [value]="o">
              <span *ngIf="displayPipe === 'resourceType'; else plainText">{{o | resourceType}}</span>
              <ng-template #plainText>{{o}}</ng-template>
              <mat-icon *ngIf="mdCode && MD_CODES[mdCode] && MD_CODES[mdCode][o]" class="option-help" fontIcon="fa-question-circle" [matTooltip]="MD_CODES[mdCode][o]"></mat-icon>
            </mat-option>
        </mat-select>
    </mat-form-field>
    `
})
export class DistinctSelect implements SearchControl {
    MD_CODES:any = MD_CODES;
    // this is not very generic, but this is a small app so...
    @Input() displayPipe:string;
    @Input() multiple:boolean = true;

    @Input() initialValue:any[];
    @Input() placeholder:string;
    @Input() distinctProperty:string;
    @Input() mdCode:string;
    control:FormControl;

    options:Observable<any[]>;

    constructor(private search:SearchService) {
        search.register(this);
    }

    reset() {
        this.control.setValue(null,{emitEvent:false});
    }

    ngOnInit() {
        this.control = new FormControl(this.initialValue);
        this.options = this.search.liveDistinct<any>(this.distinctProperty)
            .pipe(
                tap((arr:any[]) => arr.length ? this.control.enable({emitEvent:false}) : this.control.disable({emitEvent:false}))
            );
    }
}

import { Component, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';

import { MatChipList, MatChipEvent } from '@angular/material';

import { Observable } from 'rxjs/Observable';
import { startWith, switchMap, map, tap } from 'rxjs/operators';
import { merge as mergeObservables } from 'rxjs/observable/merge';
import { of as observableOf } from 'rxjs/observable/of';

import { SimplifiedKeywordType } from '../../../../src/db/models';

import { KeywordSearchCriteria, SearchService } from './search.service';

function selectionFound(keywords:KeywordSearchCriteria[],keyword:KeywordSearchCriteria) {
    return !!keywords.reduce((found,kw) => {
        return found || ((kw.typeKey === keyword.typeKey && kw.value === keyword.value) ? kw : undefined);
    },undefined);
}

@Component({
    selector: 'keyword-select',
    template: `
    <div class="keyword-selection">
        <mat-form-field class="keyword-type">
            <mat-select placeholder="Keyword type" [formControl]="keywordTypesControl">
                <mat-option *ngFor="let keywordType of keywordTypes | async" [value]="keywordType">{{keywordType.label}}</mat-option>
            </mat-select>
        </mat-form-field>
        <mat-form-field class="keyword-value">
            <mat-select placeholder="Keyword value" [formControl]="keywordValuesControl">
                <mat-option *ngFor="let v of keywordValues | async" [value]="v">{{v}}</mat-option>
            </mat-select>
        </mat-form-field>
    </div>
    <mat-chip-list>
        <mat-chip *ngFor="let keyword of control.value; index as i" (remove)="removeKeyword(i)">
            {{keyword.typeLabel}} : {{keyword.value}}
            <mat-icon matChipRemove fontIcon="fa-times"></mat-icon>
        </mat-chip>
    </mat-chip-list>
    `,
    styles:[`
        .keyword-selection {
            display: flex;
            flex-wrap: wrap;
        }
        .keyword-selection >mat-form-field {
            flex-grow: 1;
        }
        .keyword-selection .keyword-type {
            margin-right: 10px;
        }
    `]
})
export class KeywordSelect {
    keywordTypes:Observable<SimplifiedKeywordType[]>;
    keywordTypesControl:FormControl = new FormControl();

    keywordValues:Observable<string []>
    keywordValuesControl:FormControl = new FormControl();

    /** Publishes the keyword filter selection to the outside world */
    control:FormControl = new FormControl([]);

    @ViewChild(MatChipList) keywordChips:MatChipList;

    constructor(private search:SearchService) {}

    ngOnInit() {
        this.keywordTypes = this.search.liveDistinct<SimplifiedKeywordType>('simplified.keywords.types')
            .pipe(
                map((types:SimplifiedKeywordType[]) => types.sort((a,b) => a.label.localeCompare(b.label)))
            );
        this.keywordValues = this.keywordTypesControl.valueChanges
            .pipe(
                startWith(null),
                switchMap(() => {
                    let keywordType = this.keywordTypesControl.value;
                    console.log(`keywordTypesControl:change`, keywordType);
                    this.keywordValuesControl.setValue(null);
                    this.keywordValuesControl.disable();
                    if(!keywordType) {
                        return observableOf([]);
                    }
                    return this.search.distinct<string>(`simplified.keywords.keywords.${keywordType.type}`)
                        .pipe(
                            tap((arr:any[]) => arr.length ? this.keywordValuesControl.enable({emitEvent:false}) : this.keywordValuesControl.disable({emitEvent:false}))
                        );
                })
            );
        this.keywordValuesControl.valueChanges
            .subscribe((keywordValue) => {
                console.log('keywordValuesControl:change',keywordValue);
                if(keywordValue) {
                    let keywordType = this.keywordTypesControl.value,
                        selection:KeywordSearchCriteria = {
                            typeKey: keywordType.type,
                            typeLabel: keywordType.label,
                            value: keywordValue
                        };
                    if(!selectionFound(this.control.value,selection)) {
                        let newValue = this.control.value.slice(0);
                        newValue.push(selection);
                        this.control.setValue(newValue);
                    }
                }
                this.keywordValuesControl.setValue(null,{emitEvent:false}); // clear the selection
                // disable the control until another type is picked, the list of selectable options
                // remains based on the previously selected keyword type.
                this.keywordValuesControl.disable({emitEvent:false});
            });
    }

    removeKeyword(index) {
        let newValue = this.control.value.slice(0);
        newValue.splice(index,1);
        this.control.setValue(newValue);
    }
}

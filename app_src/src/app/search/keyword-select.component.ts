import { Component, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { MatChipList, MatChipEvent } from '@angular/material';

import { Observable } from 'rxjs/Observable';
import { startWith, switchMap, map, tap } from 'rxjs/operators';
import { merge as mergeObservables } from 'rxjs/observable/merge';
import { of as observableOf } from 'rxjs/observable/of';

import { SctypeSelect } from './sctype-select.component';

import { SimplifiedKeywordType } from '../../../../src/db/models';

export interface KeywordFilterSelection {
    typeKey:string;
    typeLabel:string;
    value:string;
}

function selectionFound(keywords:KeywordFilterSelection[],keyword:KeywordFilterSelection) {
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
    `]
})
export class KeywordSelect {
    sctypeSelect:SctypeSelect;

    keywordTypes:Observable<SimplifiedKeywordType[]>;
    keywordTypesControl:FormControl = new FormControl();

    keywordValues:Observable<string []>
    keywordValuesControl:FormControl = new FormControl();

    /** Publishes the keyword filter selection to the outside world */
    control:FormControl = new FormControl([]);

    @ViewChild(MatChipList) keywordChips:MatChipList;

    constructor(private http:HttpClient) {}

    ngOnInit() {
        this.keywordTypes = this.sctypeSelect.control.valueChanges
            .pipe(
                startWith(null), // initially not filtering by type
                tap(scType => {
                    if(scType) {
                        this.control.setValue([]);
                        this.keywordTypesControl.setValue(null);
                    }
                }),
                switchMap(scType => this.http.get<SimplifiedKeywordType[]>('/api/item/keywordTypes',{
                        params: scType ? { scType: scType } : {}
                    }))
            );
        this.keywordValues = mergeObservables(this.keywordTypesControl.valueChanges, this.sctypeSelect.control.valueChanges)
            .pipe(
                startWith(null),
                switchMap(() => {
                    let keywordType = this.keywordTypesControl.value;
                    console.log(`keyword type or sctype change`, keywordType);
                    this.keywordValuesControl.setValue(null);
                    this.keywordValuesControl.disable();
                    if(!keywordType) {
                        return observableOf([]);
                    }
                    const params:any = {
                        keywordType: keywordType.type
                    };
                    if(this.sctypeSelect.control.value) {
                        params.scType = this.sctypeSelect.control.value;
                    }
                    return this.http.get<string[]>('/api/item/keywordsByType',{ params: params })
                        .pipe(
                            tap(values => {
                                if(values.length) {
                                    this.keywordValuesControl.enable();
                                }
                            })
                        );
                })
            );
        this.keywordValuesControl.valueChanges
            .subscribe((keywordValue) => {
                console.log('keyword value change',keywordValue);
                if(keywordValue) {
                    let keywordType = this.keywordTypesControl.value,
                        selection:KeywordFilterSelection = {
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
            });
        this.keywordChips.change.asObservable().subscribe(v => console.log(`chipChange`,v))
    }

    removeKeyword(index) {
        let newValue = this.control.value.slice(0);
        newValue.splice(index,1);
        this.control.setValue(newValue);
    }
}

import { Component, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';

import { MatChipList, MatChipEvent } from '@angular/material';

import { Observable ,  merge as mergeObservables ,  of as observableOf } from 'rxjs';
import { startWith, switchMap, map, tap, takeUntil } from 'rxjs/operators';

import { SimplifiedKeywordType } from '../../../../src/db/models';

import { MonitorsDestroy } from '../common';
import { KeywordSearchCriteria, KeywordCriteria, SearchService, SearchControl } from './search.service';

function selectionFound(keywords:KeywordCriteria[],keyword:KeywordCriteria) {
    return !!keywords.reduce((found,kw) => {
        return found || ((kw.typeKey === keyword.typeKey && kw.value === keyword.value) ? kw : undefined);
    },undefined);
}

@Component({
    selector: 'keyword-select',
    template: `
    <mat-radio-group [formControl]="logicalOperatorControl" *ngIf="control.value.criteria.length > 1">
      <mat-radio-button value="and">All keywords match</mat-radio-button>
      <mat-radio-button value="or">Any keyword matches</mat-radio-button>
    </mat-radio-group>
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
        <mat-chip *ngFor="let keyword of control.value.criteria; index as i" (removed)="removeKeyword(i)">
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
export class KeywordSelect extends MonitorsDestroy implements SearchControl {
    keywordTypes:Observable<SimplifiedKeywordType[]>;
    keywordTypesControl:FormControl = new FormControl();
    logicalOperatorControl:FormControl;

    keywordValues:Observable<string []>
    keywordValuesControl:FormControl = new FormControl();

    /** Publishes the keyword filter selection to the outside world */
    control:FormControl;

    @ViewChild(MatChipList) keywordChips:MatChipList;

    constructor(private search:SearchService) {
        super();
        let initial = search.initial,
            logical,criteria;
        if(initial && initial.keywords) {
            logical = initial.keywords.logicalOperator;
            criteria = initial.keywords.criteria;
        }
        this.logicalOperatorControl = new FormControl(logical||'and');
        this.control = new FormControl({
            logicalOperator: this.logicalOperatorControl.value,
            criteria: criteria||[]
        });
        search.register(this);
    }

    reset() {
        this.logicalOperatorControl.setValue('and',{emitEvent:false});
        this.control.setValue({
            logicalOperator: 'and',
            criteria: []
        },{emitEvent:false});
    }

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
                    //console.log(`keywordTypesControl:change`, keywordType);
                    this.keywordValuesControl.setValue(null);
                    this.keywordValuesControl.disable();
                    if(!keywordType) {
                        return observableOf([]);
                    }
                    return this.search.liveDistinct<string>(`simplified.keywords.keywords.${keywordType.type}`,null,null,true)
                        .pipe(
                            tap((arr:any[]) => arr.length ? this.keywordValuesControl.enable({emitEvent:false}) : this.keywordValuesControl.disable({emitEvent:false}))
                        );
                })
            );
        this.keywordValuesControl.valueChanges
            .pipe(
                takeUntil(this.componentDestroyed)
            )
            .subscribe((keywordValue) => {
                //console.log('keywordValuesControl:change',keywordValue);
                if(keywordValue) {
                    let keywordType = this.keywordTypesControl.value,
                        selection:KeywordCriteria = {
                            typeKey: keywordType.type,
                            typeLabel: keywordType.label,
                            value: keywordValue
                        };
                    if(!selectionFound(this.control.value.criteria,selection)) {
                        let v = this.control.value;
                        v.criteria.push(selection);
                        this.control.setValue(v);
                    }
                }
                this.keywordValuesControl.setValue(null,{emitEvent:false}); // clear the selection
                // disable the control until another type is picked, the list of selectable options
                // remains based on the previously selected keyword type.
                this.keywordValuesControl.disable({emitEvent:false});
            });
        this.logicalOperatorControl.valueChanges
            .pipe(
                takeUntil(this.componentDestroyed)
            )
            .subscribe(logicalOperator => {
                this.control.value.logicalOperator = logicalOperator;
                this.control.setValue(this.control.value);
            });
    }

    removeKeyword(index) {
        let v = this.control.value;
        v.criteria.splice(index,1);
        this.control.setValue(v);
    }
}

import { Component, ViewChild } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

import { debounceTime, takeUntil } from 'rxjs/operators';

import { MonitorsDestroy } from '../common';
import { DistinctAutocomplete } from './distinct-autocomplete.component';
import { DistinctSelect } from './distinct-select.component';
import { SearchService, FundingSearchCriteria, SearchControl } from './search.service';

@Component({
    selector: 'funding-search-controls',
    template: `
    <mat-expansion-panel class="funding" expanded="false">
        <mat-expansion-panel-header>Funding</mat-expansion-panel-header>
            <div class="general-controls">
                <mat-radio-group [formControl]="match">
                     <mat-radio-button [value]="null">All</mat-radio-button>
                     <mat-radio-button [value]="false">Agency Funding Only</mat-radio-button>
                     <mat-radio-button [value]="true">Matching/In-Kind Only</mat-radio-button>
                </mat-radio-group>
            </div>
            <div class="source-recipient-pair">
                <distinct-select #sourceType class="type"
                                 placeholder="Funding source type(s)"
                                 distinctProperty="simplified.funding.sources.contactType"
                                 [initialValue]="initialValues.sourceType"></distinct-select>
                <distinct-autocomplete #source class="source-recipient"
                                       placeholder="Funding source"
                                       distinctProperty="simplified.funding.sources.name"
                                       containsMode="true"
                                       [initialValue]="initialValues.source"></distinct-autocomplete>
            </div>
            <div class="source-recipient-pair">
                <distinct-select #recipientType class="type"
                                 placeholder="Funding recipient type(s)"
                                 distinctProperty="simplified.funding.recipients.contactType"
                                 [initialValue]="initialValues.recipientType"></distinct-select>
                <distinct-autocomplete #recipient class="source-recipient"
                                       placeholder="Funding recipient"
                                       distinctProperty="simplified.funding.recipients.name"
                                       containsMode="true"
                                       [initialValue]="initialValues.recipient"></distinct-autocomplete>
            </div>
            <mat-form-field class="funding-range">
                <mat-select placeholder="Funding amount" [formControl]="fundingRange">
                    <mat-option *ngFor="let range of fundingRanges" [value]="range">
                        <span *ngIf="range; else nullRange">
                            {{range[0] | currency:'USD':'symbol':'1.0-0'}}
                            <span *ngIf="range.length === 2; else openEndedRange"> -  {{range[1] | currency:'USD':'symbol':'1.0-0'}}</span>
                            <ng-template #openEndedRange> and up</ng-template>
                        </span>
                        <ng-template #nullRange>Any</ng-template>
                    </mat-option>
                </mat-select>
            </mat-form-field>
            <distinct-autocomplete #awardId class="award-id"
                                   placeholder="Award ID"
                                   distinctProperty="simplified.funding.awardIds"
                                   containsMode="true"
                                   [initialValue]="initialValues.awardId"></distinct-autocomplete>
    </mat-expansion-panel>
    `,
    styles:[`
        .general-controls,
        .source-recipient-pair{
            display: flex;
            align-items: center;
        }
        .source-recipient-pair .source-recipient {
            flex-grow: 1;
            margin-right: 0px;
        }
        distinct-select,
        distinct-autocomplete,
        mat-form-field {
            margin-right: 10px;
        }
        .award-id {
            display: inline-block;
        }
        mat-radio-button {
            margin-right: 15px;
        }
    `]
})
export class FundingSearchControls extends MonitorsDestroy implements SearchControl {
    initialValues:FundingSearchCriteria;
    controls:FormGroup = new FormGroup({});

    match:FormControl;
    fundingRange:FormControl;

    @ViewChild('awardId') awardId:DistinctAutocomplete;
    @ViewChild('sourceType') sourceType:DistinctSelect;
    @ViewChild('source') source:DistinctAutocomplete;
    @ViewChild('recipientType') recipientType:DistinctSelect;
    @ViewChild('recipient') recipient:DistinctAutocomplete;

    fundingRanges = [
        null,
        [1,12499],
        [12500,24999],
        [25000,49999],
        [50000,99999],
        [100000,199999],
        [200000,499999],
        [500000]
    ];

    constructor(private search:SearchService) {
        super();
        let initial = search.initial;
        this.initialValues = initial ? initial.funding||{} : {};
        this.match = new FormControl(this.initialValues.match);
        const initRange = this.initialValues.amountRange;
        this.fundingRange = new FormControl (
            initRange ?
            // mat-select works by reference so the array must be the exact one.
            // only need to compare index 0 since they're all unique
            this.fundingRanges.reduce((found,range) => {
                return found||((range && initRange.length === range.length && initRange[0] === range[0]) ? range : null);
            },null) : null
        );
        search.register(this);
    }

    reset() {
        this.match.setValue(null,{emitEvent:false});
        this.fundingRange.setValue(null,{emitEvent:false});
    }

    ngAfterViewInit() {
        this.controls.addControl('awardId',this.awardId.control);
        this.controls.addControl('match',this.match);

        this.controls.addControl('sourceType',this.sourceType.control);
        this.controls.addControl('source',this.source.control);

        this.controls.addControl('recipientType',this.recipientType.control);
        this.controls.addControl('recipient',this.recipient.control);
        this.controls.addControl('amountRange',this.fundingRange);
    }
}

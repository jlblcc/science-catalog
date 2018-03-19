import { Component, ViewChild } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

import { debounceTime } from 'rxjs/operators';

import { DistinctAutocomplete } from './distinct-autocomplete.component';
import { DistinctSelect } from './distinct-select.component';
import { SearchService, FundingSearchCriteria } from './search.service';

@Component({
    selector: 'funding-search-controls',
    template: `
    <mat-expansion-panel class="funding" expanded="true">
        <mat-expansion-panel-header>Funding</mat-expansion-panel-header>
            <div class="general-controls">
                <distinct-select #fiscalYears
                                 placeholder="Fiscal year(s)"
                                 distinctProperty="simplified.funding.fiscalYears"
                                 [initialValue]="initialValues.fiscalYears"></distinct-select>
                <distinct-autocomplete #awardId
                                       placeholder="Award ID"
                                       distinctProperty="simplified.funding.awardIds"
                                       containsMode="true"
                                       [initialValue]="initialValues.awardId"></distinct-autocomplete>
                <mat-radio-group [formControl]="match">
                         <mat-radio-button [value]="true">Matching/In-Kind</mat-radio-button>
                         <mat-radio-button [value]="false">Not Matching/In-Kind</mat-radio-button>
                         <mat-radio-button [value]="null">Either</mat-radio-button>
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
            <div class="amount-range">
                <mat-form-field>
                    <input matInput type="number" placeholder="Funding amount >=" [formControl]="lowerAmountInput" min="0" step="1000" />
                </mat-form-field>
                <mat-form-field>
                    <input matInput type="number" placeholder="Funding amount <=" [formControl]="upperAmountInput" min="0" step="1000" />
                </mat-form-field>
            </div>
    </mat-expansion-panel>
    `,
    styles:[`
        .general-controls,
        .source-recipient-pair,
        .amount-range {
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
    `]
})
export class FundingSearchControls {
    initialValues:FundingSearchCriteria;
    controls:FormGroup = new FormGroup({});

    match:FormControl;
    lowerAmountInput:FormControl;
    upperAmountInput:FormControl;
    @ViewChild('fiscalYears') fiscalYears:DistinctSelect;
    @ViewChild('awardId') awardId:DistinctAutocomplete;
    @ViewChild('sourceType') sourceType:DistinctSelect;
    @ViewChild('source') source:DistinctAutocomplete;
    @ViewChild('recipientType') recipientType:DistinctSelect;
    @ViewChild('recipient') recipient:DistinctAutocomplete;

    constructor(private search:SearchService) {
        let initial = search.initial;
        this.initialValues = initial ? initial.funding : {};
        this.match = new FormControl(this.initialValues.match);
        this.lowerAmountInput = new FormControl(this.initialValues.lowerAmount);
        this.upperAmountInput = new FormControl(this.initialValues.upperAmount);
    }

    ngAfterViewInit() {
        this.controls.addControl('fiscalYears',this.fiscalYears.control);
        this.controls.addControl('awardId',this.awardId.control);
        this.controls.addControl('match',this.match);

        this.controls.addControl('sourceType',this.sourceType.control);
        this.controls.addControl('source',this.source.control);

        this.controls.addControl('recipientType',this.recipientType.control);
        this.controls.addControl('recipient',this.recipient.control);

        const lowerAmount = new FormControl();
        this.controls.addControl('lowerAmount', lowerAmount);
        this.lowerAmountInput.valueChanges.pipe(debounceTime(500)).subscribe(v => lowerAmount.setValue(v));

        const upperAmount = new FormControl();
        this.controls.addControl('upperAmount',upperAmount);
        this.upperAmountInput.valueChanges.pipe(debounceTime(500)).subscribe(v => upperAmount.setValue(v));
    }
}

import { Component, ViewChild } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

import { MonitorsDestroy } from '../common';
import { DistinctSelect } from './distinct-select.component';
import { DistinctAutocomplete } from './distinct-autocomplete.component';
import { KeywordSelect } from './keyword-select.component';
import { SearchService, SearchControl, GeneralAdvancedCriteria } from './search.service';

@Component({
    selector: 'general-advanced-controls',
    template: `
    <distinct-select #resourceType class="resource-type"
                 placeholder="Resource type"
                 displayPipe="resourceType"
                 mdCode="MD_ScopeCode"
                 distinctProperty="simplified.combinedResourceType.type"
                 [initialValue]="initialValue.resourceType"></distinct-select>
    <distinct-select #status class="status"
                  placeholder="Status"
                  distinctProperty="simplified.status"
                  [initialValue]="initialValue.status"></distinct-select>
    <distinct-select #fiscalYears class="fiscal-years"
                 placeholder="Years funded"
                 distinctProperty="simplified.funding.fiscalYears"
                 [initialValue]="initialValue.fiscalYears"></distinct-select>
    <mat-checkbox [formControl]="dataDotGov">data.gov items</mat-checkbox>

    <distinct-autocomplete #leadOrgNames class="lead-org-name"
                        placeholder="Lead organization"
                        distinctProperty="simplified.leadOrgNames"
                        containsMode="true"
                        [initialValue]="initialValue.leadOrgNames"></distinct-autocomplete>
    <distinct-autocomplete #assocOrgNames class="assoc-org-name"
                        placeholder="Partner organization"
                        distinctProperty="simplified.assocOrgNames"
                        containsMode="true"
                        [initialValue]="initialValue.assocOrgNames"></distinct-autocomplete>

    <keyword-select></keyword-select>
    `,
    styles: [`
        :host {
            display: flex;
            flex-wrap: wrap;
            flex-direction: row;
            align-items: baseline;
        }

        distinct-select {
            padding-right: 10px;
        }
        mat-checkbox {
            padding-left: 10px;
        }
        distinct-select:last-of-type {
            padding-right: 0px;
        }
        .assoc-org-name,
        .lead-org-name {
            flex-basis: 50%;
        }
        .lead-org-name {
            padding-right: 10px;
        }
        keyword-select {
            margin-bottom: 15px;
            flex-basis: 100%;
        }
    `]

})
export class GeneralAdvancedControls extends MonitorsDestroy implements SearchControl {
    initialValue:GeneralAdvancedCriteria;
    controls:FormGroup = new FormGroup({});
    /** The resourceType control */
    @ViewChild('resourceType') resourceType: DistinctSelect;
    /** The fiscalYears control */
    @ViewChild('fiscalYears') fiscalYears: DistinctSelect;
    /** The status control */
    @ViewChild('status') status: DistinctSelect;
    /** The assocOrgNames control */
    @ViewChild('assocOrgNames') assocOrgNames: DistinctAutocomplete;
    /** The leadOrgNames control */
    @ViewChild('leadOrgNames') leadOrgNames: DistinctAutocomplete;
    /** The keyword selection component (advanced) */
    @ViewChild(KeywordSelect) keywords: KeywordSelect;
    dataDotGov: FormControl;

    constructor(private search:SearchService) {
        super();
        let initial = search.initial;
        this.initialValue = initial ? initial.general||{} : {};
        this.dataDotGov = new FormControl(this.initialValue.dataDotGov);
        search.register(this);
    }

    reset() {
        this.dataDotGov.setValue(null,{emitEvent:false});
    }

    ngAfterViewInit() {
        this.controls.addControl('resourceType',this.resourceType.control);
        this.controls.addControl('fiscalYears',this.fiscalYears.control);
        this.controls.addControl('keywords',this.keywords.control);
        this.controls.addControl('status',this.status.control);
        this.controls.addControl('assocOrgNames',this.assocOrgNames.control);
        this.controls.addControl('leadOrgNames',this.leadOrgNames.control);
        this.controls.addControl('dataDotGov',this.dataDotGov);
    }
}

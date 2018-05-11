import { Component, ViewChild } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

import { MonitorsDestroy } from '../common';
import { DistinctSelect } from './distinct-select.component';
import { KeywordSelect } from './keyword-select.component';
import { SearchService, GeneralAdvancedCriteria } from './search.service';

@Component({
    selector: 'general-advanced-controls',
    template: `
    <distinct-select #resourceType class="resource-type"
                     placeholder="Resource type"
                     displayPipe="resourceType"
                     distinctProperty="simplified.combinedResourceType.type"
                     [initialValue]="initialValue.resourceType"></distinct-select>
    <distinct-select #fiscalYears class="fiscal-years"
                     placeholder="Years funded"
                     distinctProperty="simplified.funding.fiscalYears"
                     [initialValue]="initialValue.fiscalYears"></distinct-select>
    <keyword-select></keyword-select>
    `,
    styles: [`
    keyword-select {
        margin-bottom: 15px;
    }
    .resource-type {
        margin-right: 10px;
    }
    `]

})
export class GeneralAdvancedControls extends MonitorsDestroy {
    initialValue:GeneralAdvancedCriteria;
    controls:FormGroup = new FormGroup({});
    /** The resourceType control */
    @ViewChild('resourceType') resourceType: DistinctSelect;
    /** The fiscalYears control */
    @ViewChild('fiscalYears') fiscalYears: DistinctSelect;
    /** The keyword selection component (advanced) */
    @ViewChild(KeywordSelect) keywords: KeywordSelect;

    constructor(private search:SearchService) {
        super();
        let initial = search.initial;
        this.initialValue = initial ? initial.general||{} : {};
    }

    ngAfterViewInit() {
        this.controls.addControl('resourceType',this.resourceType.control);
        this.controls.addControl('fiscalYears',this.fiscalYears.control);
        this.controls.addControl('keywords',this.keywords.control);
    }
}

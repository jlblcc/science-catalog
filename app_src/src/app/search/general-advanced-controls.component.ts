import { Component, ViewChild } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

import { MonitorsDestroy } from '../common';
import { DistinctSelect } from './distinct-select.component';
import { SearchService, GeneralAdvancedCriteria } from './search.service';

@Component({
    selector: 'general-advanced-controls',
    template: `
    <mat-expansion-panel  expanded="true">
        <mat-expansion-panel-header>General</mat-expansion-panel-header>
        <distinct-select #resourceType
                         placeholder="Resource type"
                         displayPipe="resourceType"
                         distinctProperty="simplified.combinedResourceType.type"
                         [initialValue]="initialValue.resourceType"></distinct-select>
    </mat-expansion-panel>
    `

})
export class GeneralAdvancedControls extends MonitorsDestroy {
    initialValue:GeneralAdvancedCriteria;
    controls:FormGroup = new FormGroup({});
    /** The resourceType control */
    @ViewChild('resourceType') resourceType: DistinctSelect;

    constructor(private search:SearchService) {
        super();
        let initial = search.initial;
        this.initialValue = initial ? initial.general||{} : {};
    }

    ngAfterViewInit() {
        this.controls.addControl('resourceType',this.resourceType.control);
    }
}

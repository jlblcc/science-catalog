import { Component, ViewChild } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

import { DistinctAutocomplete } from './distinct-autocomplete.component';

@Component({
    selector: 'funding-search-controls',
    template: `
    <mat-expansion-panel class="funding" expanded="true">
        <mat-expansion-panel-header>Funding</mat-expansion-panel-header>
        <distinct-autocomplete #fundingSource
                               placeholder="Funding source"
                               distinctProperty="simplified.funding.sources.name"
                               containsMode="true"></distinct-autocomplete>
    </mat-expansion-panel>
    `
})
export class FundingSearchControls {
    controls:FormGroup = new FormGroup({});

    @ViewChild('fundingSource') fundingSource:DistinctAutocomplete;

    ngOnInit() {
        this.controls.addControl('fundingSource',this.fundingSource.control);
    }
}

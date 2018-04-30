import { Component } from '@angular/core';
import { SearchService } from './search.service';
@Component({
    selector: 'reset',
    template: `
    <button class="reset-button" mat-mini-fab matTooltip="Reset the search filter" matTooltipPosition="left" (click)="search.reset()">
        <mat-icon fontIcon="fa-refresh"></mat-icon>
     </button>
    `
})
export class Reset {
    constructor(public search:SearchService){}
}

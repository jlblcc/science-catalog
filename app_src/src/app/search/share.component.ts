import { Component } from '@angular/core';

import { MatSnackBar } from '@angular/material';

import { SearchService } from './search.service';

import { ClipboardService } from 'ngx-clipboard';

@Component({
    selector: 'share',
    template: `
    <button class="share-button" mat-mini-fab matTooltip="Share this search result" matTooltipPosition="left" (click)="share()">
        <mat-icon fontIcon="fa-link"></mat-icon>
     </button>
    `,
    providers:[ClipboardService]
})
export class Share {
    constructor(public search:SearchService,public clipboard:ClipboardService,public snackBar: MatSnackBar){}

    share() {
        this.clipboard.copyFromContent(this.search.getShareableUrl());
        this.snackBar.open('URL copied to clipboard','',{
            duration: 3000
        });
    }
}

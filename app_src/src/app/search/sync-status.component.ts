import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ConfigService } from '../common';

@Component({
    selector: 'sync-status',
    template: `
    <p class="mat-caption">Last Synchronized: <a *ngIf="report" href (click)="download()" alt="report">{{report.lastComplete | date:'short'}}</a>
    <ng-template #unknownSyncStatus>Unknown</ng-template>
    <a id="dlreport" style="display:none;">download</a>
    </p>
    `,
    styles:[`
        :host {
            float: right;
        }
        a {
            text-decoration: none !important;
        }
    `]
})
export class SyncStatus {
    report;

    constructor(private http:HttpClient,
                private config:ConfigService) {
    }

    ngOnInit() {
        this.http.get<any>(this.config.qualifyApiUrl('/pipeline'),{
            params: {
                $filter: "processorId eq 'Report'",
            }
        }).subscribe(response => {
            if(response.list && response.list.length === 1) {
                this.report = response.list[0];
            }
        });
    }

    download() {
        const link = document.querySelector('#dlreport') as HTMLAreaElement;
        link.download = 'lcc_sync_report.txt';
        link.href = `data:text/plain;base64,`+window.btoa(this.report.results.report);
        link.click();
    }
}

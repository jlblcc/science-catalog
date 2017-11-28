import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { CatalogService, LCC } from '../../providers';

@Component({
    template: `<h1 *ngIf="lcc">{{lcc.title}}</h1>
    <project-status-report [lccId]="lccId"></project-status-report>
    `
})
export class LccRouteComponent {
    lcc:LCC;
    lccId:string;

    constructor(private catalog:CatalogService,private route:ActivatedRoute) {}

    ngOnInit() {
        this.lccId = this.route.snapshot.paramMap.get('lccId');
        this.catalog.lcc(this.lccId)
            .then(lcc => this.lcc = lcc);
    }
}

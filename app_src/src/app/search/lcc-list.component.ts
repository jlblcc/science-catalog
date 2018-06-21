import { Component, Input } from "@angular/core";
import { LccTitlePipe } from "./lcc-title.pipe";
import { ItemIfc } from "../../../../src/db/models";

@Component({
    selector: 'lcc-list',
    template: `
    <ul *ngIf="item.simplified.lccs.length < 4; else plusLccs">
        <li *ngFor="let lcc of item.simplified.lccs">{{lcc | lccTitle}}</li>
    </ul>
    <ng-template #plusLccs>
        <ul>
            <li>{{item.simplified.lccs[0] | lccTitle}}</li>
            <li class="collabCount" [matTooltip]="collaborators">Plus {{item.simplified.lccs.length - 1}} LCCs</li>
        </ul>
    </ng-template>
    `,
    styles:[`
    ul {
        margin: 0px;
        padding: 0px;
    }
    ul > li {
        list-style: none;
        margin: 0px;
        padding: 0px;
    }
    li.collabCount {
        font-weight: bold;
        display: inline-block;
    }
    li.collabCount:hover {
        cursor: pointer;
    }
    `]
})
export class LccList {
    @Input() item:ItemIfc;
    collaborators:string;

    constructor(private lccTitles:LccTitlePipe) {}

    ngOnInit() {
        this.collaborators = this.lccTitles.transform(this.item.simplified.lccs.slice(1));
    }
}
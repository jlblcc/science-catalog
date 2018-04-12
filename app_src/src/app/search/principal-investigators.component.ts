import { Component, Input } from '@angular/core';
import { ItemIfc } from '../../../../src/db/models';

interface Investigator {
    text: string;
    href?: string;
    title?: string;
}
@Component({
    selector: 'principal-investigators',
    template: `
    <ul>
        <li *ngFor="let i of investigators">
            <a *ngIf="i.href; else plainText" [href]="i.href" [title]="i.title" [matTooltip]="i.title">{{i.text}}</a>
            <ng-template #plainText>
                <div [matTooltip]="i.title">{{i.text}}</div>
            </ng-template>
        </li>
    </ul>
    `,
    styles:[`
        :host {
            display: inline-block;
        }
        ul {
            list-style: none;
            display: inline-block;
            padding: 0px;
            margin: 0px;
            vertical-align: bottom;
        }
        ul > li {
            float: left;
            padding-right: 5px;
        }
        ul > li > div:hover {
            cursor: pointer;
        }
    `]
})
export class PrincipalInvestigators {
    @Input() item:ItemIfc;

    investigators:Investigator[] = [];

    ngOnInit() {
        if(this.item.simplified.pointOfContact) { // check should not be necessary but it has happened
            this.investigators = (this.item.simplified.pointOfContact.principalInvestigator||[]).map(pi => {
                const inv:Investigator = {
                    text: pi.name,
                    title: pi.name
                };
                if(pi.lccnet) {
                    inv.href = pi.lccnet.url;
                }/* else if (pi.electronicMailAddress && pi.electronicMailAddress.length) {
                    inv.href = `mailto:${pi.electronicMailAddress[0]}`;
                }*/
                if(pi.positionName) {
                    inv.title += ` - ${pi.positionName}`;
                }
                if(pi.memberOfOrganization && pi.memberOfOrganization.length) {
                    inv.title += ` (${pi.memberOfOrganization[0].name})`;
                }
                return inv;
            });
        }
    }
}

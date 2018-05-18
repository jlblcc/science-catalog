import { Component, Input } from '@angular/core';

import { ItemIfc } from '../../../../src/db/models';



@Component({
    selector: 'item-icon',
    template: `
    <mat-icon *ngFor="let rt of item.simplified.resourceType"
        [fontIcon]="FONT_ICONS[rt.type]||UNKNOWN_FONT_ICON"
        matTooltip="{{item.scType === 'product' ? 'Product type: ': ''}}{{rt.type | resourceType}}"
        matTooltipPosition="right"></mat-icon>
    <div *ngIf="extraResourceTypes.length" class="extra-rtypes">
    <mat-icon *ngFor="let rt of extraResourceTypes"
        [fontIcon]="FONT_ICONS[rt.type]||UNKNOWN_FONT_ICON"
        matTooltip="Product type: {{rt.type | resourceType}}"
        matTooltipPosition="right"></mat-icon>
    </div>
    `,
    styles:[`
        .extra-rtypes:before { content: '[ ' }
        .extra-rtypes:after { content: ' ]' }
        .extra-rtypes > mat-icon:last-of-type {
            width: auto;
        }
    `]
})
export class ItemIcon {
    @Input() item:ItemIfc;
    extraResourceTypes:any[] = [];

    ngOnInit() {
        const simplified = this.item.simplified;
        if(simplified.resourceType.length !== simplified.combinedResourceType.length) {
            const hasRt = (rt) => {
                return simplified.resourceType.reduce((has,t) =>
                  has||(t.type === rt.type && t.name === rt.name ? true : false),
                  false);
            };
            simplified.combinedResourceType.forEach(rt => {
                if(!hasRt(rt)) {
                    this.extraResourceTypes.push(rt);
                }
            });
        }
    }

    // built from a distinct query on mdJson.metadata.resourceInfo.resourceType.type
    // so is not future proof
    // IMPORTANT: This is duplicated into the lccnetwork.org app sci_cat.js/scResourceTypeIcons
    readonly FONT_ICONS = {
        "project": "fa-product-hunt",
        "report": "fa-file-text-o",
        "document": "fa-file-o",
        "dataset": "fa-database",
        "factSheet": "fa-file-o",
        "presentation": "fa-file-powerpoint-o",
        "map": "fa-map-o",
        "publication": "fa-book",
        "collection": "fa-bars",
        "website": "fa-link",
        "Journal": "fa-file-text-o",
        "journal": "fa-file-text-o",
        "service": "fa-cogs",
        "application": "fa-code",
        "tabularDataset": "fa-table",
        "collectionHardware": "fa-hdd-o",
        "repository": "fa-database",
        "software": "fa-code",
        "model": "fa-lightbulb-o",
        "nonGeographicDataset": "fa-table",
        "product": "fa-shopping-basket",
        "awardInfo": "fa-trophy",
        "geographicDataset": "fa-globe",
        "nonGeographicDataset, report": "fa-book",
        "tile": "fa-file-image-o",
    };

    readonly UNKNOWN_FONT_ICON = 'fa-question-circle';
}

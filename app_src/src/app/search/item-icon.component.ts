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

    // built from https://mdtools.adiwg.org/#codes-page?c=iso_scope
    // IMPORTANT: This is duplicated into the lccnetwork.org app sci_cat.js/scResourceTypeIcons
    readonly FONT_ICONS = {
        attribute: '',
        attributeType: '',
        collectionHardware: 'fa-hdd-o',
        collectionSession: '',
        dataset: 'fa-database',
        series: 'fa-list',
        nonGeographicDataset: 'fa-table',
        dimensionGroup: '',
        feature: '',
        featureType: '',
        propertyType: '',
        fieldSession: '',
        software: 'fa-code',
        service: 'fa-cogs',
        model: 'fa-lightbulb-o',
        tile: 'fa-file-image-o',
        metadata: 'fa-info-circle',
        initiative: '',
        sample: '',
        document: 'fa-file-o',
        repository: 'fa-database',
        aggregate: '',
        product: 'fa-shopping-basket',
        collection: 'fa-bars',
        coverage: '',
        application: 'fa-code',
        sciencePaper: 'fa-file-text-o',
        userGuide: 'fa-book',
        dataDictionary: 'fa-book',
        website: 'fa-link',
        publication: 'fa-book',
        report: 'fa-file-text-o',
        awardInfo: 'fa-trophy',
        collectionSite: '',
        project: 'fa-product-hunt',
        factSheet: 'fa-file-o',
        tabularDataset: 'fa-table',
        map: 'fa-map-o',
        drawing: 'fa-pencil',
        photographicImage: 'fa-picture-o',
        presentation: 'fa-file-powerpoint-o',

        /* invalid ones in the catalog
        'geographicDataset': 'fa-globe',
        'Journal': 'fa-file-text-o',
        'journal': 'fa-file-text-o',
        */
    };


    readonly UNKNOWN_FONT_ICON = 'fa-question-circle';
}

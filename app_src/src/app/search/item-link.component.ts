import { Component, Input } from '@angular/core';
import { ItemIfc } from '../../../../src/db/models';

@Component({
    selector: 'item-link',
    template: `
    <a [target]="_target" [href]="_href" [title]="_title">
        <highlight-text [text]="item.simplified.title" [highlight]="highlight"></highlight-text>
    </a>
    `
})
export class ItemLink {
    @Input() target:string;
    @Input() highlight:string[];
    @Input() item:ItemIfc;

    _title:string;
    _href:string;
    _target:string;

    ngOnInit() {
        this._title = this.item.simplified.title;
        if(this.item.simplified && this.item.simplified.lccnet) {
            this._href = this.item.simplified.lccnet.url;
            this._target = this.target || '';
        } else {
            this._target = this.target || '_blank';
            this._href = `https://www.sciencebase.gov/catalog/item/${this.item._id}`;
        }
    }
}

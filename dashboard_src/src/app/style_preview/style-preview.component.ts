import { Component } from '@angular/core';

@Component({
    selector: 'style-preview',
    template: `
    <div><style-palette palette="primary"></style-palette></div>
    <div><style-palette palette="accent"></style-palette></div>
    <div><style-palette palette="warn"></style-palette></div>
    <div><buttons-style></buttons-style></div>
    <div><input-style></input-style></div>
    <div><progress-style></progress-style></div>
    `,
    styles: [`
        :host {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            justify-content: center;
        }
        div {
            flex-basis: 30%;
            flex-grow: 1;
            min-height: 100px;
            margin: 15px;
        }
    `]
})
export class StylePreviewComponent {

}

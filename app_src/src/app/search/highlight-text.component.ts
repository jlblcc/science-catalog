import { Component, Input, Pipe, PipeTransform } from '@angular/core';

@Pipe({name: 'highlight'})
export class HighlightPipe implements PipeTransform {
    private highlights:string[];
    private regexes:RegExp[];

    transform(value:string,highlights:string[]) {
        (highlights||[])
            .map(h => new RegExp(`\\b(${h})\\b`,'ig'))
            .forEach(regex => value = value.replace(regex,'<mark>$1</mark>'))
        return value;
    }
}

@Component({
    selector: 'highlight-text',
    template: `
    <span [innerHTML]="text | highlight:highlight"></span>
    `,
    providers: [
        HighlightPipe
    ]
})
export class HighlightText {
    @Input() text:string;
    @Input() highlight:string[];
}

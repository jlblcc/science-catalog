import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';

import { debounceTime, takeUntil } from 'rxjs/operators';

import { MonitorsDestroy } from '../common';
import { SearchService, SearchControl } from './search.service';

@Component({
    selector: 'text-search',
    template: `
    <mat-form-field class="text-search">
        <input matInput placeholder="Quick Search: Title/Abstract/Contacts/Keywords" [formControl]="$text" />
        <mat-hint>To search for a phrase &quot;wrap it in quotes&quot;</mat-hint>
    </mat-form-field>
    `,
    styles: [`
        mat-form-field {
            display: block;
        }
    `]
})
export class TextSearch extends MonitorsDestroy implements SearchControl {
    /** FormControl used to populate the search criteria */
    control:FormControl;
    /** FormControl for $text based search */
    $text: FormControl;
    /** Individual words entered into the $text input so results displays can highlight them */
    highlight:string[];

    constructor(private search:SearchService){
        super();
        let initial = search.initial,
            v = initial ? initial.$text : undefined;
        this.updateHighlights(v);
        this.control = new FormControl(v);
        this.$text = new FormControl(v);
        search.register(this);
    }

    reset() {
        this.control.setValue(null,{emitEvent:false});
        this.$text.setValue('',{emitEvent:false});
        this.updateHighlights(null);
    }

    private updateHighlights(v) {
        if(v) {
            let regex = new RegExp('"([\\w\\s^"]+)"|\\b(\\w+)\\b','g'),
                match, matches = [];
            while ((match = regex.exec(v)) !== null) {
                match = match[0];
                if(match.charAt(0) === '"' && match.charAt(match.length-1) === '"') {
                    match = match.substring(1,match.length-1);
                }
                matches.push(match);
            }
            this.highlight = matches;
        } else {
            this.highlight = [];
        }
    }

    ngOnInit() {
        this.$text.valueChanges.pipe(
            takeUntil(this.componentDestroyed),
            debounceTime(500)
        ).subscribe((v:string) => {
            this.updateHighlights(v);
            this.control.setValue(v);
        });
    }
}

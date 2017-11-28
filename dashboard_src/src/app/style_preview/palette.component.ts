import { Component, Input, HostBinding } from '@angular/core';

@Component({
    selector: 'style-palette',
    template:`
    <mat-card>
        <mat-card-title>{{palette | titlecase}} palette</mat-card-title>
        <mat-card-content>
            <ul>
              <li *ngFor="let c of colors"><div class="swatch s_{{c}}">&nbsp;</div> {{c}}</li>
            </ul>
            <label>All colors</label>
            <ul>
              <li *ngFor="let c of numericColors"><div class="swatch s_{{c}}">&nbsp;</div> {{c}}</li>
            </ul>
            <p><em>Note:</em> There may be accent colors but not all palettes have them so check
            <a href="https://material.io/guidelines/style/color.html#color-color-palette" target="_blank">Google Material Palettes</a></p>
        </mat-card-content>
    </mat-card>
    `,
    styles: [`
        ul {
            list-style: none;
        }
        .swatch {
            display: inline-block;
            border: 1px solid #aaa;
            width: 100px;
            height: 20px;
        }
    `]
})
export class PaletteComponent {
    @HostBinding('class')
    @Input()
    palette: string;

    colors = ['default','lighter','darker'];
    numericColors = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
    accentColors = ['A100','A200','A300','A400','A700'];
}

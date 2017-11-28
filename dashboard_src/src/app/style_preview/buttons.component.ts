import { Component } from '@angular/core';

@Component({
    selector: 'buttons-style',
    template:`
    <mat-card>
        <mat-card-title>Buttons</mat-card-title>
        <mat-card-content>
          <button mat-button>Button</button>
          <button mat-button color="primary">Button Primary</button>
          <button mat-button color="accent">Button Accent</button>
          <button mat-button color="warn">Button Warn</button>

          <button mat-raised-button>Raised button</button>
          <button mat-raised-button color="primary">Raised Primary</button>
          <button mat-raised-button color="accent">Raised Accent</button>
          <button mat-raised-button color="warn">Raised Warn</button>

          <button mat-icon-button matTooltip="icon no color"><i class="fa fa-2x fa-clock-o" aria-hidden="true"></i></button>
          <button mat-icon-button color="primary" matTooltip="icon primary"><i class="fa fa-2x fa-clock-o" aria-hidden="true"></i></button>
          <button mat-icon-button color="accent" matTooltip="icon accent"><i class="fa fa-2x fa-clock-o" aria-hidden="true"></i></button>
          <button mat-icon-button color="warn" matTooltip="icon warn"><i class="fa fa-2x fa-clock-o" aria-hidden="true"></i></button>

          <button mat-fab matTooltip="fab no color"><i class="fa fa-bars fa-2x" aria-hidden="true"></i></button>
          <button mat-fab color="primary" matTooltip="fab primary"><i class="fa fa-bars fa-2x" aria-hidden="true"></i></button>
          <button mat-fab color="accent" matTooltip="fab accent"><i class="fa fa-bars fa-2x" aria-hidden="true"></i></button>
          <button mat-fab color="warn" matTooltip="fab warn"><i class="fa fa-bars fa-2x" aria-hidden="true"></i></button>

          <button mat-mini-fab matTooltip="mini-fab no color"><i class="fa fa-bars fa-2x" aria-hidden="true"></i></button>
          <button mat-mini-fab color="primary" matTooltip="mini-fab primary"><i class="fa fa-bars fa-2x" aria-hidden="true"></i></button>
          <button mat-mini-fab color="accent" matTooltip="mini-fab accent"><i class="fa fa-bars fa-2x" aria-hidden="true"></i></button>
          <button mat-mini-fab color="warn" matTooltip="mini-fab warn"><i class="fa fa-bars fa-2x" aria-hidden="true"></i></button>
        </mat-card-content>
    </mat-card>
    `,
    styles: [`
        :host {
            display: flex;
            flex-direction: row;
            flex-wrap: wrap;
            justify-content: center;
        }
        button {
            flex-basis: 30%;
            margin: 15px;
        }
    `]
})
export class ButtonsComponent {}

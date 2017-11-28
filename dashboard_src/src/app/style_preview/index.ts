import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { PaletteComponent } from './palette.component';
import { ButtonsComponent } from './buttons.component';
import { ProgressComponent } from './progress.component';
import { InputComponent } from './input.component';
import { StylePreviewComponent } from './style-preview.component';
import { MatCardModule, MatButtonModule, MatTooltipModule,
        MatProgressSpinnerModule, MatProgressBarModule, MatCheckboxModule,
        MatFormFieldModule,MatInputModule } from '@angular/material';

@NgModule({
    imports: [
        BrowserModule,
        MatCardModule,
        MatButtonModule,
        MatTooltipModule,
        MatProgressSpinnerModule,
        MatProgressBarModule,
        MatCheckboxModule,
        MatFormFieldModule,MatInputModule
    ],
    declarations: [
        PaletteComponent,
        ButtonsComponent,
        ProgressComponent,
        InputComponent,
        StylePreviewComponent
    ],
    exports: [
        StylePreviewComponent
    ]
})
export class StylePreviewModule {}

export { StylePreviewComponent } from './style-preview.component';

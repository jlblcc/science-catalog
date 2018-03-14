import { NgModule } from '@angular/core';

import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { MatIconModule,
         MatButtonModule,
         MatFormFieldModule,
         MatSelectModule,
         MatCheckboxModule,
         MatProgressSpinnerModule,
         MatListModule,
         MatInputModule,
         MatTableModule,
         MatPaginatorModule,
         MatSortModule,
         MatButtonToggleModule,
         MatTooltipModule,
         MatCardModule,
         MatExpansionModule,
         MatChipsModule,
         MatAutocompleteModule } from '@angular/material';

@NgModule({
    imports:[
        BrowserModule,
        FormsModule,
        ReactiveFormsModule,

        MatIconModule,
        MatButtonModule,
        MatFormFieldModule,
        MatSelectModule,
        MatCheckboxModule,
        MatProgressSpinnerModule,
        MatListModule,
        MatInputModule,
        MatTableModule,
        MatPaginatorModule,
        MatSortModule,
        MatButtonToggleModule,
        MatTooltipModule,
        MatCardModule,
        MatExpansionModule,
        MatChipsModule,
        MatAutocompleteModule
    ],
    exports: [
        BrowserModule,
        FormsModule,
        ReactiveFormsModule,

        MatIconModule,
        MatButtonModule,
        MatFormFieldModule,
        MatSelectModule,
        MatCheckboxModule,
        MatProgressSpinnerModule,
        MatListModule,
        MatInputModule,
        MatTableModule,
        MatPaginatorModule,
        MatSortModule,
        MatButtonToggleModule,
        MatTooltipModule,
        MatCardModule,
        MatExpansionModule,
        MatChipsModule,
        MatAutocompleteModule
    ]
})
export class MaterialModule {}

import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { PepUIModule } from '../../modules/pepperi.module';
import { MaterialModule } from '../../modules/material.module';
import { DataIndexComponent } from './data-index.component';
import { PublishDialogComponent } from '../dialogs/publish-dialog.component';
import { ReactiveFormsModule } from '@angular/forms';


@NgModule({
    declarations: [
        DataIndexComponent,
        PublishDialogComponent
    ],
    imports: [
        CommonModule,
        PepUIModule,
        MaterialModule,
        ReactiveFormsModule

    ],
    providers: []
})
export class DataIndexModule {
}





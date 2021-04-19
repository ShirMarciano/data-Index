import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { PepUIModule } from '../../modules/pepperi.module';
import { MaterialModule } from '../../modules/material.module';
import { DataIndexComponent } from './data-index.component';
import { PublishDialogComponent } from '../dialogs/publish-dialog.component';


@NgModule({
    declarations: [
        DataIndexComponent,
        PublishDialogComponent
    ],
    imports: [
        CommonModule,
        PepUIModule,
        MaterialModule

    ],
    providers: []
})
export class DataIndexModule {
}





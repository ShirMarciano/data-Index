import { Component, OnInit, Inject, OnDestroy, ViewEncapsulation } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateService } from "@ngx-translate/core";

@Component({
  selector: 'publish-dialog',
  templateUrl:  './publish-dialog.component.html',
  styleUrls: ['./publish-dialog.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class PublishDialogComponent implements OnInit, OnDestroy {

    runType: string = "1";
    runTime: string = "00:00";
    outputData = {runType: 1,runTime : "00:00"}

    constructor(private translate: TranslateService,
        public dialogRef: MatDialogRef<PublishDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public incoming: any) {

    }

    

    ngOnInit() {
    }

    ngOnDestroy(){
       
    }
}
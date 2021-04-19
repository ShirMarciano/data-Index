import { Component, OnInit, Inject, OnDestroy, ViewEncapsulation, NgModule } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslateService } from "@ngx-translate/core";
import { FormControl } from "@angular/forms";  


@Component({
  selector: 'publish-dialog',
  templateUrl:  './publish-dialog.component.html',
  styleUrls: ['./publish-dialog.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class PublishDialogComponent implements OnInit, OnDestroy {

    public outputData = {runType: "1",runTime : "24:00"}
    runType:string = "1";

    constructor(private translate: TranslateService,
        public dialogRef: MatDialogRef<PublishDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public incoming: any) {

    }

    timeOptions = [
        { key: "01:00", value: "01:00" },
        { key: "02:00", value: "02:00" },
        { key: "03:00", value: "03:00" },
        { key: "04:00", value: "04:00" },
        { key: "05:00", value: "05:00" },
        { key: "06:00", value: "06:00" },
        { key: "07:00", value: "07:00" },
        { key: "08:00", value: "08:00" },
        { key: "09:00", value: "09:00" },
        { key: "10:00", value: "10:00" },
        { key: "11:00", value: "11:00" },
        { key: "12:00", value: "12:00" },
        { key: "13:00", value: "13:00" },
        { key: "14:00", value: "14:00" },
        { key: "15:00", value: "15:00" },
        { key: "16:00", value: "16:00" },
        { key: "17:00", value: "17:00" },
        { key: "18:00", value: "18:00" },
        { key: "19:00", value: "19:00" },
        { key: "20:00", value: "20:00" },
        { key: "21:00", value: "21:00" },
        { key: "22:00", value: "22:00" },
        { key: "23:00", value: "23:00" },
        { key: "24:00", value: "24:00" }

    ];

    onTimeChange($event) {
        this.outputData.runTime = $event.value;
             
    }

    

    ngOnInit() {
    }

    ngOnDestroy(){
       
    }

}
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Component, OnInit, Inject, ViewChild, OnDestroy, Injectable, ViewEncapsulation } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { FormBuilder } from '@angular/forms';
import { TranslateService } from "@ngx-translate/core";
import { PepUIModule } from '../../modules/pepperi.module';



@Injectable({ providedIn: 'root' })
export class PublishDialogService {

    private dataSource = new BehaviorSubject<any>('');
    data = this.dataSource.asObservable();

    constructor() { }

    getData(data: any) {
        this.dataSource.next(data);
    }

}
@Component({
  selector: 'publish-type-dialog',
  templateUrl: './publish-dialog.component.html',
  styleUrls: ['./publish-dialog.component.scss'],
  encapsulation: ViewEncapsulation.None
})
export class PublishDialogComponent implements OnInit, OnDestroy {

    runType: string = "1";
    runTime: string = "00:00";
    outputData = {runType: 1,runTime : "00:00"}

    constructor(private translate: TranslateService,
        private fb: FormBuilder,
        public dialogRef: MatDialogRef<PublishDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public incoming: any) {
            let userLang = "en";
            translate.setDefaultLang(userLang);
            userLang = translate.getBrowserLang().split("-")[0]; // use navigator lang if available
            translate.use(userLang);

    }

    

    ngOnInit() {
    }

    ngOnDestroy(){
       
    }
}
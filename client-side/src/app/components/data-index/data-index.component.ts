import {
    Component,
    EventEmitter,
    Input,
    Output,
    OnInit,
    ViewEncapsulation,
    Compiler,
    ViewChild,
    OnDestroy,
} from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { Router, ActivatedRoute } from "@angular/router";
import { PepLayoutService, PepScreenSizeType } from '@pepperi-addons/ngx-lib';
import { DataIndexService } from './data-index.service';
import { identifierModuleUrl } from "@angular/compiler";

import { PublishDialogComponent } from '../dialogs/publish-dialog.component';

import { of } from "rxjs";



@Component({
  selector: 'data-index',
  templateUrl: './data-index.component.html',
  styleUrls: ['./data-index.component.scss'],
  providers: [DataIndexService]
})
export class DataIndexComponent implements OnInit {
    screenSize: PepScreenSizeType;
    defaultFields: any;
    typesFields: any;
    uiData:any;
    disablePublish:boolean;
    progressIndicator:string;
    indexingFaild:boolean = false;
    indexingError:string;

    transaction_lines_fieldsToExport:string[];
    all_activities_fieldsToExport:string[];

    all_activities_types = [
        {key:"all_activities", value:this.translate.instant("Data_index_object_type_all_activities")},
        {key:"Account", value:this.translate.instant("Data_index_object_type_Account")}
    ]

    transaction_lines_types = [
        {key:"transaction_lines", value:this.translate.instant("Data_index_object_type_Transaction_line")},
        {key:"Item", value:this.translate.instant("Data_index_object_type_Item")},
        {key:"Transaction", value:this.translate.instant("Data_index_object_type_Transaction")},
        {key:"Transaction.Account", value:this.translate.instant("Data_index_object_type_Account")}
    ]

    menuOptions = [];

    constructor(
        public dataIndexService: DataIndexService,
        private translate: TranslateService,
        public routeParams: ActivatedRoute,
        public router: Router,
        public compiler: Compiler,
        public layoutService: PepLayoutService
    ) {

        // Parameters sent from url
        this.dataIndexService.pluginUUID = this.routeParams.snapshot.params['addon_uuid'];
        let userLang = "en";
        translate.setDefaultLang(userLang);
        userLang = translate.getBrowserLang().split("-")[0]; // use navigator lang if available
        translate.use(userLang);
        this.layoutService.onResize$.subscribe(size => {
            this.screenSize = size;
        });

        

    }

  ngOnInit(): void {


    this.uiData = this.dataIndexService.getUIData((result: any) => {

        this.uiData = result;
        var fields = this.uiData['Fields'];
        this.defaultFields = fields['DataIndexTypeDefaultFields'];
        this.typesFields = fields['TypesFields'];


        var progressData = this.uiData['ProgressData'];
        var progressStatus = progressData['Status'];

        this.disablePublish = progressStatus && progressStatus == 'InProgress'

        this.setProgressIndicator(progressData, progressStatus);

        this.menuOptions = [{ key: 'delete_index', text: this.translate.instant('Data_index_delete_index')}];

       });

       
  }

    private setProgressIndicator(progressData: any, progressStatus: any) {
        this.progressIndicator = "";
        if (progressData["RunTime"]) {
            this.progressIndicator = `The process is scheduled to run at: ${progressData["RunTime"]}`;
        }
        else if (progressStatus) {

            if (progressStatus == "Failure") {
                this.progressIndicator = `Failed to publish the data`;
                this.indexingFaild = true;
                this.indexingError = progressData["Message"];
            }
            else
            {
                var alPrecentage = progressData["all_activities_progress"]["Precentag"];
                alPrecentage = alPrecentage != "" ? alPrecentage : 0;
                var tlPrecentage = progressData["transaction_lines_progress"]["Precentag"];
                tlPrecentage = tlPrecentage != "" ? tlPrecentage : 0;

                this.progressIndicator = `Activities & Transactions indexing ${alPrecentage}% completed, Transaction lines indexing ${tlPrecentage}% completed `;

            }
        }
    }

    private getDistinctFieldsObj(fields:{Key:string,Value:string}[])
    {
        let distinctFields:{Key:string,Value:string}[] = [];
        let map = new Map();
        for (let field of fields) {
            if(!map.has(field.Key)){
                map.set(field.Key, true);    // set any value to Map
                distinctFields.push({
                     Key: field.Key,
                    Value: field.Value
                });
            }
        }

        return distinctFields;
    }

    publishClicked(){
        //get the fields to save

        //open dialog
        const dialogRef = this.dataIndexService.openPublishDialog(PublishDialogComponent);
        dialogRef.afterClosed().subscribe(dialogResult => {
            var data = {
                all_activities_fields: this.all_activities_fieldsToExport,
                transaction_lines_fields: this.transaction_lines_fieldsToExport,
                RunTime:null
            };
            if(dialogResult.runType == "2"){
                //add run time to saved object
                data.RunTime = dialogResult.runTime;
            }

            this.dataIndexService.publish(data,()=>{})
            
        });


    }

    errorDetailsClick(){
        this.dataIndexService.openDialog(
            this.translate.instant(
                "Data_index_failure_details"
            ),
            this.indexingError
        );

    }

    onMenuItemClicked(event) {
        switch (event.source.key) {
            case 'delete_index': {
                this.dataIndexService.openDialog(
                    this.translate.instant(
                        "Data_index_delete_index"
                    ),
                    this.translate.instant(
                        "Data_index_delete_body"
                    ),
                    this.translate.instant(
                        "Confirm"
                    ),
                    () =>{ 
                        var res = this.dataIndexService.deleteIndex(()=>{});
                        if(res["success"] == true){
                            this.progressIndicator="";
                        }
                    }
                );
                
                break;
            }
            default: {
                alert(event.apiName + " is not supported");
            }
        }
    }
    
}

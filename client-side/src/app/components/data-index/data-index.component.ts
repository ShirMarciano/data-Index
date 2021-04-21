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
    AfterViewInit,
    ViewContainerRef,
    TemplateRef,
} from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { Router, ActivatedRoute } from "@angular/router";
import { PepLayoutService, PepScreenSizeType } from '@pepperi-addons/ngx-lib';
import { DataIndexService } from './data-index.service';
import { identifierModuleUrl } from "@angular/compiler";

import { PublishDialogComponent } from '../dialogs/publish-dialog.component';

import { of } from "rxjs";
import { FormArray, FormBuilder, FormGroup } from "@angular/forms";



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

    all_activities_types = []

    all_activities_fieldsOptions = {}

    transaction_lines_types = []

    transaction_lines_fieldsOptions = {}

    menuOptions = []

    fields = []; 
    
    constructor(
        public dataIndexService: DataIndexService,
        private translate: TranslateService,
        public routeParams: ActivatedRoute,
        public router: Router,
        public compiler: Compiler,
        public layoutService: PepLayoutService,

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

        var fields = this.uiData['Fields']; // //the fields for the dropdowns and the defaultFields
        this.defaultFields = fields['DataIndexTypeDefaultFields'];
        this.typesFields = fields['TypesFields'];

        this.all_activities_fieldsToExport = this.uiData['all_activities_saved_fields'];
        this.transaction_lines_fieldsToExport= this.uiData['transaction_lines_saved_fields'];


        var progressStatus = this.uiData['ProgressData']['Status'];

        this.disablePublish = progressStatus && progressStatus == 'InProgress'

        this.setProgressIndicator(this.uiData['ProgressData']);

        this.menuOptions = [{ key: 'delete_index', text: this.translate.instant('Data_index_delete_index')}];

        this.all_activities_types = [
            {key:"all_activities", value:this.translate.instant("Data_index_object_type_all_activities")},
            {key:"Account", value:this.translate.instant("Data_index_object_type_Account")}
        ]
    
        var transaction_activities = this.typesFields["Transaction"].concat(this.typesFields["Activity"])
        this.all_activities_fieldsOptions = {
            "all_activities" :this.getDistinctFieldsObj(transaction_activities),
            "Account" : this.typesFields["Account"]
    
        }

        this.transaction_lines_types = [
            {key:"transaction_lines", value:this.translate.instant("Data_index_object_type_Transaction_line")},
            {key:"Item", value:this.translate.instant("Data_index_object_type_Item")},
            {key:"Transaction", value:this.translate.instant("Data_index_object_type_Transaction")},
            {key:"Transaction.Account", value:this.translate.instant("Data_index_object_type_Account")}
        ]
    
        this.transaction_lines_fieldsOptions = {
            "transaction_lines": [],
            "Item":[],
            "Transaction":[],
            "Transaction.Account":[]
        }

        this.fields.push({type:"Account", apiName:"Name", default:false});
        this.fields.push({type:"all_activities", apiName:"ActionDateTime",default:true});
        this.fields.push({type:"all_activities", apiName:"Hidden",default:false});

       });
  }

    private setProgressIndicator(progressData: any) {
        var progressStatus=progressData["Status"]
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
                alPrecentage = alPrecentage != "" && alPrecentage != null? alPrecentage : 0;
                var tlPrecentage = progressData["transaction_lines_progress"]["Precentag"];
                tlPrecentage = tlPrecentage != "" && tlPrecentage != null  ? tlPrecentage : 0;

                this.progressIndicator = `Activities & Transactions indexing ${alPrecentage}% completed, Transaction lines indexing ${tlPrecentage}% completed `;

            }
        }
    }

    private getDistinctFieldsObj(fields:{key:string,value:string}[])
    {
        let distinctFields:{key:string,value:string}[] = [];
        let map = new Map();
        for (let field of fields) {
            let key = field.key;
            if(!map.has(key)){
                map.set(key, true);   
                distinctFields.push({
                     key: key,
                    value: field.value
                });
            }
        }

        return distinctFields;
    }

    addFieldRow(){
        var self = this;
        self.fields.push({type:"all_activities", apiName:null, default:false});
    }

    deleteFieldRow(rowNum){
        var self = this;
        self.fields.splice(rowNum,1);
    }

    onTypeChange(event){
        alert(event.value);
    }

    onApiNameChange(event){
        alert(event.value);
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
            if(dialogResult.runType == "2"){ // type 2 is run at option of the publish
                //add run time to saved object
                data.RunTime = dialogResult.runTime;
            }

            //this.dataIndexService.publish(data,()=>{})
            
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
                        this.dataIndexService.deleteIndex((res)=>{
                            if(res["success"] == true){
                                this.progressIndicator="";
                            }
                        });
                       
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

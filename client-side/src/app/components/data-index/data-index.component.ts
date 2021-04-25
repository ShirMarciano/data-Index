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

    all_activities_types = []
    transaction_lines_types = []


    all_activities_apiNames = {}
    transaction_lines_apiNames = {}

    menuOptions = []

    fields = {
        "all_activities":[],
        "transaction_lines":[]
    }

    fieldsNumberLimit = 20;

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
    this.getUIData();
  }

    private getUIData() {

        this.uiData = this.dataIndexService.getUIData((result: any) => {

            this.uiData = result;

            var fields = this.uiData['Fields']; // //the fields for the dropdowns and the defaultFields
            this.defaultFields = fields['DataIndexTypeDefaultFields'];
            this.typesFields = fields['TypesFields'];

            var progressStatus = this.uiData['ProgressData']['Status'];

            this.disablePublish = progressStatus && progressStatus == 'InProgress';

            this.setProgressIndicator(this.uiData['ProgressData']);

            this.menuOptions = [{ key: 'delete_index', text: this.translate.instant('Data_index_delete_index') }];

            this.SetAllActivitiesTabData();


            this.SetTransactionLinesUIData();


        });
    }

    private SetTransactionLinesUIData() {
        this.transaction_lines_types = [
            { key: "transaction_lines", value: this.translate.instant("Data_index_object_type_Transaction_line") },
            { key: "Item", value: this.translate.instant("Data_index_object_type_Item") },
            { key: "Transaction", value: this.translate.instant("Data_index_object_type_Transaction") },
            { key: "Transaction.Account", value: this.translate.instant("Data_index_object_type_Account") },
            { key: "Transaction.Agent", value: this.translate.instant("Data_index_object_type_Agent") }

        ];

        this.transaction_lines_apiNames = {
            "transaction_lines": this.typesFields["transaction_lines"],
            "Item": this.typesFields["Item"],
            "Transaction": [],
            "Transaction.Account": this.typesFields["Account"],
            "Transaction.Agent": this.typesFields["Agent"]

        };

        this.setTabFields("transaction_lines");
    }

    private SetAllActivitiesTabData() {
        this.all_activities_types = [
            { key: "all_activities", value: this.translate.instant("Data_index_object_type_all_activities") },
            { key: "Account", value: this.translate.instant("Data_index_object_type_Account") },
            { key: "Agent", value: this.translate.instant("Data_index_object_type_Agent") }

        ];

        var transaction_activities_fields = this.typesFields["Transaction"].concat(this.typesFields["Activity"]);
        this.all_activities_apiNames = {
            "all_activities": this.getDistinctFieldsObj(transaction_activities_fields),
            "Account": this.typesFields["Account"] ,
            "Agent": this.typesFields["Agent"]
        };

        this.setTabFields("all_activities");
    }

    private setTabFields(indexType: string) {
        this.defaultFields[indexType].forEach(field => {
            this.addFieldToTabUIFields(field, indexType, true);
        });

        this.uiData[`${indexType}_saved_fields`].forEach(field => {
            if (!this.defaultFields[indexType].includes(field)) { // default fields will be added separetley to the UI arr
                this.addFieldToTabUIFields(field, indexType, false);
            }
        });
    }

    private addFieldToTabUIFields(field: string, indexType: string, defaultField: boolean) {
        if (field.includes(".")) { // ref field
            var lastDotIndex = field.lastIndexOf('.');
            var prefix = field.substring(0, lastDotIndex);
            var apiName = field.substring(lastDotIndex + 1);
            if (this.typesFields[prefix]) //if not defined - the prefix is not supported in the ui
            {
                var fieldObj =  this.getFieldFromFieldsType(prefix, apiName);
                if (fieldObj) // can be not defined if invalid api name somehow was entered to adal record -will not be shown and new publish will remove it
                {
                    this.fields[indexType].push({ type: prefix, apiName: apiName, default: defaultField });
                }

                this.handleSpecialCases(indexType, prefix, fieldObj); 
            }
        }
        else {

            if (this.getFieldFromFieldsType(indexType, field)) // can be not defined or enpty array if invalid api name somehow was entered to adal record -will not be shown and new publish will remove it
            {
                this.fields[indexType].push({ type: indexType, apiName: field, default: defaultField });
            }

        }
    }

    private handleSpecialCases(indexType: string, prefix: string, fieldObj: any) {
        if (indexType == "transaction_lines" && prefix == 'Transaction') {
            this.transaction_lines_apiNames["Transaction"].push(fieldObj);
        }
    }

    private getFieldFromFieldsType(type: string, apiName: string) {
        var res;
        if(type == "all_activities"){
             res = this.getFieldObj("Transaction", apiName);
             if(!res || res.length == 0)
                res = this.getFieldObj("Activity", apiName);
        }
        else
        {
            res = this.typesFields[type].filter(field => {
                return field.key === apiName;
            });
        }
        return res && res.length > 0? res[0]:undefined;
    }

    private getFieldObj(type: string, apiName: string){
        return this.typesFields[type].filter(field => {
            return field.key === apiName;
        });
    }

    private setProgressIndicator(progressData: any) {
        var progressStatus=progressData["Status"]
        this.progressIndicator = this.translate.instant("Data_index_has_no_data");
        if (progressData["RunTime"]) {
            this.progressIndicator = `${this.translate.instant('Data_index_processScheduledToRunAt')}: ${progressData["RunTime"]}`;
        }
        else if (progressStatus) {

            if (progressStatus == "Failure") {
                this.progressIndicator = this.translate.instant('Data_index_failedToPublish');
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
                                //refresh the UI
                                this.cleanUIData();
                                this.getUIData();
                               
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

    addFieldRow(tab){
        var self = this;
        self.fields[tab].push({type:tab, apiName:null, default:false})

    }

    deleteFieldRow(rowNum,tab){
        var self = this;
        self.fields[tab].splice(rowNum,1);
    }

    onTypeChange(event,rowNum, tab){
        var self = this;
        self.fields[tab][rowNum].type = event.value;
        self.fields[tab][rowNum].apiName = null;
    }

    onApiNameChange(event,rowNum, tab){
        var self = this;       
        var apiName = event.value; 
        self.fields[tab][rowNum].apiName = apiName;
        switch(tab)
        {
            // add field to Transaction api names list for Transaction lines tab
            case "all_activities":
                if(self.fields["all_activities"][rowNum].type == "all_activities"){
                    var res = self.typesFields["Transaction"].filter(field => {
                        return field.key === apiName;
                    })
                    if(res.length > 0) // it is transaction field - add to transaction lines transaction api names
                    {
                        self.transaction_lines_apiNames['Transaction'].push(res[0]);
                    };
                }  
                break
        }
    }

    publishClicked(){
        //get the fields to save
        var data = {
            all_activities_fields: this.getIndexTypeFieldsToExport("all_activities"),
            transaction_lines_fields: this.getIndexTypeFieldsToExport("transaction_lines"),
            RunTime:null
        };

        //open dialog
        const dialogRef = this.dataIndexService.openPublishDialog(PublishDialogComponent);
        dialogRef.afterClosed().subscribe(dialogResult => {
            if(dialogResult)
            {
                if(dialogResult.runType == "2"){ // type 2 is 'run at' option of the publish
                    //add run time to saved object
                    data.RunTime = dialogResult.runTime;
                }
    
                this.dataIndexService.publish(data,(result)=>{
                    //refresh the UI
                    this.cleanUIData();
                    this.getUIData();
                })
            }
            
            
        });


    }

    private cleanUIData() {
        this.uiData = "";
        this.disablePublish = false;
        this.progressIndicator = "";
        this.indexingFaild = false;
        this.indexingError = "";

        this.all_activities_types = [];
        this.transaction_lines_types = [];


        this.all_activities_apiNames = {};
        this.transaction_lines_apiNames = {};

        this.menuOptions = [];

        this.fields = {
            "all_activities": [],
            "transaction_lines": []
        };
    }

    private getIndexTypeFieldsToExport(indexType: string) {
        var fieldsToExport : string[] = [];
        this.fields[indexType].forEach(fieldObj => {
            var field = fieldObj.apiName;
            if (field != null) { // igmoe unselected api names in the UI
                if (fieldObj.type != indexType) { // I made the key to be always the full prefix - Account in all activities and Transaction.Account in transaction_lines
                    field = `${fieldObj.type}.${field}`;
                }
                fieldsToExport.push(field);
            }
        });

        return fieldsToExport;

    }


    
}

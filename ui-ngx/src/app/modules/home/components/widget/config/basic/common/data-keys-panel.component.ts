///
/// Copyright © 2016-2023 The Thingsboard Authors
///
/// Licensed under the Apache License, Version 2.0 (the "License");
/// you may not use this file except in compliance with the License.
/// You may obtain a copy of the License at
///
///     http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing, software
/// distributed under the License is distributed on an "AS IS" BASIS,
/// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
/// See the License for the specific language governing permissions and
/// limitations under the License.
///

import {
  ChangeDetectorRef,
  Component,
  forwardRef,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  ViewEncapsulation
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  UntypedFormArray,
  UntypedFormBuilder,
  UntypedFormControl,
  UntypedFormGroup,
  Validator
} from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { WidgetConfigComponent } from '@home/components/widget/widget-config.component';
import { DataKey, DatasourceType, JsonSettingsSchema, widgetType } from '@shared/models/widget.models';
import { dataKeyRowValidator } from '@home/components/widget/config/basic/common/data-key-row.component';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { DataKeyType } from '@shared/models/telemetry/telemetry.models';
import { alarmFields } from '@shared/models/alarm.models';
import { UtilsService } from '@core/services/utils.service';
import { DataKeysCallbacks } from '@home/components/widget/config/data-keys.component.models';
import { coerceBoolean } from '@shared/decorators/coercion';

@Component({
  selector: 'tb-data-keys-panel',
  templateUrl: './data-keys-panel.component.html',
  styleUrls: ['./data-keys-panel.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DataKeysPanelComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => DataKeysPanelComponent),
      multi: true
    }
  ],
  encapsulation: ViewEncapsulation.None
})
export class DataKeysPanelComponent implements ControlValueAccessor, OnInit, OnChanges, Validator {

  @Input()
  disabled: boolean;

  @Input()
  panelTitle: string;

  @Input()
  addKeyTitle: string;

  @Input()
  keySettingsTitle: string;

  @Input()
  removeKeyTitle: string;

  @Input()
  noKeysText: string;

  @Input()
  datasourceType: DatasourceType;

  @Input()
  entityAliasId: string;

  @Input()
  deviceId: string;

  @Input()
  @coerceBoolean()
  hideDataKeyColor = false;

  dataKeyType: DataKeyType;
  alarmKeys: Array<DataKey>;
  functionTypeKeys: Array<DataKey>;

  keysListFormGroup: UntypedFormGroup;

  get widgetType(): widgetType {
    return this.widgetConfigComponent.widgetType;
  }

  get callbacks(): DataKeysCallbacks {
    return this.widgetConfigComponent.widgetConfigCallbacks;
  }

  get datakeySettingsSchema(): JsonSettingsSchema {
    return this.widgetConfigComponent.modelValue?.dataKeySettingsSchema;
  }

  get dragEnabled(): boolean {
    return this.keysFormArray().controls.length > 1;
  }

  private propagateChange = (_val: any) => {};

  constructor(private fb: UntypedFormBuilder,
              private dialog: MatDialog,
              private cd: ChangeDetectorRef,
              private utils: UtilsService,
              private widgetConfigComponent: WidgetConfigComponent) {
  }

  ngOnInit() {
    this.keysListFormGroup = this.fb.group({
      keys: [this.fb.array([]), []]
    });
    this.keysListFormGroup.valueChanges.subscribe(
      (val) => this.propagateChange(this.keysListFormGroup.get('keys').value)
    );
    this.alarmKeys = [];
    for (const name of Object.keys(alarmFields)) {
      this.alarmKeys.push({
        name,
        type: DataKeyType.alarm
      });
    }
    this.functionTypeKeys = [];
    for (const type of this.utils.getPredefinedFunctionsList()) {
      this.functionTypeKeys.push({
        name: type,
        type: DataKeyType.function
      });
    }
    this.updateParams();
  }

  ngOnChanges(changes: SimpleChanges): void {
    for (const propName of Object.keys(changes)) {
      const change = changes[propName];
      if (!change.firstChange && change.currentValue !== change.previousValue) {
        if (['datasourceType'].includes(propName)) {
            this.updateParams();
        }
      }
    }
  }

  private updateParams() {
    if (this.datasourceType === DatasourceType.function) {
      this.dataKeyType = DataKeyType.function;
    } else {
      if (this.widgetType !== widgetType.latest && this.widgetType !== widgetType.alarm) {
        this.dataKeyType = DataKeyType.timeseries;
      } else {
        this.dataKeyType = null;
      }
    }
  }

  registerOnChange(fn: any): void {
    this.propagateChange = fn;
  }

  registerOnTouched(fn: any): void {
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
    if (isDisabled) {
      this.keysListFormGroup.disable({emitEvent: false});
    } else {
      this.keysListFormGroup.enable({emitEvent: false});
    }
  }

  writeValue(value: DataKey[] | undefined): void {
    this.keysListFormGroup.setControl('keys', this.prepareKeysFormArray(value), {emitEvent: false});
  }

  public validate(c: UntypedFormControl) {
    return this.keysListFormGroup.valid ? null : {
      dataKeyRows: {
        valid: false,
      },
    };
  }

  keyDrop(event: CdkDragDrop<string[]>) {
    const keysArray = this.keysListFormGroup.get('keys') as UntypedFormArray;
    const key = keysArray.at(event.previousIndex);
    keysArray.removeAt(event.previousIndex);
    keysArray.insert(event.currentIndex, key);
  }

  keysFormArray(): UntypedFormArray {
    return this.keysListFormGroup.get('keys') as UntypedFormArray;
  }

  trackByKey(index: number, keyControl: AbstractControl): any {
    return keyControl;
  }

  removeKey(index: number) {
    (this.keysListFormGroup.get('keys') as UntypedFormArray).removeAt(index);
  }

  addKey() {
    const dataKey = this.callbacks.generateDataKey('', null, this.datakeySettingsSchema);
    dataKey.label = '';
    dataKey.decimals = 0;
    const keysArray = this.keysListFormGroup.get('keys') as UntypedFormArray;
    const keyControl = this.fb.control(dataKey, [dataKeyRowValidator]);
    keysArray.push(keyControl);
  }

  private prepareKeysFormArray(keys: DataKey[] | undefined): UntypedFormArray {
    const keysControls: Array<AbstractControl> = [];
    if (keys) {
      keys.forEach((key) => {
        keysControls.push(this.fb.control(key, [dataKeyRowValidator]));
      });
    }
    return this.fb.array(keysControls);
  }

}

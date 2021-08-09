import { NgModule } from '@angular/core';

import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';

import { CommonUiCoreModule } from '@papx/common/ui-core';
import { CommonUiForms } from '@papx/common/ui-forms';
import { ProductoSelectorModule } from '@papx/shared/productos/producto-selector';

import { ItemFormComponent } from './item-form/item-form.component';
import { ItemModalComponent } from './item-modal/item-modal.component';

import { ItemController } from './item.controller';
import { ITEM_FORM_FIELDS } from './item-form';
import { ProductoControlModule } from '@papx/shared/productos/producto-control/producto-control.module';

@NgModule({
  imports: [
    CommonUiCoreModule,
    CommonUiForms,
    ProductoSelectorModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
    MatAutocompleteModule,
    ProductoControlModule,
  ],
  exports: [],
  declarations: [ItemModalComponent, ItemFormComponent, ...ITEM_FORM_FIELDS],
  providers: [ItemController, ItemFormComponent],
})
export class SharedUiPedidoItemModule {}

import { NgModule } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { DropdownModule } from 'primeng/dropdown';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { DynamicDialogModule } from 'primeng/dynamicdialog';
import { AccordionModule } from 'primeng/accordion';
import { BadgeModule } from 'primeng/badge';
import { FieldsetModule } from 'primeng/fieldset';
import { InputNumberModule } from 'primeng/inputnumber';
import { ChipsModule } from 'primeng/chips';
import { ToastModule } from 'primeng/toast';
import { TableModule } from 'primeng/table';
import { CalendarModule } from 'primeng/calendar';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { CommonModule } from '@angular/common';

const MODULES = [
  CommonModule,
  ButtonModule,
  InputTextModule,
  InputTextareaModule,
  DropdownModule,
  CheckboxModule,
  DialogModule,
  DynamicDialogModule,
  AccordionModule,
  BadgeModule,
  FieldsetModule,
  InputNumberModule,
  ChipsModule,
  ToastModule,
  TableModule,
  CalendarModule,
  ConfirmDialogModule
];

@NgModule({
  imports: [...MODULES],
  exports: [...MODULES],
  providers: [
    MessageService,
    ConfirmationService,
    DialogService
  ]
})
export class PrimeNGModule { }

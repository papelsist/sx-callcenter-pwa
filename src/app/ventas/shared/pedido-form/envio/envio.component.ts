import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnInit,
} from '@angular/core';
import { AbstractControl, FormGroup, ValidationErrors } from '@angular/forms';

import { takeUntil, map } from 'rxjs/operators';
import { Observable } from 'rxjs';

import capitalize from 'lodash-es/capitalize';
import words from 'lodash-es/words';
import { differenceInHours } from 'date-fns';

import { BaseComponent } from '@papx/core';
import {
  Cliente,
  ClienteDireccion,
  buildDireccionKey,
  Direccion,
} from '@papx/models';
import { CatalogosService } from '@papx/data-access';
import { SUCURSALES } from '@papx/common/ui-forms/sucursal-control/sucursales';

const hourToDate = (value: string): Date => {
  const [hours, minutes] = value.split(':').map((item) => parseFloat(item));
  const now = new Date();
  now.setHours(hours);
  now.setMinutes(minutes);
  now.setSeconds(0);
  now.setMinutes(0);
  return now;
};

const HorarioValidator = (
  control: AbstractControl
): ValidationErrors | null => {
  const horario = control.value;
  if (typeof horario == 'string') {
    return null;
  }
  if (horario) {
    const horaInicial = hourToDate(horario.horaInicial);
    const horaFinal = hourToDate(horario.horaFinal);
    const diff = differenceInHours(horaFinal, horaInicial);
    return diff < 1 ? { tooEarly: true } : null;
  }
  return null;
};

const findDirecciones = (cliente: Partial<Cliente>): ClienteDireccion[] => {
  console.debug('Preparando direcciones de envio.....');
  if (cliente.rfc === 'XAXX010101000') return [];

  const direccionFiscal = {
    direccion: cliente.direccion,
    nombre: 'Direccion Fiscal',
  };
  const direcciones = cliente.direcciones || [];
  return [direccionFiscal, ...direcciones];
  /*
  if (cliente.direcciones) {
    return cliente.direcciones;
  } else {
    return [
      {
        direccion: cliente.direccion,
        nombre: buildDireccionKey(cliente.direccion),
      },
    ];
  }
  */
};

@Component({
  selector: 'papx-envio-form',
  templateUrl: 'envio.component.html',
  styleUrls: ['envio.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnvioComponent extends BaseComponent implements OnInit {
  @Input() parent: FormGroup;
  form: FormGroup;

  controls: { [key: string]: AbstractControl };

  direcciones$: Observable<ClienteDireccion[]>;
  direcciones: ClienteDireccion[] = [];

  disabledTransporte = true;

  constructor(private catalogos: CatalogosService) {
    super();
  }

  ngOnInit() {
    // console.debug('Envio: ', this.parent.get('envio'));
    this.initForm();
    this.setControls();
    this.registerTipoListener();
    this.setupHorarioControl();
    this.registerContactoListener();
    this.registerDireccionListener();
    this.direcciones$ = this.parent.get('cliente').valueChanges.pipe(
      map((cte) => findDirecciones(cte)),
      takeUntil(this.destroy$)
    );

    this.registerTransporteListener();
  }

  private initForm() {
    this.form = this.parent.get('envio') as FormGroup;
    this.form.status === 'INVALID' ? this.form.disable() : this.form.enable();
  }

  private setControls() {
    this.controls = {
      tipo: this.form.controls.tipo,
      transporte: this.form.controls.transporte,
      contacto: this.form.controls.contacto,
      telefono: this.form.controls.telefono,
      horario: this.form.controls.horario,
      fechaDeEntrega: this.form.controls.fechaDeEntrega,
      direccion: this.form.controls.direccion,
    };
  }

  private setupHorarioControl() {
    const horario: AbstractControl = this.form.get('horario');
    horario.setValidators(HorarioValidator);
    horario.updateValueAndValidity();
  }

  private registerTipoListener() {
    this.tipo.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((val) => {
      const validos = ['FORANEO', 'OCURRE'];
      if (validos.includes(val)) {
        this.disabledTransporte = false;
        this.transporte.enable();
      } else {
        this.disabledTransporte = true;
        this.transporte.setValue(null);
        this.transporte.disable();
      }
    });
  }

  private registerContactoListener() {
    this.contacto.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((val) => {
        const res = words(val)
          .map((item) => capitalize(item))
          .join(' ');
        this.form.patchValue(
          { contacto: res },
          { emitEvent: false, onlySelf: true }
        );
      });
  }

  private registerDireccionListener() {
    this.form
      .get('direccion')
      .valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe((value: ClienteDireccion) => {
        if (value && value.direccion) {
          const { codigoPostal } = value.direccion;
          this.catalogos.buscarSucursalPorZip(codigoPostal).subscribe((val) => {
            if (val) {
              const rootForm = this.form.parent;
              if (rootForm) {
                rootForm.get('sucursalEntity').setValue(val);
              }
            }
          });
        }
      });
  }

  private registerTransporteListener() {
    this.transporte.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe((val) => {
        if (val && val.sucursal) {
          const suc = SUCURSALES.find((item) => item.nombre === val.sucursal);
          if (suc) {
            const rootForm = this.form.parent;
            if (rootForm) {
              rootForm.get('sucursalEntity').setValue(suc);
            }
          }
        }
      });
  }

  setEnvio({ detail: { checked } }: any) {
    if (checked) {
      this.form.enable();
      this.form.markAsDirty();
    } else {
      // this.form.disable();
      this.parent.get('envio').disable();
      this.form.reset();
      // this.form.markAsPristine();
      // this.form.clearValidators();
      // this.form.markAsUntouched();
    }

    this.parent.markAsDirty();
  }

  get tipo(): AbstractControl {
    return this.controls.tipo;
  }
  get transporte(): AbstractControl {
    return this.controls.transporte;
  }
  get contacto(): AbstractControl {
    return this.controls.contacto;
  }
  get cliente(): Partial<Cliente> {
    return this.parent.get('cliente').value;
  }
}

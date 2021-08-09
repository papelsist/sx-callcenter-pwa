import { Injectable } from '@angular/core';

import { AngularFirestore } from '@angular/fire/firestore';

import { Observable, throwError } from 'rxjs';
import { catchError, map, shareReplay, take } from 'rxjs/operators';

import { isSameDay, parseJSON, parseISO, startOfDay, endOfDay } from 'date-fns';

import {
  PeriodoSearchCriteria,
  SolicitudDeDeposito,
  UpdateSolicitud,
} from '@papx/models';

import { User } from '@papx/models';
import fireabse from 'firebase/app';

@Injectable({ providedIn: 'root' })
export class SolicitudesService {
  readonly COLLECTION = 'solicitudes';

  pendientes$ = this.afs
    .collection<SolicitudDeDeposito>(this.COLLECTION, (ref) => {
      let query = ref
        .where('status', '==', 'PENDIENTE')
        .where('callcenter', '==', true);
      return query.limit(20);
    })
    .valueChanges({ idField: 'id' })
    .pipe(
      shareReplay(1),
      catchError((err) => throwError(err))
    );

  rechazadas$ = this.afs
    .collection<SolicitudDeDeposito>(this.COLLECTION, (ref) => {
      let query = ref
        .where('status', '==', 'RECHAZADO')
        .where('callcenter', '==', true);
      return query.limit(30);
    })
    .valueChanges({ idField: 'id' })
    .pipe(
      shareReplay(1),
      catchError((err) => throwError(err))
    );

  constructor(private readonly afs: AngularFirestore) {}

  async createSolicitud(solicitud: Partial<SolicitudDeDeposito>, user: User) {
    try {
      const payload: Partial<SolicitudDeDeposito> = {
        ...solicitud,
        callcenter: true,
        fecha: new Date().toISOString(),
        createUserUid: user.uid,
        createUser: user.displayName,
        updateUserUid: user.uid,
        updateUser: user.displayName,
        dateCreated: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        appVersion: 2,
      };

      const folioRef = this.afs.doc('folios/solicitudes').ref;
      let folio = 1;

      let pedidoRef = null;
      if (payload.pedido) {
        pedidoRef = this.afs.doc(`pedidos/${payload.pedido.id}`).ref;
      }
      const solicitudRef = this.afs.collection(this.COLLECTION).doc().ref;

      return this.afs.firestore.runTransaction(async (transaction) => {
        const folioDoc = await transaction.get<any>(folioRef);
        const SUCURSAL = 'CALLCENTER';
        const folios = folioDoc.data() || {};
        if (!folios[SUCURSAL]) {
          folios[SUCURSAL] = 0;
        }
        folios[SUCURSAL] += 1;
        folio = folios[SUCURSAL];
        if (pedidoRef != null) {
          transaction
            .set(folioRef, folios, { merge: true })
            .set(solicitudRef, { ...payload, folio })
            .update(pedidoRef, { solicitud: { folio, id: solicitudRef.id } });
          return folio;
        } else {
          transaction
            .set(folioRef, folios, { merge: true })
            .set(solicitudRef, { ...payload, folio });
          return folio;
        }
      });
    } catch (error: any) {
      console.error('Error salvando pedido: ', error);
      throw new Error('Error salvando pedido: ' + error.message);
    }
  }

  async update(command: UpdateSolicitud, user: User) {
    try {
      const doc = this.afs.doc(`${this.COLLECTION}/${command.id}`);
      const data: Partial<SolicitudDeDeposito> = {
        ...command.changes,
        lastUpdated: new Date().toISOString(),
        updateUserUid: user.uid,
        updateUser: user.displayName,
      };
      await doc.ref.update(data);
    } catch (error) {
      throw new Error('Error actualizando solicitud :' + error.message);
    }
  }

  // findPendientes(max: number = 20): Observable<SolicitudDeDeposito[]> {
  //   return this.afs
  //     .collection<SolicitudDeDeposito>(this.COLLECTION, (ref) => {
  //       let query = ref
  //         .where('status', '==', 'PENDIENTE')
  //         .where('callcenter', '==', true);
  //       return query.limit(max);
  //     })
  //     .valueChanges({ idField: 'id' })
  //     .pipe(catchError((err) => throwError(err)));
  // }

  // findAutorizadas(): Observable<SolicitudDeDeposito[]> {
  //   return this.afs
  //     .collection<SolicitudDeDeposito>(this.COLLECTION, (ref) => {
  //       let query = ref
  //         .where('status', '==', 'PENDIENTES')
  //         .where('callcenter', '==', true);
  //       return query.limit(30);
  //     })
  //     .valueChanges({ idField: 'id' })
  //     .pipe(catchError((err) => throwError(err)));
  // }

  /**
   * Metodo para localizar las solicitudes autorizadas por sucursal
   */
  findAutorizadas(
    criteria: PeriodoSearchCriteria
  ): Observable<SolicitudDeDeposito[]> {
    const { fechaInicial, fechaFinal, registros } = criteria;
    const inicial = startOfDay(parseJSON(criteria.fechaInicial));
    const final = endOfDay(parseJSON(criteria.fechaFinal));
    // console.log(
    //   'Fecha inicial JSON: ',
    //   startOfDay(parseJSON(criteria.fechaInicial))
    // );
    // console.log('Fecha inicial ISO: ', parseISO(criteria.fechaInicial));
    return this.afs
      .collection<SolicitudDeDeposito>(this.COLLECTION, (ref) => {
        let query = ref
          .where('autorizacion.fecha', '>=', inicial)
          .where('autorizacion.fecha', '<=', final)
          .where('callcenter', '==', true)
          .where('appVersion', '==', 2)
          .orderBy('autorizacion.fecha', 'desc');
        return query.limit(registros);
      })
      .valueChanges({ idField: 'id' })
      .pipe(catchError((err) => throwError(err)));
  }

  get(id: string) {
    const doc = this.afs.doc<SolicitudDeDeposito>(`${this.COLLECTION}/${id}`);
    return doc
      .valueChanges({ idField: 'id' })
      .pipe(catchError((err) => throwError(err)));
  }

  buscarDuplicado(sol: Partial<SolicitudDeDeposito>) {
    console.log('Buscando  duplicado para: ', sol);
    const { total, cuenta, banco } = sol;
    const fechaDeposito = parseISO(sol.fechaDeposito);
    return this.afs
      .collection<SolicitudDeDeposito>(this.COLLECTION, (ref) =>
        ref
          .where('total', '==', total)
          .where('cuenta.id', '==', cuenta.id)
          .where('banco.id', '==', banco.id)
          // .where('id', '!=', id)
          .limit(10)
      )
      .valueChanges({ idField: 'id' })
      .pipe(
        take(1),
        map((rows) => rows.filter((item) => item.id !== sol.id)),
        map((rows) =>
          rows.filter((item) => {
            const fdep = parseISO(item.fechaDeposito);
            return isSameDay(fechaDeposito, fdep);
          })
        ),
        catchError((err) => throwError(err))
      )
      .toPromise();
  }
}

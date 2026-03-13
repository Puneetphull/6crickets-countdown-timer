import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { DeadlineResponse } from '../models/deadline.model';

@Injectable({ providedIn: 'root' })
export class DeadlineApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = '/api/deadline';

  getSecondsLeft(): Observable<number> {
    return this.http
      .get<DeadlineResponse>(this.apiUrl)
      .pipe(map((res) => res.secondsLeft));
  }
}

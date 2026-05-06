import { RequestMeta } from './meta';

export class SuccessEnvelope<T> {
  data: T;
  meta: RequestMeta;

  constructor(data: T, meta: RequestMeta) {
    this.data = data;
    this.meta = meta;
  }
}

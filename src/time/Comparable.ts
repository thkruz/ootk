import { Epoch } from './Epoch';

export interface Comparable {
  compareTo(other: Epoch): number;
}

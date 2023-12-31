import { J2000 } from '../coordinate/J2000';

// / Result of adaptive numerical integration.
export class RkResult {
  // / Create a new [RkResult] object.
  constructor(public state: J2000, public error: number, public newStep: number) {
    // Nothing to do here.
  }
}

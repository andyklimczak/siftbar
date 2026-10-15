// Optional integration recipe. @hotwired/stimulus belongs to the consuming app,
// not Siftbar's runtime or build. No Rails gem/helper is shipped here.
import { Controller } from '@hotwired/stimulus';
import { Siftbar } from 'siftbar';

export default class extends Controller {
  static targets = ['host', 'state'];
  static values = { config: Object };
  connect() {
    this.onChange = () => this.sync();
    this.beforeCache = () => this.unmount();
    this.onReturn = () => { if (this.element.isConnected) this.mount(); };
    this.hostTarget.addEventListener('siftbar:change', this.onChange);
    document.addEventListener('turbo:before-cache', this.beforeCache);
    document.addEventListener('turbo:load', this.onReturn);
    document.addEventListener('turbo:render', this.onReturn);
    document.addEventListener('turbo:fetch-request-error', this.onReturn);
    this.mount();
  }
  mount() {
    if (this.siftbar) return;
    this.siftbar = new Siftbar(this.hostTarget, this.configValue);
    try {
      if (this.stateTarget.value) this.siftbar.setState(JSON.parse(this.stateTarget.value));
      this.sync(); // setState is silent; do not rely on a change event here.
    } catch (error) {
      this.siftbar.destroy(); this.siftbar = null;
      throw error; // Consumer decides how to present invalid server-supplied state.
    }
  }
  sync() { if (this.siftbar) this.stateTarget.value = JSON.stringify(this.siftbar.getState()); }
  unmount() {
    this.sync(); // Persist committed state before removing owned DOM/drafts.
    this.siftbar?.destroy();
    this.siftbar = null;
  }
  disconnect() {
    this.unmount();
    this.hostTarget.removeEventListener('siftbar:change', this.onChange);
    document.removeEventListener('turbo:before-cache', this.beforeCache);
    document.removeEventListener('turbo:load', this.onReturn);
    document.removeEventListener('turbo:render', this.onReturn);
    document.removeEventListener('turbo:fetch-request-error', this.onReturn);
  }
}

import { visit } from '@hotwired/turbo';
import { Application } from '@hotwired/stimulus';
import SiftbarController from '../../../examples/integration/stimulus-controller.js';
const application = Application.start();
application.register('siftbar', SiftbarController);
window.turboFixture = { application, visit };

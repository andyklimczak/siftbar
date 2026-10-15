import { mountLocalExample } from './local.js';
void mountLocalExample().catch(error => { document.querySelector('#local-error').textContent = error.message; });

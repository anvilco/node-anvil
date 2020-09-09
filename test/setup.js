const { get } = require('bdd-lazy-var/getter')

// In order to get around eslint complaining for now:
// https://github.com/stalniy/bdd-lazy-var/issues/56#issuecomment-639248242
global.$ = get

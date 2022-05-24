module.exports = {
  extends: '../.eslintrc.js',
  env: {
    mocha: true,
  },
  globals: {
    expect: 'readonly',
    should: 'readonly',
    sinon: 'readonly',
    mount: 'readonly',
    render: 'readonly',
    shallow: 'readonly',
    //* ************************************************
    // bdd-lazy-var
    //
    // In order to get around eslint complaining for now:
    // https://github.com/stalniy/bdd-lazy-var/issues/56#issuecomment-639248242
    $: 'readonly',
    its: 'readonly',
    def: 'readonly',
    subject: 'readonly',
    get: 'readonly',
    sharedExamplesFor: 'readonly',
    includeExamplesFor: 'readonly',
    itBehavesLike: 'readonly',
    is: 'readonly',
    //
    //* ************************************************
  },
}

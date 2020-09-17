class UploadWithOptions {
  constructor (streamLikeThing, formDataAppendOptions) {
    this.streamLikeThing = streamLikeThing
    this.formDataAppendOptions = formDataAppendOptions
  }

  get options () {
    return this.formDataAppendOptions
  }

  get file () {
    return this.streamLikeThing
  }

  appendToForm (form, fieldName) {
    form.append(fieldName, this.streamLikeThing, this.formDataAppendOptions)
  }
}

module.exports = UploadWithOptions

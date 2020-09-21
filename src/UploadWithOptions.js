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
}

module.exports = UploadWithOptions

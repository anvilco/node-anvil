require('@babel/register')({
  ignore: [/node_modules/],
})

export function run (fn) {
  fn().then(() => {
    process.exit(0)
  }).catch((err) => {
    console.log(err.stack || err.message)
    process.exit(1)
  })
}

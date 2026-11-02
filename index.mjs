// The ESM entry point. The client is built as CommonJS (see index.js); this re-exports
// it so that `import Anvil from '@anvilco/anvil'` gets the class itself, in JavaScript
// and in TypeScript alike.
import Anvil from './index.js'

export const AnvilRequestError = Anvil.AnvilRequestError

export default Anvil
